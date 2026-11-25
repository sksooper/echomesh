import type { OverpassWay } from './overpass';

export interface Vertex {
  id: number;
  lng: number;
  lat: number;
}

/** Odcinek drogi między dwoma sąsiednimi węzłami OSM. */
export interface Edge {
  wayId: number;
  source: number;
  target: number;
  highway: string;
  lng1: number;
  lat1: number;
  lng2: number;
  lat2: number;
}

export interface Graph {
  vertices: Vertex[];
  edges: Edge[];
}

/**
 * Zamienia drogi z OSM na graf: każda droga to ciąg węzłów, a każda para sąsiednich węzłów to krawędź.
 * Drogi, które mają wspólny węzeł (skrzyżowanie), współdzielą ten sam wierzchołek — dzięki temu graf jest spójny
 * i można nim przejść z jednej drogi na drugą. Odcinki powtórzone w kilku drogach liczymy raz.
 */
export function buildGraph(ways: OverpassWay[]): Graph {
  const vertices = new Map<number, Vertex>();
  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const way of ways) {
    const highway = way.tags?.highway ?? 'unknown';
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const a = way.nodes[i];
      const b = way.nodes[i + 1];
      if (a === b) continue; // zdegenerowany odcinek

      const pa = way.geometry[i];
      const pb = way.geometry[i + 1];
      if (!vertices.has(a)) vertices.set(a, { id: a, lng: pa.lon, lat: pa.lat });
      if (!vertices.has(b)) vertices.set(b, { id: b, lng: pb.lon, lat: pb.lat });

      const key = a < b ? `${a}-${b}` : `${b}-${a}`; // para nieuporządkowana: A–B to to samo co B–A
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({ wayId: way.id, source: a, target: b, highway, lng1: pa.lon, lat1: pa.lat, lng2: pb.lon, lat2: pb.lat });
    }
  }
  return { vertices: [...vertices.values()], edges };
}
