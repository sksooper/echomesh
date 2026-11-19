import { HEAT_STOPS } from '../lib/heatmap';
import type { Layers } from './NoiseMap';

type Props = { layers: Layers; onChange: (layers: Layers) => void };

// gradient legendy budujemy z tej samej skali kolorów, której używa mapa termiczna
const MIN_DB = HEAT_STOPS[0].db;
const MAX_DB = HEAT_STOPS[HEAT_STOPS.length - 1].db;
const GRADIENT = `linear-gradient(to right, ${HEAT_STOPS.map(
  (s) => `rgb(${s.rgb.join(',')}) ${((s.db - MIN_DB) / (MAX_DB - MIN_DB)) * 100}%`,
).join(', ')})`;

export default function MapOverlay({ layers, onChange }: Props) {
  const toggles: { key: keyof Layers; label: string }[] = [
    { key: 'sensors', label: 'Czujniki' },
    { key: 'heat', label: 'Mapa termiczna' },
    { key: 'events', label: 'Wydarzenia' },
  ];

  return (
    <>
      <div className="absolute right-3 top-3 z-10 space-y-1 rounded-lg bg-white/95 p-3 text-sm shadow">
        {toggles.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={layers[t.key]}
              onChange={(e) => onChange({ ...layers, [t.key]: e.target.checked })}
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="absolute bottom-6 left-3 z-10 w-56 rounded-lg bg-white/95 p-3 text-xs text-slate-600 shadow">
        <div className="mb-1 whitespace-nowrap font-medium text-slate-800">Poziom hałasu</div>
        <div className="h-2.5 rounded" style={{ background: GRADIENT }} />
        <div className="mt-1 flex justify-between whitespace-nowrap">
          {HEAT_STOPS.map((s) => (
            <span key={s.db}>{s.db === MAX_DB ? `${s.db}+` : s.db}</span>
          ))}
          <span>dB</span>
        </div>
        <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          brak świeżych danych
        </div>
        <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-violet-600 bg-violet-100" />
          trwające wydarzenie
        </div>
        <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-slate-500" />
          zaplanowane wydarzenie
        </div>
      </div>
    </>
  );
}
