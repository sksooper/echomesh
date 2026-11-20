import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

// scrypt działa na callbackach — opakowujemy go w Promise, żeby używać async/await
function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * Skrót hasła: scrypt z losową solą (16 B). Zapisujemy "sól:skrót" (hex) — sól nie jest tajna,
 * ale sprawia, że to samo hasło u dwóch użytkowników daje dwa różne skróty.
 * scrypt jest celowo wolny i pamięciożerny, co utrudnia zgadywanie haseł metodą brute force.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  // timingSafeEqual porównuje w stałym czasie, więc czas odpowiedzi nie zdradza, ile znaków się zgadza
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
