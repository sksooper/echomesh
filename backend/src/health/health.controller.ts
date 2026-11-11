import { Controller, Get } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Controller('health')
export class HealthController {
  constructor(private db: DbService) {}

  /** Stan API i bazy (wersje PostGIS / pgRouting potwierdzają, że rozszerzenia działają). */
  @Get()
  async check() {
    try {
      const [row] = await this.db.query<{ postgis: string; pgrouting: string | null }>(
        `SELECT postgis_version() AS postgis,
                (SELECT extversion FROM pg_extension WHERE extname = 'pgrouting') AS pgrouting`,
      );
      return { status: 'ok', db: { up: true, postgis: row.postgis, pgrouting: row.pgrouting } };
    } catch {
      return { status: 'degraded', db: { up: false } };
    }
  }
}
