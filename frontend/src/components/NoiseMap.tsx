import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Sensor } from '../api';
import { renderHeat } from '../lib/heatmap';
import { noiseBand } from '../lib/noise';
import { timeAgo } from '../lib/time';

export type Layers = { sensors: boolean; heat: boolean };

const WROCLAW: L.LatLngTuple = [51.1079, 17.0385];
const TOOLTIP = { direction: 'top' as const, offset: [0, -10] as L.PointTuple };

function sensorIcon(color: string, stale: boolean, selected: boolean) {
  return L.divIcon({
    className: `sensor-marker${stale ? ' sensor-stale' : ''}${selected ? ' sensor-selected' : ''}`,
    html: `<span class="sensor-pulse" style="--c:${color}"></span><span class="sensor-dot" style="background:${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Treść podpowiedzi budujemy jako element DOM (textContent) — nazwa czujnika nie jest interpretowana jako HTML
function tooltip(s: Sensor) {
  const el = document.createElement('div');
  const level = s.dbLevel !== null ? `${s.dbLevel.toFixed(1)} dB` : 'brak danych';
  el.textContent = `${s.name}: ${level} · ${timeAgo(s.lastReadingAt)}`;
  return el;
}

type Props = {
  sensors: Sensor[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  layers: Layers;
};

export default function NoiseMap({ sensors, selectedId, onSelect, layers }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.ImageOverlay | null>(null);
  // id czujnika -> znacznik + "sygnatura" wyglądu (żeby nie podmieniać ikony, gdy nic się nie zmieniło)
  const markers = useRef(new Map<number, { marker: L.Marker; sig: string }>());
  // znaczniki powstają raz, więc handler kliknięcia czyta AKTUALNĄ funkcję z ref-a (inaczej zostałaby stara)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 1) jednorazowa inicjalizacja mapy
  useEffect(() => {
    const map = L.map(el.current!, { center: WROCLAW, zoom: 13 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© autorzy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      heatRef.current = null;
      markers.current.clear();
    };
  }, []);

  // 2) przy każdej zmianie danych aktualizujemy znaczniki, zamiast budować mapę od nowa
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const seen = new Set<number>();
    for (const s of sensors) {
      seen.add(s.id);
      const band = noiseBand(s.dbLevel, s.stale);
      const selected = s.id === selectedId;
      const sig = `${band.hex}|${s.stale}|${selected}`;
      const entry = markers.current.get(s.id);

      if (!entry) {
        const marker = L.marker([s.lat, s.lng], { icon: sensorIcon(band.hex, s.stale, selected) })
          .bindTooltip(tooltip(s), TOOLTIP)
          .on('click', () => onSelectRef.current(s.id))
          .addTo(group);
        markers.current.set(s.id, { marker, sig });
      } else {
        entry.marker.setTooltipContent(tooltip(s));
        if (entry.sig !== sig) {
          entry.marker.setIcon(sensorIcon(band.hex, s.stale, selected));
          entry.sig = sig;
        }
      }
    }
    // usuwamy znaczniki czujników, których już nie ma w danych
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [sensors, selectedId]);

  // 3) termiczna mapa hałasu: obraz rysowany z modelu IDW i nakładany na mapę (ImageOverlay)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const heat = layers.heat ? renderHeat(sensors) : null; // warstwa wyłączona = usuwamy nakładkę
    if (!heat) {
      heatRef.current?.remove();
      heatRef.current = null;
      return;
    }
    if (heatRef.current) {
      heatRef.current.setUrl(heat.url);
      heatRef.current.setBounds(L.latLngBounds(heat.bounds));
    } else {
      heatRef.current = L.imageOverlay(heat.url, heat.bounds, { opacity: 0.6, interactive: false }).addTo(map);
    }
  }, [sensors, layers.heat]);

  // 4) przełącznik warstwy czujników: pokazujemy / chowamy całą grupę znaczników
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    if (layers.sensors) group.addTo(map);
    else group.remove();
  }, [layers.sensors]);

  // 5) wybór czujnika (z mapy lub z listy) przesuwa mapę na ten czujnik
  useEffect(() => {
    const map = mapRef.current;
    const s = sensors.find((x) => x.id === selectedId);
    if (map && s) map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    // celowo tylko selectedId — nie chcemy przesuwać mapy przy każdym odświeżeniu danych
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // isolate: z-index warstw Leaflet nie wychodzi poza mapę, więc legenda (z-10) zawsze jest nad nią
  return <div ref={el} className="isolate h-full w-full" />;
}
