// Adres API z zmiennej środowiskowej Vite (prefiks VITE_ jest wymagany, żeby trafiła do przeglądarki)
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Health = {
  status: 'ok' | 'degraded';
  db: { up: boolean; postgis?: string; pgrouting?: string | null };
};

export type SensorStatus = 'active' | 'inactive' | 'maintenance';

export type Sensor = {
  id: number;
  name: string;
  status: SensorStatus;
  lat: number;
  lng: number;
  dbLevel: number | null; // ostatni odczyt
  lastReadingAt: string | null; // ISO
  stale: boolean; // odczyt nieaktualny (> 60 min) lub brak
};

/** Jedno miejsce na fetch + obsługę błędów HTTP — kolejne endpointy będą z niego korzystać. */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const getHealth = () => req<Health>('/health');
export const getSensors = () => req<Sensor[]>('/sensors');
