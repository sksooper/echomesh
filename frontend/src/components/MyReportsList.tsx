import type { MyReport } from '../api';
import { NOISE_TYPE_LABEL, reportState } from '../lib/reports';
import { timeAgo } from '../lib/time';

type Props = { reports: MyReport[]; onFocus: (lat: number, lng: number) => void };

export default function MyReportsList({ reports, onFocus }: Props) {
  if (reports.length === 0) {
    return <p className="text-sm text-slate-500">Nie masz jeszcze zgłoszeń. Użyj przycisku „Zgłoś hałas” nad mapą.</p>;
  }

  return (
    <ul className="grid gap-3">
      {reports.map((r) => {
        const state = reportState(r.status, r.reviewStatus);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onFocus(r.lat, r.lng)}
              className="w-full rounded-lg bg-white p-4 text-left shadow ring-1 ring-slate-200 hover:ring-slate-400"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${state.cls}`}>{state.label}</span>
                <span className="whitespace-nowrap text-xs text-slate-400">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm">{r.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                {r.noiseType ? (NOISE_TYPE_LABEL[r.noiseType] ?? r.noiseType) : 'Typ nieokreślony'}
                {r.eventTitle ? ` · „${r.eventTitle}”` : ''}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
