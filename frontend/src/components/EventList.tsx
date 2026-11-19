import { useEffect } from 'react';
import type { CityEvent } from '../api';
import { formatRange } from '../lib/time';

type Props = { events: CityEvent[]; selectedId: number | null; onSelect: (id: number) => void };

export default function EventList({ events, selectedId, onSelect }: Props) {
  // po wybraniu wydarzenia (np. kliknięciem strefy na mapie) przewijamy panel do jego karty
  useEffect(() => {
    if (selectedId !== null) {
      document.getElementById(`event-${selectedId}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId]);

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Brak trwających i zaplanowanych wydarzeń.</p>;
  }

  // trwające na górze, potem wg czasu rozpoczęcia
  const sorted = [...events].sort((a, b) => Number(b.active) - Number(a.active) || a.startTime.localeCompare(b.startTime));

  return (
    <ul className="grid gap-3">
      {sorted.map((e) => (
        <li key={e.id}>
          <button
            id={`event-${e.id}`}
            type="button"
            onClick={() => onSelect(e.id)}
            className={`w-full rounded-lg bg-white p-4 text-left shadow ${
              e.id === selectedId ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 hover:ring-slate-400'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{e.title}</h3>
              <span
                className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                  e.active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {e.active ? 'trwa' : 'zaplanowane'}
              </span>
            </div>
            <p className="mt-2 whitespace-nowrap text-sm text-slate-500">{formatRange(e.startTime, e.endTime)}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
