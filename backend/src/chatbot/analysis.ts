/*
 * Analiza treści zgłoszenia oparta na regułach (bez modelu językowego).
 * To tryb awaryjny, który działa zawsze — w kolejnej sesji dołożymy LLM, a ten moduł zostanie jako zapas.
 * Wszystko tu to czyste funkcje (bez bazy i HTTP), więc łatwo je testować.
 */

export type NoiseType = 'music' | 'construction' | 'traffic' | 'alarm' | 'fireworks' | 'voices' | 'animals' | 'other';
export type Setting = 'outdoor' | 'indoor';
/** Powody, dla których zgłoszenie wymaga doprecyzowania. */
export type ReportIssue = 'no_noise' | 'future_event' | 'gibberish';

export interface ReportAnalysis {
  /** Czy treść w ogóle opisuje hałas. */
  isNoiseReport: boolean;
  /** Czy zgłoszenie wygląda wiarygodnie (brak "błędu ludzkiego"). */
  plausible: boolean;
  issues: ReportIssue[];
  noiseType: NoiseType | null;
  setting: Setting | null;
  /** Kiedy hałas wystąpił (ISO), jeśli da się to wyczytać z treści; inaczej null = "teraz". */
  occurredAt: string | null;
  tips: string[];
  usedLlm: boolean;
}

const TIME_ZONE = 'Europe/Warsaw';

/** Małe litery, bez polskich znaków i akcentów ("Hałas" -> "halas"), żeby reguły były odporne na pisownię. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

/*
 * Słowa kluczowe (PL / EN / UA). Dopasowanie po złożeniu tekstu (fold):
 *  - zwykłe słowo = przedrostek wyrazu ("wierc" złapie "wiercą", "wiercenie"),
 *  - słowo z "$" na końcu = cały wyraz (żeby "dog$" nie łapało "dogadać").
 */
const NOISE_KEYWORDS: Record<Exclude<NoiseType, 'other'>, string[]> = {
  music: ['muzyk', 'koncert', 'imprez', 'dyskotek', 'basy$', 'naglosni', 'music', 'party$', 'concert', 'музик', 'вечірк', 'концерт'],
  construction: ['wierc', 'wiert', 'remont', 'budow', 'koparka', 'mlot', 'kucie', 'szlifier', 'drill', 'construction', 'jackhammer', 'свердл', 'будів', 'ремонт', 'перфоратор'],
  traffic: ['klakson', 'motocykl', 'tramwaj', 'autobus', 'pisk opon', 'ruch uliczn', 'horn$', 'traffic', 'engine', 'клаксон', 'мотоцикл', 'трамва'],
  alarm: ['syren', 'alarm', 'siren', 'сирен', 'сигналізац'],
  fireworks: ['petard', 'fajerwerk', 'wybuch', 'huk', 'strzal', 'fireworks', 'bang$', 'explosion', 'феєрверк', 'вибух', 'петард'],
  voices: ['krzyk', 'krzycz', 'wrzask', 'awantur', 'klotni', 'pijan', 'shout', 'scream', 'yelling', 'крик', 'кричат', 'сварк'],
  animals: ['szczek', 'wycie', 'pies$', 'psy$', 'barking', 'dog$', 'гавка', 'собак'],
};

// Ogólne słowa o hałasie (nie wskazują typu, ale potwierdzają, że zgłoszenie dotyczy hałasu)
const GENERIC_NOISE = ['halas', 'glosn', 'noise', 'noisy', 'loud', 'przeszkadza', 'nie da sie spac', 'disturb', 'шум', 'гучн', 'заважа'];

// "Nie ma hałasu", "cisza" — zgłoszenie nic nie zgłasza
const NEGATIONS = ['nie ma halas', 'brak halas', 'bez halas', 'cisza', 'cicho$', 'quiet$', 'silence', 'no noise', 'тиша', 'тихо$'];

// Opisy zdarzeń, które jeszcze się nie odbyły — hałasu nie da się usłyszeć "z przyszłości"
const FUTURE = ['jutro', 'pojutrze', 'bedzie', 'tomorrow', 'will be', 'завтра', 'буде'];

const INDOOR = ['w budynku', 'w mieszkaniu', 'za sciana', 'sasiad', 'w domu', 'na klatce', 'pietro', 'pietrze', 'in the building', 'apartment', 'neighbor', 'у будинку', 'сусід', 'в квартир'];
const OUTDOOR = ['na ulicy', 'na zewnatrz', 'w parku', 'na rynku', 'na placu', 'na chodniku', 'przed domem', 'za oknem', 'outside', 'on the street', 'на вулиці', 'надворі'];

// Kompilacja słowa kluczowego do wyrażenia regularnego (lookbehind: początek wyrazu, "$": koniec wyrazu)
const compiled = new Map<string, RegExp>();
function regexFor(keyword: string): RegExp {
  let re = compiled.get(keyword);
  if (!re) {
    const whole = keyword.endsWith('$');
    const stem = fold(whole ? keyword.slice(0, -1) : keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<!\\p{L})${stem}${whole ? '(?!\\p{L})' : ''}`, 'u');
    compiled.set(keyword, re);
  }
  return re;
}
const hits = (folded: string, keywords: string[]) => keywords.filter((k) => regexFor(k).test(folded)).length;

/** Typ hałasu: grupa z największą liczbą trafień; samo ogólne "hałas" daje 'other'; brak trafień daje null. */
export function detectNoiseType(folded: string): NoiseType | null {
  let best: NoiseType | null = null;
  let bestHits = 0;
  for (const [type, keywords] of Object.entries(NOISE_KEYWORDS) as [NoiseType, string[]][]) {
    const n = hits(folded, keywords);
    if (n > bestHits) {
      best = type;
      bestHits = n;
    }
  }
  if (best) return best;
  return hits(folded, GENERIC_NOISE) > 0 ? 'other' : null;
}

export function detectSetting(folded: string): Setting | null {
  const indoor = hits(folded, INDOOR) > 0;
  const outdoor = hits(folded, OUTDOOR) > 0;
  if (indoor === outdoor) return null; // brak wskazówek albo sprzeczne
  return indoor ? 'indoor' : 'outdoor';
}

function looksLikeGibberish(original: string, folded: string): boolean {
  const letters = (folded.match(/\p{L}/gu) ?? []).length;
  if (letters < 3) return true;
  if (letters / folded.replace(/\s/g, '').length < 0.5) return true; // same cyfry i znaki
  if (/(.)\1{4,}/u.test(folded)) return true; // "aaaaaa"
  const compact = folded.replace(/[\s\d\p{P}]/gu, '');
  if (/asdf|qwer|zxcv|sdfg|dfgh/.test(compact)) return true; // "klawiaturowe" ciągi
  if (compact.length >= 8 && new Set(compact).size <= 4) return true; // mało różnych liter w długim tekście
  return /^(test|testing|xxx|ok)\W*$/u.test(folded.trim());
}

// ---------- czas zdarzenia ----------

/** Przesunięcie strefy czasowej względem UTC (ms) w danej chwili. */
function tzOffsetMs(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Czas lokalny (Wrocław) -> moment w UTC. Dwa przebiegi poprawiają błąd na styku czasu zimowego/letniego. */
function zonedToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - tzOffsetMs(guess);
  return new Date(guess - tzOffsetMs(first));
}

function localParts(now: Date) {
  const shifted = new Date(now.getTime() + tzOffsetMs(now.getTime()));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/**
 * Wyczytuje czas z treści: "wczoraj", "o 22", "o 22:30", "godz. 3:15".
 * Zwraca null, gdy brak wskazówek (czyli: hałas dzieje się teraz).
 */
export function parseOccurredAt(folded: string, now: Date): Date | null {
  const yesterday = /(?<!\p{L})(wczoraj|yesterday|вчора)(?!\p{L})/u.test(folded);
  const time = folded.match(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/u) ?? folded.match(/(?<!\p{L})(?:o|godz|godzinie|about|at|о)\.?\s*(\d{1,2})(?![\d:])/u);

  if (!time) return yesterday ? new Date(now.getTime() - 24 * 3_600_000) : null;

  const hour = Number(time[1]);
  const minute = time[2] !== undefined && time[2].length === 2 ? Number(time[2]) : 0;
  if (hour > 23 || minute > 59) return null;

  const { y, m, d } = localParts(now);
  let at = zonedToUtc(y, m, d, hour, minute);
  // "wczoraj o 22", albo godzina, która dziś jeszcze nie nadeszła — zakładamy wczoraj
  if (yesterday || at.getTime() > now.getTime() + 5 * 60_000) at = new Date(at.getTime() - 24 * 3_600_000);
  return at;
}

// ---------- porady ----------

const TYPE_TIPS: Record<NoiseType, string> = {
  music: 'Jeśli głośna muzyka trwa po godz. 22:00, możesz zgłosić to Straży Miejskiej (tel. 986).',
  construction: 'Hałas z prac budowlanych bywa zaplanowany — sprawdź w zakładce Wydarzenia, czy w okolicy trwa remont.',
  traffic: 'Hałas uliczny jest zwykle mniejszy w bocznych ulicach — spróbuj wyznaczyć cichą trasę na mapie.',
  alarm: 'Jeśli sygnał alarmowy trwa długo i nikt nie reaguje, możesz zawiadomić Straż Miejską (tel. 986).',
  fireworks: 'Huki i petardy mogą bardzo przebodźcować — słuchawki wyciszające pomagają przeczekać najgłośniejszy moment.',
  voices: 'Jeśli podczas awantury ktoś może być zagrożony, zadzwoń pod numer alarmowy 112.',
  animals: 'Szczekanie psa najlepiej najpierw zgłosić właścicielowi lub zarządcy budynku.',
  other: 'Napisz, co to za dźwięk i jak długo trwa — pomoże to analitykowi ocenić zgłoszenie.',
};
const INDOOR_TIP = 'Hałas z budynku warto zgłosić także zarządcy lub administracji osiedla.';
const SENSORY_TIP = 'Jeśli hałas Cię przebodźcowuje, użyj słuchawek wyciszających i wyznacz cichą trasę na mapie.';

// ---------- główna funkcja ----------

export function analyzeReport(message: string, now: Date = new Date()): ReportAnalysis {
  const folded = fold(message);
  const issues: ReportIssue[] = [];

  const noiseType = detectNoiseType(folded);
  const negated = hits(folded, NEGATIONS) > 0;
  const isNoiseReport = noiseType !== null && !negated;
  if (!isNoiseReport) issues.push('no_noise');

  if (looksLikeGibberish(message, folded)) issues.push('gibberish');
  if (hits(folded, FUTURE) > 0) issues.push('future_event');

  const setting = detectSetting(folded);
  const occurredAt = parseOccurredAt(folded, now);

  const tips: string[] = [];
  if (isNoiseReport && noiseType) {
    tips.push(TYPE_TIPS[noiseType]);
    tips.push(setting === 'indoor' ? INDOOR_TIP : SENSORY_TIP);
    if (setting === 'indoor') tips.push(SENSORY_TIP);
  }

  return {
    isNoiseReport,
    // "no_noise" to brak opisu hałasu, a nie brak wiarygodności — wiarygodność oceniają pozostałe powody
    plausible: !issues.includes('gibberish') && !issues.includes('future_event'),
    issues,
    noiseType: isNoiseReport ? noiseType : null,
    setting,
    occurredAt: occurredAt ? occurredAt.toISOString() : null,
    tips,
    usedLlm: false,
  };
}
