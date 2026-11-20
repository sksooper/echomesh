import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../users/user.types';

/** Zalogowany użytkownik wpisany do żądania przez AuthGuard: `me(@CurrentUser() user: User)`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});
