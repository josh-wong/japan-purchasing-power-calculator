import { describe, expect, it } from 'vitest';
import { bundledCurrencyCodes } from './currencies';
import { calculate } from './calculator';
import { RateDataError, ageInDays, comparisonCurrencies, isOutdated, validateSnapshot, yenPerUnit } from './rate-snapshot';
import fixture from '../tests/fixtures/rates.json';

const valid = { source: 'European Central Bank', date: '2026-11-11', unitsPerEuro: { EUR: 1, JPY: 177.18, USD: 1.1127, GBP: 0.83618 } };

describe('snapshot validation', () => {
  it('accepts the fixture and returns sorted rates', () => {
    expect(validateSnapshot(valid)).toEqual({ ...valid, unitsPerEuro: { EUR: 1, GBP: 0.83618, JPY: 177.18, USD: 1.1127 } });
    expect(validateSnapshot(fixture)).toEqual(fixture);
  });

  it.each([
    ['null', null], ['an array', []], ['a string', '{}'],
    ['a missing source', { ...valid, source: undefined }],
    ['a blank source', { ...valid, source: ' ' }],
    ['a missing date', { ...valid, date: undefined }],
    ['a malformed date', { ...valid, date: '2026-1-1' }],
    ['an impossible date', { ...valid, date: '2026-02-29' }],
    ['missing rates', { ...valid, unitsPerEuro: undefined }],
    ['an array of rates', { ...valid, unitsPerEuro: [1] }],
    ['a missing JPY rate', { ...valid, unitsPerEuro: { EUR: 1, USD: 1.1 } }],
    ['a missing EUR rate', { ...valid, unitsPerEuro: { JPY: 177, USD: 1.1 } }],
    ['an EUR rate other than 1', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, EUR: 1.01 } }],
    ['a zero rate', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: 0 } }],
    ['a negative rate', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: -1 } }],
    ['a string rate', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: '1.1' } }],
    ['a null rate', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: null } }],
    ['a lower-case code', { ...valid, unitsPerEuro: { ...valid.unitsPerEuro, usd: 1.1 } }],
  ])('rejects %s', (_name, value) => {
    expect(() => validateSnapshot(value)).toThrow(RateDataError);
  });

  it('rejects non-finite rates that JSON cannot carry but a caller could pass', () => {
    expect(() => validateSnapshot({ ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: Infinity } })).toThrow(RateDataError);
    expect(() => validateSnapshot({ ...valid, unitsPerEuro: { ...valid.unitsPerEuro, USD: NaN } })).toThrow(RateDataError);
  });
});

describe('currency coverage', () => {
  it('derives the comparison list from the feed: no JPY, EUR included, USD first', () => {
    expect(comparisonCurrencies(validateSnapshot(valid))).toEqual(['USD', 'EUR', 'GBP']);
    expect(comparisonCurrencies({ ...valid, unitsPerEuro: { JPY: 1, ZAR: 2, EUR: 1 } })).toEqual(['EUR', 'ZAR']);
  });

  it('keeps the bundled fallback list in step with the last verified feed', () => {
    expect([...bundledCurrencyCodes].sort()).toEqual([...comparisonCurrencies(fixture)].sort());
    expect(bundledCurrencyCodes[0]).toBe('USD');
    expect(bundledCurrencyCodes).toContain('EUR');
    expect(bundledCurrencyCodes).not.toContain('JPY');
    expect(new Set(bundledCurrencyCodes).size).toBe(bundledCurrencyCodes.length);
  });
});

describe('EUR cross rates', () => {
  const snapshot = validateSnapshot(valid);
  it('divides JPY per EUR by target units per EUR', () => {
    expect(yenPerUnit(snapshot, 'EUR')).toBe(177.18);
    expect(yenPerUnit(snapshot, 'USD')).toBe(177.18 / 1.1127);
    expect(yenPerUnit(snapshot, 'GBP')).toBe(177.18 / 0.83618);
    expect(yenPerUnit(snapshot, 'ZAR')).toBeNull();
    expect(yenPerUnit(snapshot, 'constructor')).toBeNull();
  });

  it('matches priceJpy × (units per EUR ÷ JPY per EUR) from the issue', () => {
    for (const code of ['EUR', 'USD', 'GBP']) {
      const direct = 5000 * (snapshot.unitsPerEuro[code] / snapshot.unitsPerEuro.JPY);
      expect(calculate(5000, 250000, 4000, yenPerUnit(snapshot, code)).converted).toBeCloseTo(direct, 10);
    }
  });
});

describe('stale-date boundary', () => {
  const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);
  it('is current through seven calendar days and outdated on the eighth', () => {
    expect(ageInDays('2026-11-11', noon('2026-11-11'))).toBe(0);
    expect(isOutdated('2026-11-11', noon('2026-11-11'))).toBe(false);
    expect(isOutdated('2026-11-11', Date.parse('2026-11-18T23:59:59Z'))).toBe(false);
    expect(ageInDays('2026-11-11', Date.parse('2026-11-18T23:59:59Z'))).toBe(7);
    expect(isOutdated('2026-11-11', Date.parse('2026-11-19T00:00:00Z'))).toBe(true);
  });
  it('counts calendar days across month and year ends', () => {
    expect(ageInDays('2026-12-28', Date.parse('2027-01-04T00:00:00Z'))).toBe(7);
    expect(isOutdated('2026-12-28', Date.parse('2027-01-05T00:00:00Z'))).toBe(true);
  });
});
