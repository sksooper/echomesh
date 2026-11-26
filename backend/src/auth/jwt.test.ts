import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signToken, verifyToken } from './jwt';

const NOW = 1_700_000_000_000;

describe('JWT (HS256)', () => {
  it('poprawny token zwraca id użytkownika', () => {
    const token = signToken(7, 'sekret', 60, NOW);
    assert.equal(token.split('.').length, 3);
    assert.equal(verifyToken(token, 'sekret', NOW + 1_000)?.sub, 7);
  });

  it('odrzuca zły klucz i wygasły token', () => {
    const token = signToken(7, 'sekret', 60, NOW);
    assert.equal(verifyToken(token, 'inny', NOW + 1_000), null);
    assert.equal(verifyToken(token, 'sekret', NOW + 61_000), null);
  });

  it('odrzuca token z podmienionym ładunkiem (podpis się nie zgadza)', () => {
    const [header, , signature] = signToken(7, 'sekret', 60, NOW).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 1, iat: 1, exp: 9_999_999_999 })).toString('base64url');
    assert.equal(verifyToken(`${header}.${forged}.${signature}`, 'sekret', NOW), null);
  });

  it('odrzuca śmieci zamiast tokenu', () => {
    for (const bad of ['', 'a.b', 'a.b.c', 'Bearer x']) assert.equal(verifyToken(bad, 'sekret', NOW), null);
  });
});
