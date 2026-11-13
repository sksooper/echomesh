import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type SensorStatus = 'active' | 'inactive' | 'maintenance';

export interface Sensor {
  id: number;
  name: string;
  status: SensorStatus;
  lat: number;
  lng: number;
  dbLevel: number | null; // ostatni odczyt
  lastReadingAt: string | null;
  stale: boolean; // brak odczytu lub odczyt starszy niż STALE_MINUTES
}

// Odczyty starsze niż 60 min uznajemy za nieaktualne (czujnik szary na mapie)
const STALE_MS = Number(process.env.STALE_MINUTES ?? 60) * 60_000;

// Wspólna część zapytania. LEFT JOIN LATERAL pobiera dla każdego czujnika jego NAJNOWSZY pomiar
// (korzysta z indeksu (sensor_id, timestamp DESC)); czujnik bez pomiarów też trafi do wyniku.
const SELECT_SENSORS = `
  SELECT s.id, s.name, s.status,
         ST_Y(s.location) AS lat,
         ST_X(s.location) AS lng,
         m.db_level::float8 AS "dbLevel",
         m."timestamp"      AS "lastReadingAt"
  FROM sensors s
  LEFT JOIN LATERAL (
    SELECT db_level, "timestamp"
    FROM measurements
    WHERE sensor_id = s.id
    ORDER BY "timestamp" DESC
    LIMIT 1
  ) m ON true`;

type Row = Omit<Sensor, 'lastReadingAt' | 'stale'> & { lastReadingAt: Date | null };

function toSensor(r: Row): Sensor {
  const age = r.lastReadingAt ? Date.now() - r.lastReadingAt.getTime() : Infinity;
  return { ...r, lastReadingAt: r.lastReadingAt ? r.lastReadingAt.toISOString() : null, stale: age > STALE_MS };
}

@Injectable()
export class SensorsService {
  constructor(private db: DbService) {}

  async findAll(): Promise<Sensor[]> {
    const rows = await this.db.query<Row>(`${SELECT_SENSORS} ORDER BY s.id`);
    return rows.map(toSensor);
  }

  async findOne(id: number): Promise<Sensor | null> {
    const rows = await this.db.query<Row>(`${SELECT_SENSORS} WHERE s.id = $1`, [id]);
    return rows[0] ? toSensor(rows[0]) : null;
  }
}
