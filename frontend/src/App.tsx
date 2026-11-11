import { useEffect, useState } from 'react';
import { getHealth, Health } from './api';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const load = () =>
      getHealth()
        .then((h) => {
          setHealth(h);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    load();
    const id = setInterval(load, 10_000); // odświeżanie co 10 s
    // funkcja sprzątająca: zatrzymuje timer przy odmontowaniu komponentu
    return () => clearInterval(id);
  }, []);

  const row = (label: string, ok: boolean, text: string) => (
    <div className="flex items-center justify-between gap-6 py-2">
      <span className="text-slate-600">{label}</span>
      <span className={ok ? 'font-medium text-green-600' : 'font-medium text-red-600'}>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-3">
        <span className="text-xl font-semibold">EchoMesh</span>
      </header>
      <main className="p-6">
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
      </main>
    </div>
  );
}
