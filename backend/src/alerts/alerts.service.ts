import { Injectable } from '@nestjs/common';
import { CityEventsService } from '../city-events/city-events.service';
import { DbService, QueryFn } from '../db/db.service';
import { SensorsService } from '../sensors/sensors.service';
import { ListAlertsQuery } from './alerts.dto';

export interface AlertItem {
  id: number;
  /** null dla alertu ze zgłoszenia mieszkańca (nie ma czujnika). */
  sensorId: number | null;
  sensorName: string | null;
  level: number | null;
  description: string;
  source: 'measurement' | 'report';
  reportId: number | null;
  /** Miejsce alertu: z czujnika albo ze zgłoszenia. */
  lat: number | null;
  lng: number | null;
  createdAt: Date;
}

// Próg alertu i minimalny odstęp między alertami tego samego czujnika (ochrona przed zalewem alertów)
const THRESHOLD_DB = Number(process.env.ALERT_THRESHOLD_DB ?? 75);
const COOLDOWN_SECONDS = Number(process.env.ALERT_COOLDOWN_SECONDS ?? 60);

@Injectable()
export class AlertsService {
  constructor(
    private db: DbService,
    private sensors: SensorsService,
    private events: CityEventsService,
  ) {}

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
    if (q.source !== undefined) {
      params.push(q.source);
      where.push(`a.source = $${params.length}`);
    }
    params.push(q.limit ?? 50);

    return this.db.query<AlertItem>(
      `SELECT a.id,
              a.sensor_id  AS "sensorId",
              s.name       AS "sensorName",
              a.level::float8 AS level,
              a.description,
              a.source,
              a.report_id  AS "reportId",
              COALESCE(ST_Y(a.location), ST_Y(s.location)) AS lat,
              COALESCE(ST_X(a.location), ST_X(s.location)) AS lng,
              a.created_at AS "createdAt"
       FROM alerts a
       LEFT JOIN sensors s ON s.id = a.sensor_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
  }

  /**
   * Sprawdza normy dla nowego pomiaru. Zwraca true, jeśli powstał alert.
   * INSERT ... SELECT ... WHERE NOT EXISTS to jedno zapytanie: sprawdzenie "czy był niedawno alert"
   * i zapis dzieją się razem, więc dwa równoległe pomiary rzadko utworzą duplikat.
   */
  async checkNorms(sensorId: number, level: number): Promise<boolean> {
    if (level < THRESHOLD_DB) return false;

    // Kontekst: czy w pobliżu czujnika trwa wydarzenie (np. koncert)? Wtedy hałas jest "wytłumaczony".
    const sensor = await this.sensors.findOne(sensorId);
    const event = sensor ? await this.events.findActiveNear(sensor.lat, sensor.lng) : null;
    const suffix = event ? ` (w pobliżu trwa wydarzenie: ${event.title})` : '';

    const rows = await this.db.query(
      `INSERT INTO alerts (sensor_id, level, description, source)
       SELECT $1::int, $2::numeric, $3::text, 'measurement'
       WHERE NOT EXISTS (
         SELECT 1 FROM alerts
         WHERE sensor_id = $1::int
           AND source = 'measurement'
           AND created_at > now() - make_interval(secs => $4::float8)
       )
       RETURNING id`,
      [sensorId, level, `Przekroczono próg ${THRESHOLD_DB} dB: ${level.toFixed(1)} dB${suffix}`, COOLDOWN_SECONDS],
    );
    return rows.length > 0;
  }

  /**
   * Alert powstały po zatwierdzeniu zgłoszenia mieszkańca. Dostaje zapytanie z transakcji, żeby zmiana statusu
   * zgłoszenia i utworzenie alertu zapisały się razem. W alercie NIE ma treści zgłoszenia (prywatność).
   */
  async createFromReport(
    query: QueryFn,
    report: { id: number; description: string; lat: number; lng: number },
  ): Promise<void> {
    await query(
      `INSERT INTO alerts (sensor_id, level, description, source, report_id, location)
       VALUES (NULL, NULL, $1, 'report', $2, ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326))`,
      [report.description, report.id, report.lng, report.lat],
    );
  }
}
