import type { NoiseType, ReportAnalysis, ReportIssue, Setting } from './analysis';

/*
 * Odpowiedź LLM to tekst, któremu NIE wolno ufać: może być zepsutym JSON-em, mieć złe typy albo
 * pola spoza naszego słownika. Wszystko sprawdzamy i normalizujemy; przy poważnym błędzie zwracamy null
 * (wtedy chatbot przechodzi na reguły).
 */

const NOISE_TYPES: NoiseType[] = ['music', 'construction', 'traffic', 'alarm', 'fireworks', 'voices', 'animals', 'other'];
const SETTINGS: Setting[] = ['outdoor', 'indoor'];
const ISSUES: ReportIssue[] = ['no_noise', 'future_event', 'gibberish'];

const MAX_TIPS = 3;
const MAX_TEXT = 200;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Model czasem opakowuje JSON w ```json ... ``` albo dopisuje zdanie — bierzemy tekst od pierwszego { do ostatniego }. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const cleanText = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t.slice(0, MAX_TEXT) : null;
};

export function validateLlmAnalysis(raw: unknown, now: Date): ReportAnalysis | null {
  if (!isRecord(raw) || typeof raw.is_noise_report !== 'boolean') return null;

  const isNoiseReport = raw.is_noise_report;
  const issues = (Array.isArray(raw.issues) ? raw.issues : []).filter((i): i is ReportIssue => ISSUES.includes(i as ReportIssue));
  if (!isNoiseReport && !issues.includes('no_noise')) issues.push('no_noise');

  let occurredAt: string | null = null;
  if (typeof raw.occurred_at === 'string') {
    const d = new Date(raw.occurred_at);
    // data z przyszłości (>5 min) albo niepoprawna — ignorujemy
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime() + 5 * 60_000) occurredAt = d.toISOString();
  }

  const tips = isNoiseReport
    ? (Array.isArray(raw.tips) ? raw.tips : [])
        .map(cleanText)
        .filter((t): t is string => t !== null)
        .slice(0, MAX_TIPS)
    : [];

  return {
    isNoiseReport,
    plausible: typeof raw.plausible === 'boolean' ? raw.plausible : true,
    issues,
    noiseType: isNoiseReport ? (NOISE_TYPES.includes(raw.noise_type as NoiseType) ? (raw.noise_type as NoiseType) : 'other') : null,
    setting: SETTINGS.includes(raw.setting as Setting) ? (raw.setting as Setting) : null,
    occurredAt,
    eventName: cleanText(raw.event_name),
    tips,
    usedLlm: true,
  };
}
