/*
 * Klient Overpass API (OpenStreetMap): pobiera drogi i ścieżki, po których można chodzić pieszo, z zadanego obszaru.
 * Overpass to publiczny, darmowy serwis — uprzejmie ograniczamy się do jednego zapytania na import
 * i ponawiamy próbę (z przerwą), gdy serwer jest zajęty.
 */

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Fragment drogi z OSM z geometrią: nodes = id węzłów, geometry = ich współrzędne (w tej samej kolejności). */
export interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Domyślny obszar: centrum Wrocławia (obejmuje wszystkie czujniki z danych demo). */
export const DEFAULT_BBOX = '51.065,16.995,51.135,17.105';

/** Parsuje "południe,zachód,północ,wschód" (np. z OSM_BBOX) i sprawdza poprawność. */
export function parseBBox(text: string): BBox {
  const parts = text.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`OSM_BBOX musi mieć postać "południe,zachód,północ,wschód", a jest: "${text}"`);
  }
  const [south, west, north, east] = parts;
  if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
    throw new Error(`OSM_BBOX ma niepoprawny zakres: "${text}"`);
  }
  return { south, west, north, east };
}

// Typy dróg dostępne dla pieszych (autostrady i drogi ekspresowe pomijamy)
const WALKABLE = [
  'footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential', 'service', 'unclassified',
  'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link', 'track', 'road',
].join('|');

/**
 * Zapytanie Overpass QL:
 *  - drogi z listy WALKABLE, bez zakazu wstępu pieszym (foot=no) i bez dróg prywatnych,
 *  - ścieżki rowerowe tylko tam, gdzie piesi mają wyraźne pozwolenie,
 *  - "out geom" zwraca dla każdej drogi listę węzłów i ich współrzędne.
 */
export function buildQuery(bbox: BBox, timeoutSeconds = 180): string {
  const area = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  return [
    `[out:json][timeout:${timeoutSeconds}];`,
    '(',
    `  way["highway"~"^(${WALKABLE})$"]["foot"!~"^(no|private)$"]["access"!~"^(private|no)$"]["service"!~"^(driveway|parking_aisle)$"]${area};`,
    `  way["highway"="cycleway"]["foot"~"^(yes|designated|permissive)$"]${area};`,
    ');',
    'out geom;',
  ].join('\n');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pobiera drogi z kolejnych serwerów Overpass; do 3 prób, z rosnącą przerwą przy przeciążeniu (429/503/504). */
export async function fetchWays(bbox: BBox, endpoints: string[], log: (msg: string) => void = console.log): Promise<OverpassWay[]> {
  const query = buildQuery(bbox);
  const attempts = 3;
  let lastError = 'brak odpowiedzi';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const endpoint = endpoints[(attempt - 1) % endpoints.length];
    try {
      log(`Overpass (${endpoint}), próba ${attempt}/${attempts}…`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EchoMesh-student-project/1.0' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(240_000),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if ([429, 502, 503, 504].includes(res.status)) {
          await sleep(5_000 * attempt);
          continue;
        }
        throw new Error(`Overpass zwrócił ${lastError}`);
      }
      const data = (await res.json()) as { elements?: OverpassWay[] };
      // zostawiamy tylko poprawne drogi: węzły i geometria muszą się zgadzać
      return (data.elements ?? []).filter(
        (e) => e.type === 'way' && Array.isArray(e.nodes) && Array.isArray(e.geometry) && e.nodes.length === e.geometry.length && e.nodes.length >= 2,
      );
    } catch (e) {
      lastError = (e as Error).message;
      log(`Próba ${attempt} nieudana: ${lastError}`);
      if (attempt < attempts) await sleep(5_000 * attempt);
    }
  }
  throw new Error(`Nie udało się pobrać danych z Overpass (${lastError}). Spróbuj ponownie za kilka minut.`);
}
