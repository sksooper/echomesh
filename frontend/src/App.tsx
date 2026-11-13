import { useEffect, useState } from 'react';
import { getHealth, getSensors, Health, Sensor } from './api';
import SensorList from './components/SensorList';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // dwa zapytania równolegle; jeśli któreś się nie uda, pokazujemy "brak połączenia"
    const load = () =>
      Promise.all([getHealth(), getSensors()])
        .then(([h, s]) => {
          setHealth(h);
          setSensors(s);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    load();
    const id = setInterval(load, 5_000); // odświeżanie co 5 s — widać efekt działania symulatora
    // funkcja sprzątająca: zatrzymuje timer przy odmontowaniu komponentu
    return () => clearInterval(id);
  }, []);

  const row = (label: string, ok: boolean, text: string) => (
    <div className="flex items-center justify-between gap-6 whitespace-nowrap py-2">
      <span className="text-slate-600">{label}</span>
      <span className={ok ? 'font-medium text-green-600' : 'font-medium text-red-600'}>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-3">
        <span className="text-xl font-semibold">EchoMesh</span>
      </header>
      <main className="space-y-8 p-6">
        <section className="max-w-md divide-y rounded-lg bg-white p-4 shadow">
          <h2 className="pb-2 font-medium">Stan systemu</h2>
          {row('Backend (API)', !offline && !!health, offline ? 'brak połączenia' : health ? 'działa' : 'sprawdzam…')}
          {row('Baza danych', !!health?.db.up, health ? (health.db.up ? 'połączona' : 'niedostępna') : '—')}
          {health?.db.up && (
            <div className="space-y-1 py-2 text-sm text-slate-500">
              <div>PostGIS: {health.db.postgis}</div>
              <div>pgRouting: {health.db.pgrouting ?? 'brak'}</div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-medium">Czujniki</h2>
          <SensorList sensors={sensors} />
        </section>
      </main>
    </div>
  );
}
