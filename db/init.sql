-- Rozszerzenia: PostGIS (dane przestrzenne) i pgRouting (wyznaczanie tras po grafie)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- ===== Schemat podstawowy (opis projektu, pkt 8) =====
-- Wszystkie geometrie w układzie WGS 84 (SRID 4326).

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(200) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(20) NOT NULL DEFAULT 'resident'
                 CHECK (role IN ('resident', 'analyst', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sensors (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  location  geometry(Point, 4326) NOT NULL,
  status    VARCHAR(20) NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'inactive', 'maintenance'))
);
-- indeks GIST przyspiesza zapytania przestrzenne (np. czujniki w promieniu)
CREATE INDEX sensors_location_gix ON sensors USING GIST (location);

CREATE TABLE measurements (
  id          BIGSERIAL PRIMARY KEY,
  sensor_id   INT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  db_level    NUMERIC(5,2) NOT NULL CHECK (db_level BETWEEN 0 AND 200),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- indeks złożony pod najczęstsze zapytanie: "ostatnie odczyty danego czujnika"
CREATE INDEX measurements_sensor_time_idx ON measurements (sensor_id, "timestamp" DESC);

CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  sensor_id   INT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  level       NUMERIC(5,2),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_created_idx ON alerts (created_at DESC);

CREATE TABLE city_events (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  geometry   geometry(Geometry, 4326) NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX city_events_geometry_gix ON city_events USING GIST (geometry);
CREATE INDEX city_events_time_idx ON city_events (start_time, end_time);

-- ===== Dane demonstracyjne =====
-- Uwaga: ST_MakePoint(długość, szerokość) — najpierw lng (X), potem lat (Y).

INSERT INTO sensors (name, location) VALUES
  ('Rynek',            ST_SetSRID(ST_MakePoint(17.0322, 51.1100), 4326)),
  ('Dworzec Główny',   ST_SetSRID(ST_MakePoint(17.0360, 51.0990), 4326)),
  ('Most Grunwaldzki', ST_SetSRID(ST_MakePoint(17.0580, 51.1115), 4326)),
  ('Park Południowy',  ST_SetSRID(ST_MakePoint(17.0200, 51.0850), 4326)),
  ('Hala Stulecia',    ST_SetSRID(ST_MakePoint(17.0770, 51.1068), 4326));

-- doba odczytów co 10 minut (losowe 40–75 dB)
INSERT INTO measurements (sensor_id, db_level, "timestamp")
SELECT s.id,
       round((40 + random() * 35 + (s.id % 3) * 3)::numeric, 2),
       now() - (g || ' minutes')::interval
FROM sensors s, generate_series(0, 1440, 10) g;

INSERT INTO city_events (title, start_time, end_time, geometry) VALUES
  ('Koncert na Rynku',            now() - interval '1 hour',  now() + interval '4 hours',
     ST_SetSRID(ST_MakePoint(17.0322, 51.1100), 4326)),
  ('Remont ul. Świdnickiej',      now() - interval '2 days',  now() + interval '5 days',
     ST_SetSRID(ST_MakePoint(17.0300, 51.1045), 4326)),
  ('Festiwal przy Hali Stulecia', now() + interval '1 day',   now() + interval '1 day 6 hours',
     ST_SetSRID(ST_MakePoint(17.0770, 51.1068), 4326));
