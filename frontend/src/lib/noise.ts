// Pasma poziomu hałasu. Pełne nazwy klas Tailwind muszą występować w kodzie,
// inaczej Tailwind ich nie wygeneruje (nie wolno składać ich z fragmentów).
// hex jest potrzebny dla znaczników na mapie (Leaflet nie używa klas Tailwind)
export type NoiseBand = { label: string; text: string; dot: string; hex: string };

const BANDS = {
  none: { label: 'brak danych', text: 'text-slate-400', dot: 'bg-slate-300', hex: '#94a3b8' },
  low: { label: 'cicho', text: 'text-green-600', dot: 'bg-green-500', hex: '#22c55e' },
  mid: { label: 'umiarkowanie', text: 'text-amber-500', dot: 'bg-amber-400', hex: '#f59e0b' },
  high: { label: 'głośno', text: 'text-orange-600', dot: 'bg-orange-500', hex: '#ea580c' },
  critical: { label: 'bardzo głośno', text: 'text-red-600', dot: 'bg-red-500', hex: '#dc2626' },
} satisfies Record<string, NoiseBand>;

/** Dobiera pasmo do poziomu dB; nieaktualny lub brakujący odczyt = szary. */
export function noiseBand(db: number | null, stale: boolean): NoiseBand {
  if (db === null || stale) return BANDS.none;
  if (db < 55) return BANDS.low;
  if (db < 65) return BANDS.mid;
  if (db < 75) return BANDS.high;
  return BANDS.critical;
}
