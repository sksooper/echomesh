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
  getPendingReports,
  getSensors,
  Health,
  ModerationItem,
  MyReport,
  Sensor,
  WalkRoute,
} from './api';
import ChatPanel from './components/ChatPanel';
import EventFeed from './components/EventFeed';
import EventList from './components/EventList';
import MapOverlay from './components/MapOverlay';
import ModerationQueue from './components/ModerationQueue';
import MyReportsList from './components/MyReportsList';
import NoiseMap, { LatLngPoint, Layers, MapFocus } from './components/NoiseMap';
import RoutePlanner from './components/RoutePlanner';
import SensorList from './components/SensorList';

type Tab = 'feed' | 'sensors' | 'events' | 'route' | 'reports' | 'moderation';
/** Co oznacza najbliższe kliknięcie na mapie. */
type PickTarget = 'report' | 'from' | 'to' | null;
const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Strumień' },
  { id: 'sensors', label: 'Czujniki' },
  { id: 'events', label: 'Wydarzenia' },
  { id: 'route', label: 'Trasa' },
  { id: 'reports', label: 'Zgłoszenia' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events, setEvents] = useState<CityEvent[]>([]);
  // zatwierdzone zgłoszenia z ostatnich 6 godzin — znaczniki na mapie widoczne dla wszystkich
  const [reportAlerts, setReportAlerts] = useState<AlertItem[]>([]);
  const [myReports, setMyReports] = useState<MyReport[]>([]);
  const [pending, setPending] = useState<ModerationItem[]>([]);
  const [refresh, setRefresh] = useState(0); // zwiększenie wymusza natychmiastowe odświeżenie danych
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  // miejsce zgłoszenia hałasu wskazywane na mapie (używa go okno czatu)
  const [chatOpen, setChatOpen] = useState(false);
  // jedno miejsce decyduje, do czego służy kliknięcie na mapie: zgłoszenie hałasu albo początek / koniec trasy
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [routeFrom, setRouteFrom] = useState<LatLngPoint | null>(null);
  const [routeTo, setRouteTo] = useState<LatLngPoint | null>(null);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [reportPoint, setReportPoint] = useState<LatLngPoint | null>(null);
  const [layers, setLayers] = useState<Layers>({ sensors: true, heat: true, events: true, reports: true });
  // filtry strumienia zdarzeń; minDb = 0 oznacza "bez progu"
  const [filters, setFilters] = useState({ hours: 24, minDb: 0 });

  // moderacja: analityk i administrator (zgodnie z @Roles('analyst') na backendzie)
  const canModerate = user !== null && user.role !== 'resident';

  useEffect(() => {
    // kilka zapytań równolegle; jeśli któreś się nie uda, pokazujemy "brak połączenia"
    const load = () =>
      Promise.all([
        getHealth(),
        getSensors(),
        getAlerts({ hours: filters.hours, minDb: filters.minDb || undefined }),
        getEvents(),
        getMyReports(),
        getAlerts({ source: 'report', hours: 6, limit: 100 }),
        canModerate ? getPendingReports() : Promise.resolve<ModerationItem[]>([]),
      ])
        .then(([h, s, a, ev, mine, reports, queue]) => {
          setHealth(h);
          setSensors(s);
          setAlerts(a);
          setEvents(ev);
          setMyReports(mine);
          setReportAlerts(reports);
          setPending(queue);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    load();
    const id = setInterval(load, 5_000); // odświeżanie co 5 s — widać efekt działania symulatora
    // funkcja sprzątająca: zatrzymuje timer przy odmontowaniu komponentu
    return () => clearInterval(id);
  }, [filters, refresh, canModerate]); // zmiana filtrów lub „refresh” uruchamia efekt ponownie (natychmiastowe odświeżenie)

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

  // Kliknięcie na mapie (lub przeciągnięcie znacznika zgłoszenia): wynik trafia tam, gdzie wskazał pickTarget
  const handlePick = (lat: number, lng: number) => {
    const point = { lat, lng };
    if (pickTarget === 'from') {
      setRouteFrom(point);
      setRoute(null); // zmiana punktu unieważnia policzoną trasę
    } else if (pickTarget === 'to') {
      setRouteTo(point);
      setRoute(null);
    } else {
      setReportPoint(point);
    }
    setPickTarget(null);
  };

  const clearRoute = () => {
    setRouteFrom(null);
    setRouteTo(null);
    setRoute(null);
  };

  // pokazanie miejsca zgłoszenia na mapie
  const focusOn = (lat: number, lng: number) => setFocus((f) => ({ lat, lng, n: (f?.n ?? 0) + 1 }));

  const tabs = canModerate
    ? [...TABS, { id: 'moderation' as Tab, label: pending.length > 0 ? `Moderacja (${pending.length})` : 'Moderacja' }]
    : TABS;

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
            reportAlerts={reportAlerts}
            selectedId={selectedId}
            onSelect={selectSensor}
            selectedEventId={selectedEventId}
            onSelectEvent={selectEvent}
            layers={layers}
            pickMode={pickTarget !== null}
            onPick={handlePick}
            reportPoint={reportPoint}
            focus={focus}
          />
          <MapOverlay layers={layers} onChange={setLayers} />
          {(pickTarget === 'from' || pickTarget === 'to') && (
            <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow">
              Kliknij na mapie {pickTarget === 'from' ? 'punkt startu (A)' : 'punkt docelowy (B)'}
              <button type="button" onClick={() => setPickTarget(null)} className="rounded border border-white/40 px-2 py-0.5 hover:bg-white/10">
                Anuluj
              </button>
            </div>
          )}
          <ChatPanel
            open={chatOpen}
            onOpenChange={setChatOpen}
            pickMode={pickTarget === 'report'}
            onPickModeChange={(pick) => setPickTarget(pick ? 'report' : null)}
            reportPoint={reportPoint}
            onClearPoint={() => setReportPoint(null)}
          />
        </div>

        {/* panel boczny z zakładkami */}
        <aside className="flex min-h-0 w-full flex-col border-t bg-white lg:w-96 lg:border-l lg:border-t-0">
          <nav className="flex overflow-x-auto border-b">
            {tabs.map((t) => (
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
            {tab === 'route' && (
              <RoutePlanner
                from={routeFrom}
                to={routeTo}
                route={route}
                onPick={setPickTarget}
                onRoute={setRoute}
                onClear={clearRoute}
              />
            )}
            {tab === 'reports' && <MyReportsList reports={myReports} onFocus={focusOn} />}
            {tab === 'moderation' && canModerate && (
              <ModerationQueue items={pending} onChanged={() => setRefresh((n) => n + 1)} onFocus={focusOn} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
