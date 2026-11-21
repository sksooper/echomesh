import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { User } from '../users/user.types';

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
