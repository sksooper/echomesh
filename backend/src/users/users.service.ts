import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { hashPassword } from '../auth/password';
import { DbService } from '../db/db.service';
import { Role, User, UserWithHash } from './user.types';

const PUBLIC_COLUMNS = `id, name, email, role, created_at AS "createdAt"`;

// Konta demonstracyjne (tylko gdy SEED_DEMO_USERS=true) — po jednym na każdą rolę
const DEMO_USERS: { name: string; email: string; password: string; role: Role }[] = [
  { name: 'Mieszkaniec Demo', email: 'mieszkaniec@echomesh.test', password: 'Mieszkaniec123!', role: 'resident' },
  { name: 'Analityk Demo', email: 'analityk@echomesh.test', password: 'Analityk123!', role: 'analyst' },
  { name: 'Administrator Demo', email: 'admin@echomesh.test', password: 'Admin123!', role: 'admin' },
];

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly log = new Logger(UsersService.name);

  constructor(private db: DbService) {}

  // Hook cyklu życia NestJS: wykonuje się raz, po zainicjowaniu modułu
  async onModuleInit() {
    if (process.env.SEED_DEMO_USERS !== 'true') return;
    for (const demo of DEMO_USERS) {
      if (await this.findByEmail(demo.email)) continue; // nie nadpisujemy istniejących kont
      await this.create({
        name: demo.name,
        email: demo.email,
        passwordHash: await hashPassword(demo.password),
        role: demo.role,
      });
      this.log.log(`Utworzono konto demonstracyjne: ${demo.email} (${demo.role})`);
    }
  }

  async findById(id: number): Promise<User | null> {
    const rows = await this.db.query<User>(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserWithHash | null> {
    const rows = await this.db.query<UserWithHash>(
      `SELECT ${PUBLIC_COLUMNS}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async create(input: { name: string; email: string; passwordHash: string; role?: Role }): Promise<User> {
    try {
      const [row] = await this.db.query<User>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING ${PUBLIC_COLUMNS}`,
        [input.name, input.email, input.passwordHash, input.role ?? 'resident'],
      );
      return row;
    } catch (e) {
      // 23505 = unique_violation w PostgreSQL (kolumna email ma ograniczenie UNIQUE)
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Email already registered');
      throw e;
    }
  }
}
