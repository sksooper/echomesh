/*
 * Import sieci dróg pieszych z OpenStreetMap do PostgreSQL (graf dla pgRouting).
 * Uruchomienie (w działającym kontenerze backendu):  docker compose exec backend npm run import:osm
 * Import jest idempotentny: przy ponownym uruchomieniu stare dane są zastępowane nowymi.
 */
import { Pool } from 'pg';
import { buildGraph, Edge, Vertex } from './graph';
import { DEFAULT_BBOX, fetchWays, parseBBox } from './overpass';
import { ROADS_INDEX_SQL, ROADS_SCHEMA_SQL } from './roads-schema';

const BATCH = 5_000;

const chunks = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

type Client = { query: (text: string, params?: unknown[]) => Promise<unknown> };

// Wstawianie partiami przez unnest(): jedno zapytanie = tysiące wierszy, znacznie szybciej niż INSERT po jednym
async function insertVertices(client: Client, vertices: Vertex[]) {
  for (const batch of chunks(vertices, BATCH)) {
    await client.query(
      `INSERT INTO road_vertices (id, geom)
       SELECT id, ST_SetSRID(ST_MakePoint(lng, lat), 4326)
       FROM unnest($1::bigint[], $2::float8[], $3::float8[]) AS t(id, lng, lat)`,
      [batch.map((v) => v.id), batch.map((v) => v.lng), batch.map((v) => v.lat)],
    );
  }
}

async function insertEdges(client: Client, edges: Edge[]) {
  for (const batch of chunks(edges, BATCH)) {
    await client.query(
      `INSERT INTO road_edges (osm_way_id, source, target, highway, length_m, geom)
       SELECT way_id, source, target, highway, ST_Length(g::geography), g
       FROM (
         SELECT way_id, source, target, highway,
                ST_SetSRID(ST_MakeLine(ST_MakePoint(lng1, lat1), ST_MakePoint(lng2, lat2)), 4326) AS g
         FROM unnest($1::bigint[], $2::bigint[], $3::bigint[], $4::text[], $5::float8[], $6::float8[], $7::float8[], $8::float8[])
              AS t(way_id, source, target, highway, lng1, lat1, lng2, lat2)
       ) s`,
      [
        batch.map((e) => e.wayId),
        batch.map((e) => e.source),
        batch.map((e) => e.target),
        batch.map((e) => e.highway),
        batch.map((e) => e.lng1),
        batch.map((e) => e.lat1),
        batch.map((e) => e.lng2),
        batch.map((e) => e.lat2),
      ],
    );
  }
}

async function main() {
  const bbox = parseBBox(process.env.OSM_BBOX ?? DEFAULT_BBOX);
  const endpoints = (process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Obszar: ${JSON.stringify(bbox)}`);
  const ways = await fetchWays(bbox, endpoints);
  console.log(`Pobrano dróg: ${ways.length}`);
  if (ways.length === 0) throw new Error('Overpass nie zwrócił żadnych dróg — sprawdź OSM_BBOX.');

  const graph = buildGraph(ways);
  console.log(`Graf: ${graph.vertices.length} wierzchołków, ${graph.edges.length} krawędzi`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Jedna transakcja: albo cały import, albo nic (stare dane zostają, jeśli coś się nie uda)
    await client.query('BEGIN');
    await client.query(ROADS_SCHEMA_SQL);
    await client.query('TRUNCATE road_edges, road_vertices RESTART IDENTITY');
    await insertVertices(client, graph.vertices);
    await insertEdges(client, graph.edges);
    await client.query(ROADS_INDEX_SQL);
    await client.query('COMMIT');
    await client.query('ANALYZE road_vertices');
    await client.query('ANALYZE road_edges'); // statystyki dla planera zapytań
    console.log('Import zakończony.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`Import nieudany: ${(e as Error).message}`);
  process.exit(1);
});
