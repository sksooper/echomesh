import type { Sensor, SensorStatus } from '../api';
import { noiseBand } from '../lib/noise';
import { timeAgo } from '../lib/time';

const STATUS_LABEL: Record<SensorStatus, string> = {
  active: 'aktywny',
  inactive: 'nieaktywny',
  maintenance: 'serwis',
};

export default function SensorList({ sensors }: { sensors: Sensor[] }) {
  if (sensors.length === 0) return <p className="text-slate-500">Brak czujników.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sensors.map((s) => {
        const band = noiseBand(s.dbLevel, s.stale);
        return (
          <article key={s.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between gap-3">
              <h3 className="whitespace-nowrap font-medium">{s.name}</h3>
              <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            <div className={`mt-3 whitespace-nowrap text-3xl font-semibold ${band.text}`}>
              {s.dbLevel !== null ? s.dbLevel.toFixed(1) : '—'} <span className="text-base font-normal">dB</span>
            </div>
            <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-sm text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-full ${band.dot}`} />
              {band.label} · {timeAgo(s.lastReadingAt)}
            </div>
          </article>
        );
      })}
    </div>
  );
}
