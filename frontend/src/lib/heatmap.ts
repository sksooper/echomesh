import type { CityEvent, Sensor } from '../api';
import { isLive, MAX_INFLUENCE_M, noiseField } from './noise-model';

type Rgb = [number, number, number];

/** Skala kolorów: dB -> kolor (zielony → żółty → pomarańczowy → czerwony). Używa jej też legenda. */
export const HEAT_STOPS: { db: number; rgb: Rgb }[] = [
  { db: 50, rgb: [34, 197, 94] },
  { db: 60, rgb: [250, 204, 21] },
  { db: 70, rgb: [249, 115, 22] },
  { db: 85, rgb: [220, 38, 38] },
];

export function dbToRgb(db: number): Rgb {
  const first = HEAT_STOPS[0];
  if (db <= first.db) return first.rgb;
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const a = HEAT_STOPS[i - 1];
    const b = HEAT_STOPS[i];
    if (db <= b.db) {
      const t = (db - a.db) / (b.db - a.db); // liniowa interpolacja między dwoma kolorami
      return a.rgb.map((c, k) => Math.round(c + (b.rgb[k] - c) * t)) as Rgb;
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].rgb;
}

const W = 200; // rozdzielczość obrazu; przeglądarka wygładza go przy skalowaniu na mapę
const H = 150;

export type HeatImage = { url: string; bounds: [[number, number], [number, number]] };

/** Rysuje termiczną mapę hałasu na <canvas> i zwraca ją jako obraz razem z zasięgiem geograficznym. */
export function renderHeat(sensors: Sensor[], events: CityEvent[] = []): HeatImage | null {
  const live = sensors.filter(isLive);
  const active = events.filter((e) => e.active);
  // obraz obejmuje czujniki i trwające wydarzenia (wydarzenie podnosi hałas nawet bez czujnika obok)
  const points = [...live, ...active];
  if (points.length === 0) return null;

  // zasięg obrazu = obszar punktów + margines równy zasięgowi wpływu
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = MAX_INFLUENCE_M / 111_320;
  const padLng = MAX_INFLUENCE_M / (111_320 * Math.cos((midLat * Math.PI) / 180));
  const south = Math.min(...lats) - padLat;
  const north = Math.max(...lats) + padLat;
  const west = Math.min(...lngs) - padLng;
  const east = Math.max(...lngs) + padLng;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // piksel -> współrzędne geograficzne (y rośnie w dół, szerokość geograficzna w górę)
      const lat = north - ((y + 0.5) / H) * (north - south);
      const lng = west + ((x + 0.5) / W) * (east - west);
      const { db, influence } = noiseField(lat, lng, live, active);
      const [r, g, b] = dbToRgb(db);
      const alpha = influence * influence * (3 - 2 * influence); // smoothstep: płynnie wygaszane brzegi
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  return { url: canvas.toDataURL('image/png'), bounds: [[south, west], [north, east]] };
}
