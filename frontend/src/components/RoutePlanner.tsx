import { useState } from 'react';
import { ApiError, walkRoute, WalkRoute } from '../api';
import { formatDistance, formatDuration } from '../lib/format';
import type { LatLngPoint } from './NoiseMap';

export type RoutePickTarget = 'from' | 'to';

type Props = {
  from: LatLngPoint | null;
  to: LatLngPoint | null;
  route: WalkRoute | null;
  /** Włącza wskazywanie punktu na mapie (kliknięcie). */
  onPick: (target: RoutePickTarget) => void;
  onRoute: (route: WalkRoute | null) => void;
  onClear: () => void;
};

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return 'Jeden z punktów jest zbyt daleko od dróg. Wskaż miejsce bliżej ulic lub ścieżek.';
    if (err.status === 404) return 'Nie znaleziono trasy pieszej między tymi punktami.';
    if (err.status === 503) return 'Dane o drogach nie zostały jeszcze zaimportowane.';
  }
  return 'Nie udało się wyznaczyć trasy. Spróbuj ponownie.';
}

const label = (p: LatLngPoint | null) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : 'nie wybrano');

/** Planowanie trasy: punkty A i B wskazuje się na mapie; wynik (dystans, czas) pokazujemy tutaj, a linię na mapie. */
export default function RoutePlanner({ from, to, route, onPick, onRoute, onClear }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = async () => {
    if (!from || !to) return;
    setBusy(true);
    setError(null);
    try {
      onRoute(await walkRoute(from, to));
    } catch (e) {
      onRoute(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const point = (name: string, value: LatLngPoint | null, target: RoutePickTarget) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{name}</div>
        <div className="whitespace-nowrap text-sm">{label(value)}</div>
      </div>
      <button
        type="button"
        onClick={() => onPick(target)}
        className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
      >
        {value ? 'Zmień' : 'Wskaż na mapie'}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium text-slate-500">Sposób poruszania się</div>
        <div className="mt-1 inline-block whitespace-nowrap rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white">Pieszo</div>
      </div>

      {point('Start (A)', from, 'from')}
      {point('Cel (B)', to, 'to')}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={compute}
          disabled={!from || !to || busy}
          className="flex-1 whitespace-nowrap rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Liczę…' : 'Wyznacz trasę'}
        </button>
        {(from || to || route) && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClear();
            }}
            className="whitespace-nowrap rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Wyczyść
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {route && (
        <div className="rounded-lg bg-white p-4 shadow ring-1 ring-slate-200">
          <div className="text-xs font-medium text-slate-500">Najkrótsza trasa piesza</div>
          <div className="mt-1 flex items-baseline gap-4 whitespace-nowrap">
            <span className="text-2xl font-semibold">{formatDistance(route.distanceM)}</span>
            <span className="text-slate-600">ok. {formatDuration(route.durationMin)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
