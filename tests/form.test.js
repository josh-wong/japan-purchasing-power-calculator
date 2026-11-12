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
  expect(field('price-note').textContent).toContain('four people');
  change('preset', '200000', 'change');
  expect(field('price-note').textContent).toContain('monitor');
  change('price', '200001');
  expect(field('preset').value).toBe('');
  expect(field('price-note').hidden).toBe(true);
});
it('restores income per currency and resets the scenario', () => {
  change('home', '4321.12');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('');
  change('home', '1234');
  change('currency', 'USD', 'change');
  expect(field('home').value).toBe('4321.12');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('1234');
  field('reset').click();
  expect(field('currency').value).toBe('USD');
  expect(field('equivalent').textContent).toBe('US$80.00');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('');
});
it('preserves fractional yen on blur and announces after a pause', () => {
  change('price', '５，０００．５０');
  field('price').dispatchEvent(new Event('focusout', { bubbles: true }));
  expect(field('price').value).toBe('5,000.5');
  expect(field('result-announcement').textContent).toBe('');
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toContain('at the converted price');
});
it('keeps independently computable outputs and exposes inline errors', () => {
  change('japan', '0');
  expect(field('japan').getAttribute('aria-invalid')).toBe('true');
  expect(field('equivalent').textContent).toBe('—');
  expect(field('converted').textContent).toBe('US$31.40');
  change('home', '');
  expect(field('home-share').textContent).toBe('—');
  change('price', '0');
  expect(field('converted').textContent).toBe('US$0.00');
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
