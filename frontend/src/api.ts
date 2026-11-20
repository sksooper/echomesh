// Adres API z zmiennej środowiskowej Vite (prefiks VITE_ jest wymagany, żeby trafiła do przeglądarki)
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Health = {
  status: 'ok' | 'degraded';
  db: { up: boolean; postgis?: string; pgrouting?: string | null };
};

export type Role = 'resident' | 'analyst' | 'admin';

export type User = { id: number; name: string; email: string; role: Role; createdAt: string };

export type AuthResult = { token: string; user: User };

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

const TOKEN_KEY = 'echomesh.token';

/**
 * Token JWT trzymamy w localStorage, żeby przetrwał odświeżenie strony. Kompromis: token jest dostępny
 * dla skryptów na stronie, więc ważne jest unikanie XSS (React domyślnie escapuje treści).
 */
export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* np. tryb prywatny — sesja potrwa do odświeżenia */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignorujemy */
    }
  },
};

/** Błąd odpowiedzi HTTP z kodem statusu — UI wybiera po nim komunikat dla użytkownika. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Wywoływane, gdy serwer odrzuci token (wygasł / konto usunięte) — AuthProvider wylogowuje wtedy użytkownika
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

// NestJS zwraca { message: string | string[] } — wyciągamy z tego tekst
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return Array.isArray(body.message) ? body.message.join(', ') : String(body.message ?? res.statusText);
  } catch {
    return res.statusText;
  }
}

/** Jedno miejsce na fetch: dokleja token, zamienia błędy HTTP na ApiError i obsługuje 204 (brak treści). */
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    // 401 z tokenem = sesja nieważna. (Zła próba logowania idzie bez tokenu, więc nie wylogowuje.)
    if (res.status === 401 && token) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res.status === 204 ? (undefined as T) : res.json();
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

export const login = (email: string, password: string) =>
  req<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (name: string, email: string, password: string) =>
  req<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });

/** Kim jestem według serwera (przywracanie sesji po odświeżeniu strony). */
export const getMe = () => req<User>('/auth/me');
