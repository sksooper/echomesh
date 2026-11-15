import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Sensor } from '../api';
import { noiseBand } from '../lib/noise';
import { timeAgo } from '../lib/time';

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

type Props = { sensors: Sensor[]; selectedId: number | null; onSelect: (id: number) => void };

export default function NoiseMap({ sensors, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
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

  // 3) wybór czujnika (z mapy lub z listy) przesuwa mapę na ten czujnik
  useEffect(() => {
    const map = mapRef.current;
    const s = sensors.find((x) => x.id === selectedId);
    if (map && s) map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    // celowo tylko selectedId — nie chcemy przesuwać mapy przy każdym odświeżeniu danych
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
