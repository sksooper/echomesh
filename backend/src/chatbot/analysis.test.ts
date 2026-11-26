import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeReport, fold, parseOccurredAt } from './analysis';

// 21:30 UTC = 22:30 we Wrocławiu (czas zimowy, UTC+1)
const NOW = new Date('2026-11-20T21:30:00.000Z');
const analyze = (message: string) => analyzeReport(message, NOW);

describe('analiza zgłoszenia: typ hałasu', () => {
  const cases: [string, string][] = [
    ['Bardzo głośna muzyka z imprezy pod oknem', 'music'],
    ['Ktoś wierci w ścianie od rana', 'construction'],
    ['Hałas z remontu na ulicy, koparka od 7', 'construction'],
    ['Straszny huk i petardy', 'fireworks'],
    ['Pies szczeka bez przerwy', 'animals'],
    ['Alarm samochodowy wyje od godziny', 'alarm'],
    ['Krzyki i awantura u sąsiadów', 'voices'],
    ['Strasznie tu głośno', 'other'],
    ['Loud music from the party next door', 'music'],
    ['Гучна музика з вечірки', 'music'],
    ['Сильний шум від свердла', 'construction'],
  ];
  for (const [message, type] of cases) {
    it(`"${message}" -> ${type}`, () => assert.equal(analyze(message).noiseType, type));
  }
});

describe('analiza zgłoszenia: czy to hałas i czy wiarygodne', () => {
  it('tekst bez hałasu nie jest zgłoszeniem', () => {
    const r = analyze('Dzisiaj ładna pogoda, idę na spacer');
    assert.equal(r.isNoiseReport, false);
    assert.ok(r.issues.includes('no_noise'));
    assert.equal(r.tips.length, 0);
  });

  it('negacja ("nie ma hałasu") nie jest zgłoszeniem', () => {
    assert.equal(analyze('Nie ma hałasu, jest cisza').isNoiseReport, false);
  });

  it('"dogadaliśmy się" nie jest szczekaniem psa (słowo "dog" tylko jako cały wyraz)', () => {
    assert.equal(analyze('dogadaliśmy się wczoraj').isNoiseReport, false);
  });

  it('zdarzenie z przyszłości jest niewiarygodne', () => {
    const r = analyze('Jutro będzie głośny koncert');
    assert.equal(r.plausible, false);
    assert.ok(r.issues.includes('future_event'));
  });

  it('losowe znaki i "test" są niewiarygodne', () => {
    assert.equal(analyze('asdfasdfasdf').plausible, false);
    assert.equal(analyze('test').plausible, false);
  });

  it('krótki, ale konkretny opis jest wiarygodnym zgłoszeniem', () => {
    const r = analyze('głośna muzyka');
    assert.equal(r.isNoiseReport, true);
    assert.equal(r.plausible, true);
  });
});

describe('analiza zgłoszenia: miejsce, porady', () => {
  it('rozpoznaje budynek i zewnątrz', () => {
    assert.equal(analyze('Głośna muzyka za ścianą u sąsiadów').setting, 'indoor');
    assert.equal(analyze('Głośno na ulicy przed domem').setting, 'outdoor');
    assert.equal(analyze('Głośna muzyka').setting, null);
  });

  it('daje 2–3 porady dla zgłoszenia hałasu', () => {
    const tips = analyze('Głośna muzyka za ścianą u sąsiadów').tips;
    assert.ok(tips.length >= 2 && tips.length <= 3);
  });
});

describe('analiza zgłoszenia: czas zdarzenia', () => {
  const at = (text: string, now = NOW) => parseOccurredAt(fold(text), now)?.toISOString() ?? null;

  it('"wczoraj" przesuwa o dobę', () => assert.equal(at('głośno wczoraj'), '2026-11-19T21:30:00.000Z'));
  it('"o 22:00" = dziś, w czasie lokalnym', () => assert.equal(at('hałas o 22:00'), '2026-11-20T21:00:00.000Z'));
  it('godzina, która dziś jeszcze nie nadeszła, oznacza wczoraj', () => assert.equal(at('hałas o 23:50'), '2026-11-19T22:50:00.000Z'));
  it('"wczoraj o 23"', () => assert.equal(at('wczoraj o 23'), '2026-11-19T22:00:00.000Z'));
  it('bez wskazówek czasu: null (czyli teraz)', () => assert.equal(at('hałas teraz'), null));
  it('niemożliwa godzina jest ignorowana', () => assert.equal(at('hałasowali 25:99'), null));
  it('uwzględnia czas letni (UTC+2)', () => {
    assert.equal(at('hałas o 12:00', new Date('2026-07-10T18:00:00Z')), '2026-07-10T10:00:00.000Z');
  });
});
