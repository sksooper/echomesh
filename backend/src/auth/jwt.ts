import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Minimalna implementacja JWT (HS256) na samym node:crypto — żeby zobaczyć, jak naprawdę wygląda token.
 * Token to trzy części oddzielone kropkami:  nagłówek.ładunek.podpis  (każda w base64url).
 * Podpis = HMAC-SHA256(nagłówek.ładunek, tajny_klucz). Kto nie zna klucza, nie podrobi tokenu,
 * a zmiana jakiegokolwiek znaku w ładunku unieważnia podpis. Ładunek NIE jest szyfrowany (każdy go odczyta).
 * W większym projekcie użyłbyś gotowej biblioteki (np. @nestjs/jwt) — zasada działania jest ta sama.
 */

export interface JwtPayload {
  sub: number; // id użytkownika
  iat: number; // wystawiony (sekundy od 1970)
  exp: number; // wygasa (sekundy od 1970)
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest();

export function signToken(sub: number, secret: string, expiresInSeconds: number, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub, iat, exp: iat + expiresInSeconds });
  const signature = sign(`${header}.${payload}`, secret).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Zwraca ładunek, jeśli podpis jest poprawny i token nie wygasł; w przeciwnym razie null. */
export function verifyToken(token: string, secret: string, nowMs = Date.now()): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = sign(`${header}.${payload}`, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    if (JSON.parse(Buffer.from(header, 'base64url').toString('utf8')).alg !== 'HS256') return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.sub !== 'number' || typeof data.exp !== 'number') return null;
    if (data.exp <= Math.floor(nowMs / 1000)) return null; // wygasły
    return data as JwtPayload;
  } catch {
    return null;
  }
}
