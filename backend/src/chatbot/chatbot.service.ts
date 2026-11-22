import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CityEvent, CityEventsService } from '../city-events/city-events.service';
import { DbService } from '../db/db.service';
import { User } from '../users/user.types';
import { analyzeReport, ReportAnalysis } from './analysis';
import { matchEventByName } from './event-matcher';

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
  ) {}

  /** Przyjmuje zgłoszenie: analiza -> weryfikacja z wydarzeniami -> zapis -> odpowiedź chatbota. */
  async submit(user: User, input: ReportInput, now: Date = new Date()): Promise<ReportResult> {
    await this.assertRateLimit(user.id);

    const analysis = analyzeReport(input.message, now);
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
   * Krzyżowanie z harmonogramem wydarzeń:
   *  1. treść nie opisuje hałasu albo wygląda niewiarygodnie -> needs_info,
   *  2. wydarzenie trwa w pobliżu miejsca zgłoszenia -> planned,
   *  3. wydarzenie wskazane nazwą w treści -> planned,
   *  4. w przeciwnym razie -> incident (czeka na moderację).
   */
  private async verify(analysis: ReportAnalysis, input: ReportInput, occurredAt: Date): Promise<Verification> {
    if (!analysis.isNoiseReport || !analysis.plausible) return { status: 'needs_info', event: null, matchedBy: null };

    const byLocation = await this.events.findActiveNear(input.lat, input.lng, occurredAt);
    if (byLocation) return { status: 'planned', event: byLocation, matchedBy: 'location' };

    const byName = matchEventByName(input.message, await this.events.findActiveAt(occurredAt));
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
}
