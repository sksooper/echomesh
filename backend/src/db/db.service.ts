import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/** Wspólny serwis bazodanowy używany przez wszystkie moduły (jedna pula połączeń). */
@Injectable()
export class DbService implements OnModuleDestroy {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  /** Zapytanie z parametrami ($1, $2…) — chroni przed SQL injection. Zwraca same wiersze. */
  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows as T[];
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
