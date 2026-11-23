import { useState } from 'react';
import { ApiError, ModerationItem, reviewReport } from '../api';
import { NOISE_TYPE_LABEL } from '../lib/reports';
import { timeAgo } from '../lib/time';

type Props = {
  items: ModerationItem[];
  /** Odświeża dane po decyzji (kolejka, strumień alertów, marker na mapie). */
  onChanged: () => void;
  onFocus: (lat: number, lng: number) => void;
};

const SETTING_LABEL: Record<string, string> = { outdoor: 'na zewnątrz', indoor: 'w budynku' };

/** Kolejka zgłoszeń czekających na decyzję analityka lub administratora. */
export default function ModerationQueue({ items, onChanged, onFocus }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    setError(null);
    try {
      await reviewReport(id, decision);
    } catch (e) {
      // 409: ktoś inny już rozpatrzył to zgłoszenie
      setError(e instanceof ApiError && e.status === 409 ? 'Zgłoszenie zostało już rozpatrzone.' : 'Nie udało się zapisać decyzji.');
    } finally {
      setBusyId(null);
      onChanged();
    }
  };

  if (items.length === 0) return <p className="text-sm text-slate-500">Brak zgłoszeń do rozpatrzenia.</p>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="grid gap-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-lg bg-white p-4 shadow ring-1 ring-slate-200">
            <div className="flex items-baseline justify-between gap-3 whitespace-nowrap text-xs text-slate-500">
              <span className="font-medium text-slate-700">{r.userName}</span>
              <span>{timeAgo(r.createdAt)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                {r.noiseType ? (NOISE_TYPE_LABEL[r.noiseType] ?? r.noiseType) : 'Typ nieokreślony'}
              </span>
              {r.setting && (
                <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                  {SETTING_LABEL[r.setting] ?? r.setting}
                </span>
              )}
              {r.usedLlm && <span className="whitespace-nowrap rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">analiza LLM</span>}
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onFocus(r.lat, r.lng)}
                className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                Pokaż na mapie
              </button>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'rejected')}
                  className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Odrzuć
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'approved')}
                  className="whitespace-nowrap rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Zatwierdź
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
