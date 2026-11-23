import type { ReviewStatus, ReportStatus } from '../api';

export const NOISE_TYPE_LABEL: Record<string, string> = {
  music: 'Muzyka / impreza',
  construction: 'Prace budowlane',
  traffic: 'Hałas uliczny',
  alarm: 'Alarm / syrena',
  fireworks: 'Huki i petardy',
  voices: 'Krzyki',
  animals: 'Zwierzęta',
  other: 'Inny hałas',
};

/** Stan zgłoszenia opisany dla użytkownika: status automatyczny + decyzja moderatora. */
export function reportState(status: ReportStatus, review: ReviewStatus): { label: string; cls: string } {
  if (status === 'planned') return { label: 'Zaplanowane wydarzenie', cls: 'bg-violet-100 text-violet-700' };
  if (status === 'needs_info') return { label: 'Wymaga doprecyzowania', cls: 'bg-slate-100 text-slate-700' };
  if (review === 'approved') return { label: 'Zatwierdzone — widoczne na mapie', cls: 'bg-green-100 text-green-800' };
  if (review === 'rejected') return { label: 'Odrzucone przez analityka', cls: 'bg-red-100 text-red-700' };
  return { label: 'Czeka na moderację', cls: 'bg-amber-100 text-amber-800' };
}
