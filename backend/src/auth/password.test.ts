import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from './password';

describe('hasła (scrypt)', () => {
  it('poprawne hasło przechodzi weryfikację, błędne nie', async () => {
    const hash = await hashPassword('Admin123!');
    assert.equal(await verifyPassword('Admin123!', hash), true);
    assert.equal(await verifyPassword('admin123!', hash), false);
  });

  it('to samo hasło daje różne skróty (losowa sól)', async () => {
    assert.notEqual(await hashPassword('Admin123!'), await hashPassword('Admin123!'));
  });

  it('zepsuty zapis skrótu nie przechodzi weryfikacji i nie rzuca błędu', async () => {
    assert.equal(await verifyPassword('x', 'to-nie-jest-skrot'), false);
    assert.equal(await verifyPassword('x', ''), false);
  });
});
