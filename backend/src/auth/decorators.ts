import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role, User } from '../users/user.types';

/** Zalogowany użytkownik wpisany do żądania przez AuthGuard: `me(@CurrentUser() user: User)`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Oznacza endpoint jako publiczny (bez tokenu). Domyślnie KAŻDY endpoint wymaga logowania,
 * więc nowe endpointy są bezpieczne, dopóki ktoś świadomie nie doda @Public().
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';

/**
 * Wymaga wskazanej roli LUB wyższej: @Roles('analyst') wpuści analityka i administratora.
 * Bez @Roles endpoint jest dostępny dla każdego zalogowanego (czyli od roli resident).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
