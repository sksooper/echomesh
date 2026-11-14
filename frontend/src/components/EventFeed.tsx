import type { AlertItem } from '../api';
import { severity } from '../lib/alerts';
import { timeAgo } from '../lib/time';

export default function EventFeed({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 whitespace-nowrap font-medium">Strumień zdarzeń</h2>

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
