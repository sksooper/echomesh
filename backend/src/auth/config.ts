import { Logger } from '@nestjs/common';

const DEV_SECRET = 'dev-only-secret-change-me';

/** Tajny klucz do podpisywania tokenów. W produkcji MUSI pochodzić ze zmiennej środowiskowej. */
export const JWT_SECRET = process.env.JWT_SECRET ?? DEV_SECRET;
/** Ważność tokenu w sekundach (domyślnie 8 godzin). */
export const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 28_800);

if (JWT_SECRET === DEV_SECRET) {
  new Logger('Auth').warn('JWT_SECRET nie jest ustawiony — używam klucza deweloperskiego (nie na produkcji!)');
}
