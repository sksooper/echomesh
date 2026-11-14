import type { AlertItem } from '../api';
import { severity } from '../lib/alerts';
import { timeAgo } from '../lib/time';

const HOURS = [
  { value: 1, label: '1 h' },
  { value: 6, label: '6 h' },
  { value: 24, label: '24 h' },
  { value: 72, label: '3 dni' },
];
const MIN_DB = [
  { value: 0, label: 'wszystkie' },
  { value: 75, label: '≥ 75 dB' },
  { value: 85, label: '≥ 85 dB' },
];

type Props = {
  alerts: AlertItem[];
  hours: number;
  minDb: number;
  onChange: (f: { hours: number; minDb: number }) => void;
};

export default function EventFeed({ alerts, hours, minDb, onChange }: Props) {
  const select = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm';

  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 whitespace-nowrap font-medium">Strumień zdarzeń</h2>

      <div className="mb-3 flex flex-wrap items-center gap-3 whitespace-nowrap text-sm text-slate-600">
        <label className="flex items-center gap-2">
          Zakres
          <select className={select} value={hours} onChange={(e) => onChange({ hours: Number(e.target.value), minDb })}>
            {HOURS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Próg
          <select className={select} value={minDb} onChange={(e) => onChange({ hours, minDb: Number(e.target.value) })}>
            {MIN_DB.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-slate-500">Brak alertów w wybranym zakresie.</p>
      ) : (
        <ul className="max-h-[32rem] divide-y overflow-y-auto">
          {alerts.map((a) => {
            const sev = severity(a.level);
            return (
              <li key={a.id} className="flex gap-3 py-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 whitespace-nowrap">
                    <span className="font-medium">{a.sensorName}</span>
                    <span className={`font-semibold ${sev.text}`}>
                      {a.level !== null ? a.level.toFixed(1) : '—'} dB
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{a.description}</p>
                  <p className="text-xs text-slate-400">
                    {sev.label} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
