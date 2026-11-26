import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQuery, parseBBox } from './overpass';

describe('OSM_BBOX', () => {
  it('parsuje poprawny zapis ze spacjami', () => {
    assert.deepEqual(parseBBox('51.06, 16.99, 51.13, 17.10'), { south: 51.06, west: 16.99, north: 51.13, east: 17.1 });
  });

  it('odrzuca zły format i niepoprawny zakres', () => {
    for (const bad of ['1,2,3', 'a,b,c,d', '51,17,50,18', '51,17,52,16', '95,0,96,1']) {
      assert.throws(() => parseBBox(bad), Error, `powinno odrzucić: ${bad}`);
    }
  });
});

describe('zapytanie Overpass', () => {
  const query = buildQuery(parseBBox('51.06,16.99,51.13,17.10'));

  it('prosi o JSON z geometrią i zawiera obszar', () => {
    assert.ok(query.startsWith('[out:json]'));
    assert.ok(query.includes('(51.06,16.99,51.13,17.1)'));
    assert.ok(query.trim().endsWith('out geom;'));
  });

  it('obejmuje drogi dla pieszych, pomija autostrady, a ścieżki rowerowe tylko z pozwoleniem dla pieszych', () => {
    assert.ok(query.includes('footway'));
    assert.ok(!query.includes('motorway'));
    assert.ok(query.includes('"highway"="cycleway"]["foot"~'));
  });
});
