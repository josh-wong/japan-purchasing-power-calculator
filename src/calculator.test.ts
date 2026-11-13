import { describe, expect, it } from 'vitest';
import { calculate, parseAmount } from './calculator';
import { savedRates } from './rates';

describe('numeric input', () => {
  it.each(['1,234.50', '１２３４．５０', '１，２３４．５０'])('normalizes %s', raw => {
    expect(parseAmount(raw, true, 'JPY')).toEqual({ amount: 1234.5, precision: 1, error: '' });
  });
  it.each([
    ['2500,000', 2500000], ['1,5', 15], ['12,34,567', 1234567],
    ['1,', 1], ['1,,000', 1000], ['２５００，０００．５０', 2500000.5],
  ])('accepts misplaced whole-number commas in %s', (raw, amount) => {
    expect(parseAmount(raw as string, true, 'USD').amount).toBe(amount);
    expect(parseAmount(raw as string, true, 'USD').error).toBe('');
  });
  it.each(['-1', '1e3', 'Infinity', '1.234', '1234567890123', '1.2,3', '1.2.3', ','])('rejects %s', raw => {
    expect(parseAmount(raw, true, 'USD').amount).toBeNull();
    expect(parseAmount(raw, true, 'USD').error).not.toBe('');
  });
  it('distinguishes incomplete, zero price, and zero pay', () => {
    expect(parseAmount(' ', false, 'JPY')).toEqual({ amount: null, error: '' });
    expect(parseAmount('0', true, 'JPY').amount).toBe(0);
    expect(parseAmount('0', false, 'JPY').error).not.toBe('');
    expect(parseAmount('.50', true, 'JPY').amount).toBe(.5);
    expect(parseAmount('999999999999.99', true, 'USD').amount).toBe(999999999999.99);
    expect(parseAmount('1.234', false, 'KWD').amount).toBe(1.234);
  });
});

describe('independent calculations', () => {
  const rate = savedRates.unitsPerEuro.JPY / savedRates.unitsPerEuro.USD;
  it('matches the dated November 11 fixture without rounding intermediate results', () => {
    const result = calculate(5000, 250000, 4000, rate);
    expect(result.equivalent).toBe(80);
    expect(result.converted?.toFixed(2)).toBe('31.40');
    expect(result.japanShare).toBe(.02);
    expect((result.homeShare! * 100).toFixed(2)).toBe('0.79');
    expect(result.homeShare).toBe(result.converted! / 4000);
  });
  it('preserves results when inputs or rates are missing', () => {
    expect(calculate(5000, null, null, rate).converted).toBeCloseTo(31.400553);
    expect(calculate(5000, 250000, 4000, null)).toEqual({ equivalent: 80, japanShare: .02, converted: null, homeShare: null });
    expect(calculate(null, 250000, 4000, rate)).toEqual({ equivalent: null, japanShare: null, converted: null, homeShare: null });
    expect(calculate(5000, null, 4000, rate).homeShare).not.toBeNull();
  });
  it('allows zero prices and shares above 100%', () => {
    expect(calculate(0, 1, 1, rate)).toEqual({ equivalent: 0, converted: 0, japanShare: 0, homeShare: 0 });
    expect(calculate(200, 100, 100, 1).japanShare).toBe(2);
    expect(calculate(.01, 100000, 4000, rate).japanShare).toBe(0.0000001);
  });
});
