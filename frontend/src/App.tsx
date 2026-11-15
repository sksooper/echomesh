import { useEffect, useState } from 'react';
import { AlertItem, getAlerts, getHealth, getSensors, Health, Sensor } from './api';
import EventFeed from './components/EventFeed';
import NoiseMap from './components/NoiseMap';
import SensorList from './components/SensorList';

type Tab = 'feed' | 'sensors';
const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Strumień' },
  { id: 'sensors', label: 'Czujniki' },
];

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // filtry strumienia zdarzeń; minDb = 0 oznacza "bez progu"
  const [filters, setFilters] = useState({ hours: 24, minDb: 0 });

  useEffect(() => {
    // trzy zapytania równolegle; jeśli któreś się nie uda, pokazujemy "brak połączenia"
    const load = () =>
      Promise.all([getHealth(), getSensors(), getAlerts({ hours: filters.hours, minDb: filters.minDb || undefined })])
        .then(([h, s, a]) => {
          setHealth(h);
          setSensors(s);
          setAlerts(a);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    load();
    const id = setInterval(load, 5_000); // odświeżanie co 5 s — widać efekt działania symulatora
    // funkcja sprzątająca: zatrzymuje timer przy odmontowaniu komponentu
    return () => clearInterval(id);
  }, [filters]); // zmiana filtrów uruchamia efekt ponownie (nowy timer i natychmiastowe odświeżenie)

  // wybór czujnika (kliknięcie na mapie lub na liście) pokazuje zakładkę z czujnikami
  const selectSensor = (id: number) => {
    setSelectedId(id);
    setTab('sensors');
  };

  // Stan systemu w nagłówku — bez technicznych szczegółów (wersje PostGIS itp. zostają w /health)
  const ok = !offline && health?.db.up === true;
  const statusText = offline
    ? 'Brak połączenia z serwerem'
    : health && !health.db.up
      ? 'Problem z bazą danych'
      : health
        ? 'System działa'
        : 'Łączenie…';

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between gap-4 border-b bg-white px-6 py-3">
        <span className="whitespace-nowrap text-xl font-semibold">EchoMesh</span>
        <span className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
          <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
          {statusText}
        </span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* mapa zajmuje całą dostępną przestrzeń */}
        <div className="relative min-h-[20rem] flex-1">
          <NoiseMap sensors={sensors} selectedId={selectedId} onSelect={selectSensor} />
        </div>

        {/* panel boczny z zakładkami */}
        <aside className="flex min-h-0 w-full flex-col border-t bg-white lg:w-96 lg:border-l lg:border-t-0">
          <nav className="flex border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
                  tab === t.id ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'feed' ? (
              <EventFeed alerts={alerts} hours={filters.hours} minDb={filters.minDb} onChange={setFilters} />
            ) : (
              <SensorList sensors={sensors} selectedId={selectedId} onSelect={selectSensor} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
