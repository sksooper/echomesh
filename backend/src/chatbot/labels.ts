import type { NoiseType } from './analysis';

/** Nazwy typów hałasu do opisu alertu na mapie. */
export const NOISE_TYPE_LABEL: Record<NoiseType, string> = {
  music: 'głośna muzyka',
  construction: 'prace budowlane',
  traffic: 'hałas uliczny',
  alarm: 'alarm lub syrena',
  fireworks: 'huki i petardy',
  voices: 'krzyki',
  animals: 'szczekanie',
  other: 'hałas',
};

export function alertDescription(noiseType: string | null): string {
  const label = noiseType && noiseType in NOISE_TYPE_LABEL ? NOISE_TYPE_LABEL[noiseType as NoiseType] : NOISE_TYPE_LABEL.other;
  return `Zgłoszenie mieszkańca: ${label}`;
}
