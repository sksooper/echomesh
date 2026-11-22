import { fold } from './analysis';
import type { CityEvent } from '../city-events/city-events.service';

// Słowa zbyt ogólne, by świadczyć o konkretnym wydarzeniu
const STOP_WORDS = new Set(['przy', 'oraz', 'dla', 'nad', 'pod', 'this', 'that', 'with', 'from', 'jest', 'sie']);
const STEM_LENGTH = 4;

/**
 * Rdzenie słów (pierwsze 4 litery) — wystarczą, by "Rynek" i "rynku" uznać za to samo słowo mimo odmiany.
 * Słowa krótsze niż 4 litery ("na", "w") pomijamy.
 */
export function stems(text: string): Set<string> {
  const words = fold(text).split(/[^\p{L}]+/u);
  return new Set(words.filter((w) => w.length >= STEM_LENGTH && !STOP_WORDS.has(w)).map((w) => w.slice(0, STEM_LENGTH)));
}

export interface NameMatch {
  event: CityEvent;
  /** Jaka część słów z tytułu wydarzenia pojawia się w zgłoszeniu (0…1). */
  score: number;
}

/**
 * Szuka wydarzenia, o którym mowa w treści zgłoszenia ("koncert na rynku").
 * Wydarzenie pasuje, gdy co najmniej połowa znaczących słów jego tytułu występuje w tekście.
 * Zwraca najlepsze dopasowanie albo null.
 */
export function matchEventByName(message: string, events: CityEvent[], minScore = 0.5): NameMatch | null {
  const messageStems = stems(message);
  let best: NameMatch | null = null;

  for (const event of events) {
    const titleStems = [...stems(event.title)];
    if (titleStems.length === 0) continue;
    const matched = titleStems.filter((s) => messageStems.has(s)).length;
    const score = matched / titleStems.length;
    if (score >= minScore && (!best || score > best.score)) best = { event, score };
  }
  return best;
}
