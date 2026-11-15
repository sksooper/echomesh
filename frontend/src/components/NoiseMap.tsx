import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // style Leaflet (bez nich kafelki mapy się rozsypują)

const WROCLAW: L.LatLngTuple = [51.1079, 17.0385];

export default function NoiseMap() {
  const el = useRef<HTMLDivElement>(null); // kontener DOM, w którym Leaflet zbuduje mapę

  useEffect(() => {
    const map = L.map(el.current!, { center: WROCLAW, zoom: 13 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© autorzy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // sprzątanie: Leaflet pracuje poza Reactem, więc mapę trzeba zniszczyć ręcznie
    return () => {
      map.remove();
    };
  }, []);

  return <div ref={el} className="h-full w-full" />;
}
