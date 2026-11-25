/*
 * Tabele sieci dróg (graf dla pgRouting). Tworzone przez skrypt importu (IF NOT EXISTS), a nie przez db/init.sql —
 * dzięki temu nie trzeba kasować bazy (down -v), a dane dróg mają osobny cykl życia (import / ponowny import).
 *
 *  road_vertices — wierzchołki grafu = węzły OSM (skrzyżowania i punkty załamania dróg),
 *  road_edges    — krawędzie grafu = odcinki dróg między sąsiednimi węzłami (source -> target).
 * Wszystkie geometrie w układzie WGS 84 (SRID 4326), jak w reszcie bazy.
 */
export const ROADS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS road_vertices (
  id   BIGINT PRIMARY KEY,                 -- id węzła w OpenStreetMap
  geom geometry(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS road_edges (
  id         BIGSERIAL PRIMARY KEY,
  osm_way_id BIGINT NOT NULL,              -- z której drogi OSM pochodzi odcinek
  source     BIGINT NOT NULL REFERENCES road_vertices(id),
  target     BIGINT NOT NULL REFERENCES road_vertices(id),
  highway    VARCHAR(30) NOT NULL,         -- typ drogi z OSM (footway, residential…)
  length_m   DOUBLE PRECISION NOT NULL,    -- długość w metrach
  geom       geometry(LineString, 4326) NOT NULL
);
`;

/** Indeksy zakładamy PO imporcie (szybciej niż aktualizować je przy każdym wstawieniu). */
export const ROADS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS road_vertices_geom_gix ON road_vertices USING GIST (geom);
CREATE INDEX IF NOT EXISTS road_edges_geom_gix    ON road_edges    USING GIST (geom);
CREATE INDEX IF NOT EXISTS road_edges_source_idx  ON road_edges (source);
CREATE INDEX IF NOT EXISTS road_edges_target_idx  ON road_edges (target);
`;
