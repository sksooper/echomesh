import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateCityEventDto, ListEventsQuery, UpdateCityEventDto } from './city-events.dto';

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

  /** Wszystkie wydarzenia trwające w chwili `at` (niezależnie od miejsca) — do dopasowania po nazwie. */
  async findActiveAt(at: Date): Promise<CityEvent[]> {
    const rows = await this.db.query<Row>(
      `${SELECT_EVENTS} WHERE e.start_time <= $1 AND e.end_time >= $1 ORDER BY e.start_time`,
      [at],
    );
    return rows.map(withRadius);
  }

  /**
   * Wydarzenie trwające w chwili `at`, którego strefa obejmuje punkt (lat, lng) — najbliższe pierwsze.
   * ::geography sprawia, że ST_DWithin liczy odległość w METRACH (na samej geometrii byłyby stopnie).
   */
  async findActiveNear(lat: number, lng: number, at: Date = new Date(), radiusM = EVENT_RADIUS_M): Promise<CityEvent | null> {
    const rows = await this.db.query<Row>(
      `${SELECT_EVENTS}
       WHERE e.start_time <= $3 AND e.end_time >= $3
         AND ST_DWithin(e.geometry::geography, ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography, $4)
       ORDER BY ST_Distance(e.geometry::geography, ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography)
       LIMIT 1`,
      [lat, lng, at, radiusM],
    );
    return rows[0] ? withRadius(rows[0]) : null;
  }

  async create(dto: CreateCityEventDto): Promise<CityEvent> {
    this.assertTimeOrder(dto.startTime, dto.endTime);
    // ST_MakePoint(długość, szerokość) — najpierw lng (X), potem lat (Y)
    const [row] = await this.db.query<{ id: number }>(
      `INSERT INTO city_events (title, start_time, end_time, geometry)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326))
       RETURNING id`,
      [dto.title, dto.startTime, dto.endTime, dto.lng, dto.lat],
    );
    return (await this.findOne(row.id)) as CityEvent;
  }

  async update(id: number, dto: UpdateCityEventDto): Promise<CityEvent> {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException(`Event ${id} not found`);

    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('lat and lng must be sent together');
    }
    // sprawdzamy kolejność czasów po scaleniu zmian z tym, co już jest w bazie
    this.assertTimeOrder(dto.startTime ?? existing.startTime, dto.endTime ?? existing.endTime);

    // COALESCE($n, kolumna): gdy parametr jest NULL (nie przysłano), zostaje stara wartość
    await this.db.query(
      `UPDATE city_events SET
         title      = COALESCE($2::text, title),
         start_time = COALESCE($3::timestamptz, start_time),
         end_time   = COALESCE($4::timestamptz, end_time),
         geometry   = COALESCE(ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4326), geometry)
       WHERE id = $1`,
      [id, dto.title ?? null, dto.startTime ?? null, dto.endTime ?? null, dto.lng ?? null, dto.lat ?? null],
    );
    return (await this.findOne(id)) as CityEvent;
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query('DELETE FROM city_events WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`Event ${id} not found`);
  }

  private assertTimeOrder(start: string | Date, end: string | Date) {
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }
}
