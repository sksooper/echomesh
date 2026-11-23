import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CityEvent, CityEventsService } from '../city-events/city-events.service';
import { DbService } from '../db/db.service';
import { User } from '../users/user.types';
import { analyzeReport, fold, ReportAnalysis } from './analysis';
import { ListReportsQuery } from './chatbot.dto';
import { matchEventByName } from './event-matcher';
import { LlmService } from './llm.service';

// Ochrona przed zalewem zgłoszeń (a później przed kosztami zapytań do LLM)
const MAX_REPORTS_PER_HOUR = Number(process.env.CHAT_MAX_REPORTS_PER_HOUR ?? 10);

export type ReportStatus = 'incident' | 'planned' | 'needs_info';
export type ReviewStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface ReportInput {
  message: string;
  lat: number;
  lng: number;
}

export interface ReportResult {
  id: number;
  status: ReportStatus;
  reviewStatus: ReviewStatus;
  /** Odpowiedź chatbota do wyświetlenia w oknie czatu. */
  reply: string;
  tips: string[];
  matchedEvent: { id: number; title: string } | null;
}

/** Zgłoszenie widziane przez jego autora („Moje zgłoszenia”). */
export interface MyReport {
  id: number;
  message: string;
  status: ReportStatus;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  occurredAt: Date;
  lat: number;
  lng: number;
  eventTitle: string | null;
  noiseType: string | null;
}

/** Pozycja kolejki moderacji — widzi ją tylko analityk / administrator (z treścią zgłoszenia). */
export interface ModerationItem {
  id: number;
  message: string;
  status: ReportStatus;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  occurredAt: Date;
  lat: number;
  lng: number;
  userName: string;
  noiseType: string | null;
  setting: string | null;
  usedLlm: boolean;
}

interface Verification {
  status: ReportStatus;
  event: CityEvent | null;
  matchedBy: 'location' | 'name' | null;
}

const timeFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function describeEvent(event: CityEvent): string {
  return `„${event.title}” (${timeFormat.format(event.startTime)} – ${timeFormat.format(event.endTime)})`;
}

/** Odpowiedź chatbota dla użytkownika (po polsku; wersje językowe dojdą razem z i18n). */
function buildReply(analysis: ReportAnalysis, v: Verification): string {
  if (v.status === 'planned' && v.event) {
    const intro =
      v.matchedBy === 'location'
        ? `W pobliżu trwa wydarzenie ${describeEvent(v.event)}.`
        : `Z opisu wynika, że chodzi o wydarzenie ${describeEvent(v.event)}.`;
    return `${intro} Hałas jest zaplanowany, więc zgłoszenie nie trafi do analityka.`;
  }
  if (v.status === 'incident') {
    return 'Dziękuję! Zgłoszenie zapisane i czeka na weryfikację analityka. Po zatwierdzeniu pojawi się na mapie dla wszystkich (bez treści Twojej wiadomości).';
  }
  // needs_info
  if (analysis.issues.includes('gibberish')) {
    return 'Treść wygląda na test lub przypadkowe znaki. Opisz proszę własnymi słowami, jaki hałas słyszysz.';
  }
  if (analysis.issues.includes('future_event')) {
    return 'Opisujesz zdarzenie, które jeszcze się nie odbyło. Zgłoś hałas, gdy już go usłyszysz.';
  }
  return 'Nie jestem pewien, czy opisujesz hałas. Napisz, co dokładnie słyszysz (np. muzyka, wiercenie, krzyki) i skąd dobiega.';
}

@Injectable()
export class ChatbotService {
  constructor(
    private db: DbService,
    private events: CityEventsService,
    private llm: LlmService,
  ) {}

  /** Przyjmuje zgłoszenie: analiza -> weryfikacja z wydarzeniami -> zapis -> odpowiedź chatbota. */
  async submit(user: User, input: ReportInput, now: Date = new Date()): Promise<ReportResult> {
    await this.assertRateLimit(user.id);

    const analysis = await this.analyze(input.message, now);
    // czas z treści ("wczoraj o 22"), ale nigdy z przyszłości
    const occurredAt = analysis.occurredAt && new Date(analysis.occurredAt) < now ? new Date(analysis.occurredAt) : now;

    const verification = await this.verify(analysis, input, occurredAt);
    // tylko prawdziwe incydenty trafiają do kolejki moderacji; zaplanowane i niepełne — nie
    const reviewStatus: ReviewStatus = verification.status === 'incident' ? 'pending' : 'none';

    const [row] = await this.db.query<{ id: number }>(
      `INSERT INTO chat_reports
         (user_id, message, is_verified, status, location, occurred_at, matched_event_id, analysis, review_status)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4326), $7, $8, $9::jsonb, $10)
       RETURNING id`,
      [
        user.id,
        input.message,
        analysis.isNoiseReport && analysis.plausible,
        verification.status,
        input.lng, // ST_MakePoint(długość, szerokość)
        input.lat,
        occurredAt,
        verification.event?.id ?? null,
        JSON.stringify({ ...analysis, matchedBy: verification.matchedBy }),
        reviewStatus,
      ],
    );

    return {
      id: row.id,
      status: verification.status,
      reviewStatus,
      reply: buildReply(analysis, verification),
      tips: analysis.tips,
      matchedEvent: verification.event ? { id: verification.event.id, title: verification.event.title } : null,
    };
  }

  /**
   * Analiza treści: najpierw LLM (jedno zapytanie), a gdy jest wyłączony lub zawiedzie (timeout, błąd, zła
   * odpowiedź) — reguły. Dzięki temu chatbot działa zawsze.
   */
  private async analyze(message: string, now: Date): Promise<ReportAnalysis> {
    if (this.llm.enabled) {
      // LLM dostaje listę trwających wydarzeń, żeby rozpoznać, o które chodzi
      const titles = (await this.events.findActiveAt(now)).map((e) => e.title);
      const fromLlm = await this.llm.analyze(message, now, titles);
      if (fromLlm) {
        // model nie podał porad — dokładamy te z reguł
        return fromLlm.isNoiseReport && fromLlm.tips.length === 0
          ? { ...fromLlm, tips: analyzeReport(message, now).tips }
          : fromLlm;
      }
    }
    return analyzeReport(message, now);
  }

  /**
   * Krzyżowanie z harmonogramem wydarzeń:
   *  1. treść nie opisuje hałasu albo wygląda niewiarygodnie -> needs_info,
   *  2. wydarzenie trwa w pobliżu miejsca zgłoszenia -> planned,
   *  3. wydarzenie wskazane nazwą w treści (nazwę z listy podaje LLM, bez LLM szukamy słów z tytułu) -> planned,
   *  4. w przeciwnym razie -> incident (czeka na moderację).
   */
  private async verify(analysis: ReportAnalysis, input: ReportInput, occurredAt: Date): Promise<Verification> {
    if (!analysis.isNoiseReport || !analysis.plausible) return { status: 'needs_info', event: null, matchedBy: null };

    const byLocation = await this.events.findActiveNear(input.lat, input.lng, occurredAt);
    if (byLocation) return { status: 'planned', event: byLocation, matchedBy: 'location' };

    const active = await this.events.findActiveAt(occurredAt);
    const named = analysis.eventName ? active.find((e) => fold(e.title) === fold(analysis.eventName as string)) : undefined;
    if (named) return { status: 'planned', event: named, matchedBy: 'name' };

    const byName = matchEventByName(input.message, active);
    if (byName) return { status: 'planned', event: byName.event, matchedBy: 'name' };

    return { status: 'incident', event: null, matchedBy: null };
  }

  private async assertRateLimit(userId: number) {
    const [row] = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM chat_reports WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [userId],
    );
    if (row.n >= MAX_REPORTS_PER_HOUR) {
      throw new HttpException('Too many reports, try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Zgłoszenia zalogowanego użytkownika (najnowsze pierwsze) wraz z nazwą dopasowanego wydarzenia. */
  findMine(userId: number): Promise<MyReport[]> {
    return this.db.query<MyReport>(
      `SELECT r.id, r.message, r.status, r.review_status AS "reviewStatus",
              r.created_at AS "createdAt", r.occurred_at AS "occurredAt",
              ST_Y(r.location) AS lat, ST_X(r.location) AS lng,
              e.title AS "eventTitle", r.analysis->>'noiseType' AS "noiseType"
       FROM chat_reports r
       LEFT JOIN city_events e ON e.id = r.matched_event_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [userId],
    );
  }

  /** Kolejka moderacji: tylko incydenty (review_status <> 'none'). Oczekujące od najstarszych, reszta od najnowszych. */
  findForModeration(q: ListReportsQuery): Promise<ModerationItem[]> {
    const review = q.review ?? 'pending';
    const params: unknown[] = [];
    let where = `r.review_status <> 'none'`;
    if (review !== 'all') {
      params.push(review);
      where = `r.review_status = $1`;
    }
    params.push(q.limit ?? 50);
    // review jest zwalidowane przez @IsIn, więc ASC/DESC wybieramy po stałej wartości, a nie po tekście od użytkownika
    const order = review === 'pending' ? 'ASC' : 'DESC';

    return this.db.query<ModerationItem>(
      `SELECT r.id, r.message, r.status, r.review_status AS "reviewStatus",
              r.created_at AS "createdAt", r.occurred_at AS "occurredAt",
              ST_Y(r.location) AS lat, ST_X(r.location) AS lng,
              u.name AS "userName",
              r.analysis->>'noiseType' AS "noiseType",
              r.analysis->>'setting' AS "setting",
              COALESCE((r.analysis->>'usedLlm')::boolean, false) AS "usedLlm"
       FROM chat_reports r
       JOIN users u ON u.id = r.user_id
       WHERE ${where}
       ORDER BY r.created_at ${order}
       LIMIT $${params.length}`,
      params,
    );
  }
}
