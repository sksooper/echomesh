import { Injectable, Logger } from '@nestjs/common';
import type { ReportAnalysis } from './analysis';
import { buildMessages } from './llm-prompt';
import { extractJson, validateLlmAnalysis } from './llm-validate';

// Dostawca zgodny z API OpenAI (domyślnie Groq). Bez klucza LLM jest wyłączony i chatbot działa na regułach.
const API_KEY = process.env.LLM_API_KEY ?? '';
const BASE_URL = (process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL ?? 'openai/gpt-oss-120b';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 8000);

const CACHE_TTL_MS = 10 * 60_000; // identyczne zgłoszenie w ciągu 10 min nie kosztuje drugiego zapytania
const CACHE_MAX = 200;

@Injectable()
export class LlmService {
  private readonly log = new Logger(LlmService.name);
  private readonly cache = new Map<string, { at: number; value: ReportAnalysis }>();

  readonly enabled = API_KEY.length > 0;

  /**
   * Jedno zapytanie na zgłoszenie. Zwraca zwalidowaną analizę albo null (brak klucza, timeout, błąd HTTP,
   * zła odpowiedź) — wtedy wywołujący używa analizy opartej na regułach.
   */
  async analyze(message: string, now: Date, eventTitles: string[]): Promise<ReportAnalysis | null> {
    if (!this.enabled) return null;

    const key = `${message.trim().toLowerCase()}|${eventTitles.join('|')}`;
    const hit = this.cache.get(key);
    if (hit && now.getTime() - hit.at < CACHE_TTL_MS) return hit.value;

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 700,
          response_format: { type: 'json_object' },
          messages: buildMessages(message, now, eventTitles),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        // nie logujemy treści zgłoszenia ani klucza — tylko status
        this.log.warn(`LLM zwrócił HTTP ${res.status}; używam reguł`);
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = data.choices?.[0]?.message?.content;
      const analysis = typeof content === 'string' ? validateLlmAnalysis(extractJson(content), now) : null;
      if (!analysis) {
        this.log.warn('Odpowiedź LLM nie przeszła walidacji; używam reguł');
        return null;
      }

      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string); // najstarszy wpis
      this.cache.set(key, { at: now.getTime(), value: analysis });
      return analysis;
    } catch (e) {
      this.log.warn(`Błąd połączenia z LLM (${(e as Error).name}); używam reguł`);
      return null;
    }
  }
}
