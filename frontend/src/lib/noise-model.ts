import type { Sensor } from '../api';

/** Tło miejskie (dB), gdy w pobliżu nie ma żadnego czujnika. */
export const BACKGROUND_DB = 50;
/** Zasięg wpływu czujnika (m) — dalej poziom wraca do tła. */
export const MAX_INFLUENCE_M = 1500;
/** Wykładnik IDW: im większy, tym mocniej liczy się najbliższy czujnik. */
const POWER = 2;
const EARTH_R = 6_371_000;

/** Odległość w metrach (przybliżenie równoprostokątne — wystarczające na skalę miasta). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  return EARTH_R * Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Czujnik wchodzi do modelu, gdy jest aktywny i ma świeży odczyt (< 60 min). */
export function isLive(s: Sensor): boolean {
  return s.status === 'active' && !s.stale && s.dbLevel !== null;
}

/**
 * Model hałasu w punkcie: interpolacja IDW (Inverse Distance Weighting) z odczytów czujników.
 *   idw = Σ(dB_i / d_i²) / Σ(1 / d_i²)
 * Wynik mieszamy z tłem: im dalej od najbliższego czujnika, tym mniejszy "influence" (0…1),
 * a poziom zbliża się do BACKGROUND_DB.
 */
export function noiseField(lat: number, lng: number, sensors: Sensor[]): { db: number; influence: number } {
  let num = 0;
  let den = 0;
  let nearest = Infinity;

  for (const s of sensors) {
    if (!isLive(s)) continue;
    const d = Math.max(distanceM(lat, lng, s.lat, s.lng), 1); // min. 1 m — unikamy dzielenia przez 0
    nearest = Math.min(nearest, d);
    const w = 1 / d ** POWER;
    num += w * (s.dbLevel as number);
    den += w;
  }
  if (den === 0) return { db: BACKGROUND_DB, influence: 0 };

  const influence = Math.max(0, 1 - nearest / MAX_INFLUENCE_M);
  const idw = num / den;
  return { db: BACKGROUND_DB + (idw - BACKGROUND_DB) * influence, influence };
}

export const noiseAt = (lat: number, lng: number, sensors: Sensor[]) => noiseField(lat, lng, sensors).db;
