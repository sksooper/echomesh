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

export type AlertItem = {
  id: number;
  sensorId: number;
  sensorName: string;
  level: number | null;
  description: string;
  source: 'measurement' | 'report';
  createdAt: string; // ISO
};

export type AlertQuery = { hours?: number; minDb?: number; sensorId?: number; limit?: number };

export type CityEvent = {
  id: number;
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  lat: number;
  lng: number;
  radiusM: number; // promień strefy wydarzenia
  active: boolean; // czy trwa w tej chwili
};

/** Jedno miejsce na fetch + obsługę błędów HTTP — kolejne endpointy będą z niego korzystać. */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const getHealth = () => req<Health>('/health');
export const getSensors = () => req<Sensor[]>('/sensors');

export function getAlerts(q: AlertQuery = {}) {
  const params = new URLSearchParams();
  // pomijamy nieustawione filtry, żeby nie wysyłać "minDb=undefined"
  Object.entries(q).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
  return req<AlertItem[]>(`/alerts?${params}`);
}

// domyślnie backend zwraca trwające i zaplanowane wydarzenia (scope=current)
export const getEvents = () => req<CityEvent[]>('/city-events');
