import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, User } from '../users/user.types';
import { ROLES_KEY } from './decorators';
import { hasRole } from './roles';

/**
 * Globalny strażnik ról. Działa PO AuthGuard (kolejność w providers), więc `req.user` jest już ustawiony.
 * 401 = nie wiemy, kim jesteś (brak/zły token), 403 = wiemy, ale ta rola nie ma tu dostępu.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // brak wymagań co do roli

    const user = context.switchToHttp().getRequest<{ user?: User }>().user;
    if (!user || !hasRole(user.role, required)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
