import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { JWT_SECRET } from './config';
import { IS_PUBLIC_KEY } from './decorators';
import { verifyToken } from './jwt';

// Minimalny kształt żądania, jakiego potrzebujemy (bez zależności od typów Express)
interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
}

/**
 * Globalny strażnik uwierzytelniania (APP_GUARD): wymaga nagłówka `Authorization: Bearer <token>`.
 * Użytkownika wczytujemy z bazy przy KAŻDYM żądaniu — dzięki temu usunięte konto traci dostęp od razu,
 * a zmiana roli przez administratora działa bez ponownego logowania.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private users: UsersService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Metadane @Public() czytamy z metody, a jeśli jej brak — z całego kontrolera
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const header = req.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing token');

    const payload = verifyToken(token, JWT_SECRET);
    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');

    req.user = user; // kolejne warstwy (kontrolery, RolesGuard) czytają go stąd
    return true;
  }
}
