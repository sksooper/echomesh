import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { JWT_EXPIRES_IN_SECONDS, JWT_SECRET } from './config';
import { signToken } from './jwt';
import { hashPassword, verifyPassword } from './password';

export interface AuthResult {
  token: string;
  user: User;
}

@Injectable()
export class AuthService {
  constructor(private users: UsersService) {}

  /** Rejestracja zawsze tworzy konto mieszkańca — role wyższe nadaje administrator. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await hashPassword(dto.password);
    const user = await this.users.create({ name: dto.name, email: dto.email, passwordHash, role: 'resident' });
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const row = await this.users.findByEmail(dto.email);
    const ok = row ? await verifyPassword(dto.password, row.passwordHash) : false;
    // Jeden komunikat dla "brak konta" i "złe hasło" — nie zdradzamy, które e-maile są zarejestrowane
    if (!row || !ok) throw new UnauthorizedException('Invalid email or password');

    const { passwordHash, ...user } = row; // odcinamy skrót hasła — nigdy nie wychodzi poza backend
    return this.issue(user);
  }

  private issue(user: User): AuthResult {
    return { token: signToken(user.id, JWT_SECRET, JWT_EXPIRES_IN_SECONDS), user };
  }
}
