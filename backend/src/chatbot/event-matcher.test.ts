import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CityEvent } from '../city-events/city-events.service';
import { matchEventByName } from './event-matcher';

const event = (id: number, title: string): CityEvent => ({
  id,
  title,
  startTime: new Date(),
  endTime: new Date(),
  lat: 0,
  lng: 0,
  radiusM: 300,
  active: true,
});

const events = [event(1, 'Koncert na Rynku'), event(2, 'Remont ul. Świdnickiej'), event(3, 'Festiwal przy Hali Stulecia')];

describe('dopasowanie wydarzenia po nazwie z treści', () => {
  it('rozpoznaje wydarzenie mimo odmiany słów ("Rynek" / "rynku")', () => {
    assert.equal(matchEventByName('Głośny koncert na rynku, nie da się spać', events)?.event.id, 1);
  });

  it('wystarcza połowa znaczących słów tytułu', () => {
    assert.equal(matchEventByName('Bardzo głośno przez ten koncert', events)?.event.id, 1);
  });

  it('dopasowuje wydarzenia z polskimi znakami', () => {
    assert.equal(matchEventByName('Hałas z remontu Świdnickiej', events)?.event.id, 2);
  });

  it('jedno słowo z trzech to za mało', () => {
    assert.equal(matchEventByName('Głośno przy hali', events), null);
  });

  it('brak dopasowania i pusty tekst dają null', () => {
    assert.equal(matchEventByName('Ktoś wierci w ścianie', events), null);
    assert.equal(matchEventByName('', events), null);
  });
});
