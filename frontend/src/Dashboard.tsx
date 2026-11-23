import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { ROLE_LABEL } from './lib/roles';
import {
  AlertItem,
  CityEvent,
  getAlerts,
  getEvents,
  getHealth,
  getMyReports,
  getSensors,
  Health,
  MyReport,
  Sensor,
} from './api';
import ChatPanel from './components/ChatPanel';
import EventFeed from './components/EventFeed';
import EventList from './components/EventList';
import MapOverlay from './components/MapOverlay';
import MyReportsList from './components/MyReportsList';
import NoiseMap, { LatLngPoint, Layers, MapFocus } from './components/NoiseMap';
import SensorList from './components/SensorList';

type Tab = 'feed' | 'sensors' | 'events' | 'reports';
const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Strumień' },
  { id: 'sensors', label: 'Czujniki' },
  { id: 'events', label: 'Wydarzenia' },
  { id: 'reports', label: 'Zgłoszenia' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [myReports, setMyReports] = useState<MyReport[]>([]);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  // miejsce zgłoszenia hałasu wskazywane na mapie (używa go okno czatu)
  const [chatOpen, setChatOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [reportPoint, setReportPoint] = useState<LatLngPoint | null>(null);
  const [layers, setLayers] = useState<Layers>({ sensors: true, heat: true, events: true });
  // filtry strumienia zdarzeń; minDb = 0 oznacza "bez progu"
  const [filters, setFilters] = useState({ hours: 24, minDb: 0 });

  useEffect(() => {
    // kilka zapytań równolegle; jeśli któreś się nie uda, pokazujemy "brak połączenia"
    const load = () =>
      Promise.all([
        getHealth(),
        getSensors(),
        getAlerts({ hours: filters.hours, minDb: filters.minDb || undefined }),
        getEvents(),
        getMyReports(),
      ])
        .then(([h, s, a, ev, mine]) => {
          setHealth(h);
          setSensors(s);
          setAlerts(a);
          setEvents(ev);
          setMyReports(mine);
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

  // wybór wydarzenia (strefa na mapie lub karta na liście) pokazuje zakładkę z wydarzeniami
  const selectEvent = (id: number) => {
    setSelectedEventId(id);
    setTab('events');
  };

  // pokazanie miejsca zgłoszenia na mapie
  const focusOn = (lat: number, lng: number) => setFocus((f) => ({ lat, lng, n: (f?.n ?? 0) + 1 }));

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
        <div className="flex items-center gap-4 whitespace-nowrap text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
            {statusText}
          </span>
          {user && (
            <span className="hidden sm:inline">
              <span className="font-medium text-slate-900">{user.name}</span> · {ROLE_LABEL[user.role]}
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* mapa zajmuje całą dostępną przestrzeń */}
        <div className="relative min-h-[20rem] flex-1">
          <NoiseMap
            sensors={sensors}
            events={events}
            selectedId={selectedId}
            onSelect={selectSensor}
            selectedEventId={selectedEventId}
            onSelectEvent={selectEvent}
            layers={layers}
            pickMode={pickMode}
            onPick={(lat, lng) => {
              setReportPoint({ lat, lng });
              setPickMode(false);
            }}
            reportPoint={reportPoint}
            focus={focus}
          />
          <MapOverlay layers={layers} onChange={setLayers} />
          <ChatPanel
            open={chatOpen}
            onOpenChange={setChatOpen}
            pickMode={pickMode}
            onPickModeChange={setPickMode}
            reportPoint={reportPoint}
            onClearPoint={() => setReportPoint(null)}
          />
        </div>

        {/* panel boczny z zakładkami */}
        <aside className="flex min-h-0 w-full flex-col border-t bg-white lg:w-96 lg:border-l lg:border-t-0">
          <nav className="flex overflow-x-auto border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
                  tab === t.id ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'feed' && (
              <EventFeed alerts={alerts} hours={filters.hours} minDb={filters.minDb} onChange={setFilters} />
            )}
            {tab === 'sensors' && <SensorList sensors={sensors} selectedId={selectedId} onSelect={selectSensor} />}
            {tab === 'events' && <EventList events={events} selectedId={selectedEventId} onSelect={selectEvent} />}
            {tab === 'reports' && <MyReportsList reports={myReports} onFocus={focusOn} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
