import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ListEventsQuery } from './city-events.dto';

export interface CityEvent {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  lat: number;
  lng: number;
  radiusM: number; // promień strefy wydarzenia (stała konfiguracja EVENT_RADIUS_M)
  active: boolean; // czy wydarzenie trwa w tej chwili
}

// Promień strefy, w której wydarzenie "tłumaczy" hałas (koncert na Rynku -> zgłoszenie obok jest zaplanowane)
export const EVENT_RADIUS_M = Number(process.env.EVENT_RADIUS_M ?? 300);

// Geometria wydarzenia może być punktem lub obszarem — ST_Centroid zwraca środek w obu przypadkach.
const SELECT_EVENTS = `
  SELECT e.id, e.title,
         e.start_time AS "startTime",
         e.end_time   AS "endTime",
         ST_Y(ST_Centroid(e.geometry)) AS lat,
         ST_X(ST_Centroid(e.geometry)) AS lng,
         (e.start_time <= now() AND e.end_time >= now()) AS active
  FROM city_events e`;

type Row = Omit<CityEvent, 'radiusM'>;
const withRadius = (r: Row): CityEvent => ({ ...r, radiusM: EVENT_RADIUS_M });

@Injectable()
export class CityEventsService {
  constructor(private db: DbService) {}

  async findAll(q: ListEventsQuery): Promise<CityEvent[]> {
    const where =
      q.scope === 'all'
        ? ''
        : q.scope === 'active'
          ? 'WHERE e.start_time <= now() AND e.end_time >= now()'
          : 'WHERE e.end_time >= now()'; // domyślnie: trwające i zaplanowane
    const rows = await this.db.query<Row>(`${SELECT_EVENTS} ${where} ORDER BY e.start_time`);
    return rows.map(withRadius);
  }

  async findOne(id: number): Promise<CityEvent | null> {
    const rows = await this.db.query<Row>(`${SELECT_EVENTS} WHERE e.id = $1`, [id]);
    return rows[0] ? withRadius(rows[0]) : null;
  }
}
