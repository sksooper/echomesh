// Pasma poziomu hałasu. Pełne nazwy klas Tailwind muszą występować w kodzie,
// inaczej Tailwind ich nie wygeneruje (nie wolno składać ich z fragmentów).
export type NoiseBand = { label: string; text: string; dot: string };

const BANDS = {
  none: { label: 'brak danych', text: 'text-slate-400', dot: 'bg-slate-300' },
  low: { label: 'cicho', text: 'text-green-600', dot: 'bg-green-500' },
  mid: { label: 'umiarkowanie', text: 'text-amber-500', dot: 'bg-amber-400' },
  high: { label: 'głośno', text: 'text-orange-600', dot: 'bg-orange-500' },
  critical: { label: 'bardzo głośno', text: 'text-red-600', dot: 'bg-red-500' },
} satisfies Record<string, NoiseBand>;

/** Dobiera pasmo do poziomu dB; nieaktualny lub brakujący odczyt = szary. */
export function noiseBand(db: number | null, stale: boolean): NoiseBand {
  if (db === null || stale) return BANDS.none;
  if (db < 55) return BANDS.low;
  if (db < 65) return BANDS.mid;
  if (db < 75) return BANDS.high;
  return BANDS.critical;
}
