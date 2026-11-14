import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ListAlertsQuery } from './alerts.dto';

export interface AlertItem {
  id: number;
  sensorId: number;
  sensorName: string;
  level: number | null;
  description: string;
  source: 'measurement' | 'report';
  createdAt: Date;
}

@Injectable()
export class AlertsService {
  constructor(private db: DbService) {}

  /** Strumień zdarzeń: najnowsze alerty z opcjonalnymi filtrami. */
  findAll(q: ListAlertsQuery): Promise<AlertItem[]> {
    // Warunki budujemy dynamicznie, ale WARTOŚCI zawsze trafiają do params ($1, $2…) — nigdy do tekstu SQL.
    const params: unknown[] = [q.hours ?? 24];
    const where = [`a.created_at > now() - make_interval(hours => $1::int)`];

    if (q.minDb !== undefined) {
      params.push(q.minDb);
      where.push(`a.level >= $${params.length}`);
    }
    if (q.sensorId !== undefined) {
      params.push(q.sensorId);
      where.push(`a.sensor_id = $${params.length}`);
    }
    params.push(q.limit ?? 50);

    return this.db.query<AlertItem>(
      `SELECT a.id,
              a.sensor_id  AS "sensorId",
              s.name       AS "sensorName",
              a.level::float8 AS level,
              a.description,
              a.source,
              a.created_at AS "createdAt"
       FROM alerts a
       JOIN sensors s ON s.id = a.sensor_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
  }
}
