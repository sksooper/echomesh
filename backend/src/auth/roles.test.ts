import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasRole } from './roles';

describe('role (dziedziczenie uprawnień)', () => {
  it('admin ma uprawnienia analityka i mieszkańca', () => {
    assert.equal(hasRole('admin', ['analyst']), true);
    assert.equal(hasRole('admin', ['resident']), true);
  });

  it('analityk wchodzi tam, gdzie wymagany jest analityk, ale nie tam, gdzie admin', () => {
    assert.equal(hasRole('analyst', ['analyst']), true);
    assert.equal(hasRole('analyst', ['admin']), false);
  });

  it('mieszkaniec nie ma uprawnień analityka', () => {
    assert.equal(hasRole('resident', ['analyst']), false);
  });

  it('brak wymagań wpuszcza każdą rolę', () => {
    assert.equal(hasRole('resident', []), true);
  });
});
