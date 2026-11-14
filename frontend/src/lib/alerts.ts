export type Severity = { label: string; text: string; dot: string };

/** Ważność alertu wynika z poziomu hałasu: >= 85 dB krytyczny, wcześniej (od progu 75 dB) ostrzeżenie. */
export function severity(level: number | null): Severity {
  if (level !== null && level >= 85) return { label: 'krytyczny', text: 'text-red-600', dot: 'bg-red-500' };
  return { label: 'ostrzeżenie', text: 'text-orange-600', dot: 'bg-orange-500' };
}
