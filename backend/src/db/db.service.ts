import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/** Funkcja zapytania z tej samej transakcji (zwraca same wiersze). */
export type QueryFn = <T = any>(text: string, params?: any[]) => Promise<T[]>;

/** Wspólny serwis bazodanowy używany przez wszystkie moduły (jedna pula połączeń). */
@Injectable()
export class DbService implements OnModuleDestroy {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  /** Zapytanie z parametrami ($1, $2…) — chroni przed SQL injection. Zwraca same wiersze. */
  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows as T[];
  }

  /**
   * Wykonuje kilka zapytań atomowo: albo wszystkie się zapiszą (COMMIT), albo żadne (ROLLBACK, gdy callback rzuci błąd).
   * Wszystkie zapytania w transakcji muszą iść przez JEDNO połączenie z puli — stąd `query` przekazany do callbacku.
   */
  async transaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query: QueryFn = async (text, params = []) => (await client.query(text, params)).rows;
      const result = await fn(query);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release(); // zawsze oddajemy połączenie do puli
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
