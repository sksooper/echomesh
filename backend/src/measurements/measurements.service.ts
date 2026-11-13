import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateMeasurementDto } from './measurements.dto';

@Injectable()
export class MeasurementsService {
  constructor(private db: DbService) {}

  async create(dto: CreateMeasurementDto) {
    // 1. czujnik musi istnieć i być aktywny
    const [sensor] = await this.db.query<{ status: string }>('SELECT status FROM sensors WHERE id = $1', [
      dto.sensorId,
    ]);
    if (!sensor) throw new NotFoundException(`Sensor ${dto.sensorId} does not exist`);
    if (sensor.status !== 'active') {
      throw new ConflictException(`Sensor ${dto.sensorId} is not active (status: ${sensor.status})`);
    }

    // 2. zapis pomiaru; RETURNING zwraca zapisany wiersz bez dodatkowego SELECT-a
    const [row] = await this.db.query(
      `INSERT INTO measurements (sensor_id, db_level)
       VALUES ($1, $2)
       RETURNING sensor_id AS "sensorId", db_level::float8 AS "dbLevel", "timestamp"`,
      [dto.sensorId, dto.dbLevel],
    );
    return row;
  }

  /** Historia odczytów czujnika z ostatnich `hours` godzin (rosnąco po czasie, max 5000 punktów). */
  history(sensorId: number, hours: number) {
    // podzapytanie bierze NAJNOWSZE 5000 wierszy, zewnętrzne ORDER BY układa je chronologicznie
    return this.db.query(
      `SELECT * FROM (
         SELECT db_level::float8 AS "dbLevel", "timestamp"
         FROM measurements
         WHERE sensor_id = $1 AND "timestamp" > now() - make_interval(hours => $2::int)
         ORDER BY "timestamp" DESC
         LIMIT 5000
       ) t
       ORDER BY "timestamp"`,
      [sensorId, hours],
    );
  }
}
