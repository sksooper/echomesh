import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface WalkRoute {
  /** Punkty trasy jako pary [szerokość, długość] — od startu do celu. */
  coordinates: [number, number][];
  distanceM: number;
  durationMin: number;
}

const WALK_SPEED_M_PER_MIN = 5_000 / 60; // 5 km/h
const MAX_SNAP_M = 500; // dalej niż 500 m od najbliższej drogi punkt uznajemy za "poza siecią dróg"

interface Snapped {
  id: number;
  dist: number; // odległość punktu od wierzchołka grafu (m)
}

/** Odległość w metrach między dwoma punktami (wzór haversine) — do trasy "z miejsca do tego samego miejsca". */
function haversineM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

@Injectable()
export class RoutesService {
  constructor(private db: DbService) {}

  /** Najkrótsza trasa piesza po sieci dróg OSM (algorytm Dijkstry z pgRouting). */
  async walk(from: LatLng, to: LatLng): Promise<WalkRoute> {
    try {
      const start = await this.snap(from);
      const end = await this.snap(to);

      // Ten sam wierzchołek: nie ma czego liczyć
      if (start.id === end.id) {
        const distanceM = haversineM(from, to);
        return { coordinates: [[from.lat, from.lng], [to.lat, to.lng]], distanceM: Math.round(distanceM), durationMin: this.minutes(distanceM) };
      }

      // pgr_dijkstra(zapytanie_o_krawędzie, start, cel, czy_skierowany). Graf jest nieskierowany (piesi idą w obie strony),
      // więc koszt "tam" i "z powrotem" to ta sama długość odcinka.
      const rows = await this.db.query<{ lat: number; lng: number; aggCost: number }>(
        `SELECT ST_Y(v.geom) AS lat, ST_X(v.geom) AS lng, d.agg_cost AS "aggCost"
         FROM pgr_dijkstra($1::text, $2::bigint, $3::bigint, false) d
         JOIN road_vertices v ON v.id = d.node
         ORDER BY d.path_seq`,
        [this.edgesSql(from, to), start.id, end.id],
      );
      if (rows.length === 0) throw new NotFoundException('No walking route found between these points');

      // Krawędzie to proste odcinki między węzłami OSM, więc łamana przez wierzchołki trasy jest dokładnym przebiegiem.
      // Doklejamy punkty wskazane przez użytkownika (mogą leżeć kilkadziesiąt metrów od drogi).
      const pathM = rows[rows.length - 1].aggCost;
      const distanceM = pathM + start.dist + end.dist;
      return {
        coordinates: [[from.lat, from.lng], ...rows.map((r): [number, number] => [r.lat, r.lng]), [to.lat, to.lng]],
        distanceM: Math.round(distanceM),
        durationMin: this.minutes(distanceM),
      };
    } catch (e) {
      // 42P01 = undefined_table: import dróg jeszcze nie został wykonany
      if ((e as { code?: string }).code === '42P01') throw this.notImported();
      throw e;
    }
  }

  /** Najbliższy wierzchołek grafu (indeks GIST + operator <->). Odrzuca punkty zbyt odległe od dróg. */
  private async snap(point: LatLng): Promise<Snapped> {
    const [row] = await this.db.query<Snapped>(
      `SELECT v.id::float8 AS id,
              ST_Distance(v.geom::geography, ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography) AS dist
       FROM road_vertices v
       ORDER BY v.geom <-> ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
       LIMIT 1`,
      [point.lng, point.lat], // ST_MakePoint(długość, szerokość)
    );
    if (!row) throw this.notImported();
    if (row.dist > MAX_SNAP_M) throw new BadRequestException('Point is too far from the road network');
    return row;
  }

  /**
   * Zapytanie o krawędzie przekazywane do pgr_dijkstra. Ograniczamy je do prostokąta wokół startu i celu (z zapasem),
   * żeby algorytm nie ładował całej sieci dróg przy każdym zapytaniu. Wstawiamy tylko liczby z własnych obliczeń.
   */
  private edgesSql(a: LatLng, b: LatLng): string {
    const pad = Math.max(0.02, 0.5 * Math.max(Math.abs(a.lat - b.lat), Math.abs(a.lng - b.lng)));
    const west = Math.min(a.lng, b.lng) - pad;
    const east = Math.max(a.lng, b.lng) + pad;
    const south = Math.min(a.lat, b.lat) - pad;
    const north = Math.max(a.lat, b.lat) + pad;
    return (
      `SELECT id, source, target, length_m AS cost, length_m AS reverse_cost FROM road_edges ` +
      `WHERE geom && ST_MakeEnvelope(${west.toFixed(6)}, ${south.toFixed(6)}, ${east.toFixed(6)}, ${north.toFixed(6)}, 4326)`
    );
  }

  private minutes(distanceM: number): number {
    return Math.max(1, Math.round(distanceM / WALK_SPEED_M_PER_MIN));
  }

  private notImported() {
    return new ServiceUnavailableException('Road network is not imported yet (run: npm run import:osm)');
  }
}
