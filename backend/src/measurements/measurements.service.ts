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
}
