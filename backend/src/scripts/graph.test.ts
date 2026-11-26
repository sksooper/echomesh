import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGraph } from './graph';
import type { OverpassWay } from './overpass';

const way = (id: number, nodes: number[], highway = 'footway'): OverpassWay => ({
  type: 'way',
  id,
  nodes,
  geometry: nodes.map((n) => ({ lat: 51 + n / 1000, lon: 17 + n / 1000 })),
  tags: { highway },
});

describe('graf dróg z danych OSM', () => {
  it('drogi ze wspólnym węzłem tworzą spójny graf (skrzyżowanie)', () => {
    const g = buildGraph([way(10, [1, 2, 3]), way(11, [3, 4], 'residential')]);
    assert.equal(g.vertices.length, 4);
    assert.deepEqual(
      g.edges.map((e) => [e.source, e.target, e.highway]),
      [[1, 2, 'footway'], [2, 3, 'footway'], [3, 4, 'residential']],
    );
  });

  it('powtórzony odcinek (także odwrócony) liczy się raz, zdegenerowany jest pomijany', () => {
    const g = buildGraph([way(1, [1, 2]), way(2, [2, 1]), way(3, [5, 5, 6])]);
    assert.equal(g.edges.length, 2); // 1–2 oraz 5–6
    assert.equal(g.vertices.length, 4);
  });

  it('współrzędne krawędzi pochodzą z geometrii drogi', () => {
    const [edge] = buildGraph([way(1, [1, 2])]).edges;
    assert.equal(edge.lat1, 51.001);
    assert.equal(edge.lng2, 17.002);
  });

  it('pusta lista dróg daje pusty graf', () => {
    assert.deepEqual(buildGraph([]), { vertices: [], edges: [] });
  });
});
