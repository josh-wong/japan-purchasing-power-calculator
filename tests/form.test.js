// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const field = id => document.getElementById(id);
function change(id, value, type = 'input') {
  field(id).value = value;
  field(id).dispatchEvent(new Event(type, { bubbles: true }));
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/main.ts');
});
afterEach(() => vi.useRealTimers());
it('renders the default fixture and all nine presets', () => {
  expect(field('equivalent').textContent).toBe('US$80.00');
  expect(field('converted').textContent).toBe('US$31.40');
  expect(field('home-share').textContent).toBe('0.79%');
  expect(field('preset').options.length).toBe(10);
  change('preset', '100000', 'change');
  expect(field('price').value).toBe('100,000');
  change('preset', '200000', 'change');
  expect(field('price').value).toBe('200,000');
  change('price', '200001');
  expect(field('preset').value).toBe('');
  expect(field('preset').selectedOptions[0].textContent).toBe('Custom price');
  expect(field('example-disclaimer').textContent).toBe('These are example prices. Actual prices vary.');
});
it('restores income per currency and resets the scenario', () => {
  change('home', '4321.12');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('4,000');
  change('home', '1234');
  change('currency', 'USD', 'change');
  expect(field('home').value).toBe('4321.12');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('1234');
  field('reset').click();
  expect(field('currency').value).toBe('USD');
  expect(field('equivalent').textContent).toBe('US$80.00');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('4,000');
});
it('explains the same share using the entered price without rounding fractional yen away', () => {
  expect(field('result-note').textContent).toBe('JP¥5,000 is about 2% of the entered income in yen. The same share of the comparison income is US$80.00.');
  change('price', '.01');
  expect(field('result-note').textContent).toBe('JP¥0.01 is less than 0.01% of the entered income in yen. The same share of the comparison income is US$0.00.');
  change('price', '0');
  expect(field('result-note').textContent).toBe('JP¥0 is 0% of the entered income in yen. The same share of the comparison income is US$0.00.');
  change('price', '500000');
  expect(field('result-note').textContent).toBe('JP¥500,000 is about 200% of the entered income in yen. The same share of the comparison income is US$8,000.00.');
});
it('prefills every comparison currency and preserves an intentionally cleared income', () => {
  for (const option of field('currency').options) {
    change('currency', option.value, 'change');
    expect(field('home').value).not.toBe('');
    const amount = Number(field('home').value.replaceAll(',', ''));
    expect(amount % (amount >= 100_000 ? 10_000 : 1_000)).toBe(0);
    expect(field('home').getAttribute('aria-invalid')).toBe('false');
  }
  change('currency', 'KRW', 'change');
  expect(field('home').value).toBe('5,350,000');
  change('home', '');
  change('currency', 'USD', 'change');
  change('currency', 'KRW', 'change');
  expect(field('home').value).toBe('');
});
it('restores each currency’s income error and clears it after correction or reset', () => {
  change('home', 'bad');
  field('home').dispatchEvent(new Event('focusout', { bubbles: true }));
  const usdError = field('home-error').textContent;
  expect(field('home-error').hidden).toBe(false);
  change('currency', 'EUR', 'change');
  expect(field('home-error').hidden).toBe(true);
  expect(field('home').getAttribute('aria-invalid')).toBe('false');
  change('home', '0');
  field('home').dispatchEvent(new Event('focusout', { bubbles: true }));
  const eurError = field('home-error').textContent;
  expect(eurError).not.toBe(usdError);
  change('currency', 'USD', 'change');
  expect(field('home').value).toBe('bad');
  expect(field('home-error').textContent).toBe(usdError);
  expect(field('home-error').hidden).toBe(false);
  expect(field('home').getAttribute('aria-invalid')).toBe('true');
  expect(field('equivalent').textContent).toBe('—');
  change('home', '5000');
  field('home').dispatchEvent(new Event('focusout', { bubbles: true }));
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('0');
  expect(field('home-error').textContent).toBe(eurError);
  expect(field('home-error').hidden).toBe(false);
  expect(field('home').getAttribute('aria-invalid')).toBe('true');
  change('currency', 'USD', 'change');
  expect(field('home-error').hidden).toBe(true);
  expect(field('home').getAttribute('aria-invalid')).toBe('false');
  expect(field('equivalent').textContent).toBe('US$100.00');
  field('reset').click();
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('4,000');
  expect(field('home-error').hidden).toBe(true);
  expect(field('home').getAttribute('aria-invalid')).toBe('false');
});
it('preserves fractional yen on blur and announces after a pause', () => {
  change('price', '５，０００．５０');
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('price').value).toBe('5,000.5');
  expect(field('result-announcement').textContent).toBe('');
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('Equivalent cost at the same share of income US$80.01. Price at the exchange rate US$31.40.');
});
it('announces the missing-income prompt while keeping the available converted price', () => {
  change('japan', '');
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('Price at the exchange rate US$31.40. Enter a monthly income in yen to see the equivalent cost.');
});
it('keeps independently computable outputs and exposes inline errors', () => {
  change('japan', '0');
  expect(field('japan').getAttribute('aria-invalid')).not.toBe('true');
  field('japan').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('japan').getAttribute('aria-invalid')).toBe('true');
  expect(field('equivalent').textContent).toBe('—');
  expect(field('converted').textContent).toBe('US$31.40');
  change('home', '');
  expect(field('home-share').textContent).toBe('—');
  change('price', '0');
  expect(field('converted').textContent).toBe('US$0.00');
});
it('defers formatting errors until blur and clears them when editing resumes', () => {
  change('price', '1..');
  expect(field('price-error').hidden).toBe(true);
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('price-error').hidden).toBe(false);
  expect(field('price').getAttribute('aria-invalid')).toBe('true');
  change('home', '5000');
  expect(field('price-error').hidden).toBe(false);
  change('price', '1..0');
  expect(field('price-error').hidden).toBe(true);
  expect(field('price').getAttribute('aria-invalid')).toBe('false');
  change('price', '1,000');
  expect(field('equivalent').textContent).toBe('US$20.00');
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('price').value).toBe('1,000');
});
it('calculates through misplaced commas and regroups every monetary field on blur', () => {
  change('japan', '2500,000');
  expect(field('japan').value).toBe('2500,000');
  expect(field('equivalent').textContent).toBe('US$8.00');
  field('japan').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('japan').value).toBe('2,500,000');
  expect(field('japan-error').hidden).toBe(true);
  change('price', '50,00.50');
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('price').value).toBe('5,000.5');
  expect(field('price-error').hidden).toBe(true);
  change('home', '40,00.25');
  field('home').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('home').value).toBe('4,000.25');
  expect(field('home-error').hidden).toBe(true);
  change('currency', 'EUR', 'change');
  change('currency', 'USD', 'change');
  expect(field('home').value).toBe('4,000.25');
});
it('clears obsolete errors when presets, currencies, or defaults replace inputs', () => {
  change('price', 'bad');
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  change('preset', '1000', 'change');
  expect(field('price-error').hidden).toBe(true);
  change('home', 'bad');
  field('home').dispatchEvent(new Event('focusout', { bubbles: true }));
  change('currency', 'EUR', 'change');
  expect(field('home-error').hidden).toBe(true);
  change('japan', '0');
  field('japan').dispatchEvent(new Event('focusout', { bubbles: true }));
  field('reset').click();
  for (const id of ['price', 'japan', 'home']) {
    expect(field(`${id}-error`).hidden).toBe(true);
    expect(field(id).getAttribute('aria-invalid')).toBe('false');
  }
  expect(field('equivalent').textContent).toBe('US$80.00');
});
it('formats small and large percentages and currency precision', () => {
  change('price', '.01');
  expect(field('japan-share').textContent).toBe('<0.01%');
  change('price', '500000');
  expect(field('japan-share').textContent).toBe('200%');
  change('currency', 'KRW', 'change');
  expect(field('converted').textContent).not.toContain('.');
  change('currency', 'CHF', 'change');
  expect(field('home-prefix').textContent).toBe('CHF');
});

it('joins dollar symbols to amounts and keeps spacing after currency codes', () => {
  change('currency', 'SGD', 'change');
  expect(field('equivalent').textContent).toBe('S$120.00');
  expect(field('converted').textContent).toMatch(/^S\$\d/);
  expect(field('home-share-note').textContent).toBe('Of S$6,000.00');
  change('currency', 'CHF', 'change');
  expect(field('equivalent').textContent).toBe('CHF\u00a080.00');
});
