// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

import rates from './fixtures/rates.json';

const html = readFileSync('index.html', 'utf8');
const field = id => document.getElementById(id);
function change(id, value, type = 'input') {
  field(id).value = value;
  field(id).dispatchEvent(new Event(type, { bubbles: true }));
}
const respond = body => ({ ok: true, json: async () => body });
const settle = () => vi.advanceTimersByTimeAsync(0);
async function open({ fetchImpl = async () => respond(rates), now = '2026-11-12T12:00:00Z', wait = true } = {}) {
  vi.resetModules();
  vi.useFakeTimers({ now: new Date(now) });
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  document.documentElement.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/main.ts');
  if (wait) await settle();
  return fetchMock;
}
beforeEach(() => open());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
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
it('shows the yen equivalent next to the main amount and announces it', async () => {
  expect(field('equivalent-yen').hidden).toBe(false);
  expect(field('equivalent-yen').textContent).toBe('≈ JP¥12,739 at today\'s rate');
  change('home', '4000.01');
  await vi.advanceTimersByTimeAsync(450);
  expect(field('result-announcement').textContent).toBe(
    'Equivalent cost at the same share of income US$80.00, about JP¥12,739 at today\'s rate. Price at the exchange rate US$31.40.',
  );
  change('currency', 'EUR', 'change');
  expect(field('equivalent-yen').textContent).toBe('≈ JP¥14,174 at today\'s rate');
  change('currency', 'GBP', 'change');
  expect(field('equivalent-yen').textContent).toBe('≈ JP¥16,951 at today\'s rate');
});
it('hides the yen equivalent without a rate, without an income, or for yen', async () => {
  change('home', '');
  expect(field('equivalent-yen').hidden).toBe(true);
  expect(field('equivalent-yen').textContent).toBe('');
  change('home', '4000');
  expect(field('equivalent-yen').hidden).toBe(false);
  field('currency').add(new Option('JPY', 'JPY'));
  change('currency', 'JPY', 'change');
  expect(field('equivalent-yen').hidden).toBe(true);
  await open({ fetchImpl: async () => { throw new Error('offline'); } });
  expect(field('equivalent').textContent).toBe('US$80.00');
  expect(field('equivalent-yen').hidden).toBe(true);
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
  expect(field('result-announcement').textContent).toBe('Equivalent cost at the same share of income US$80.01, about JP¥12,740 at today\'s rate. Price at the exchange rate US$31.40.');
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

const optionCodes = () => Array.from(field('currency').options, option => option.value);
const codesWithout = (...omitted) => Object.keys(rates.unitsPerEuro).filter(code => code !== 'JPY' && !omitted.includes(code));

it('lists every currency in the loaded snapshot except JPY, with USD first and names', () => {
  expect(optionCodes()).toEqual(['USD', ...codesWithout('USD')]);
  expect(optionCodes()).toContain('EUR');
  expect(optionCodes()).not.toContain('JPY');
  expect(optionCodes().length).toBe(29);
  expect(field('currency').options[0].textContent).toBe('USD · US Dollar');
  expect(field('currency').selectedOptions[0].value).toBe('USD');
});

it('shows the source, full date, and numeric pair for an available rate', () => {
  expect(field('rate-pair').hidden).toBe(false);
  expect(field('rate-pair').textContent).toBe('Exchange rate used: 1 USD = 159.234 JPY');
  expect(field('rate-note').textContent).toBe(' · November 11, 2026');
  const link = field('rate-note').parentElement.querySelector('a');
  expect(link.textContent).toBe('European Central Bank reference rates');
  expect(link.getAttribute('aria-label')).toBe('European Central Bank reference rates (opens in a new tab)');
  expect(link.href).toContain('ecb.europa.eu');
  change('currency', 'EUR', 'change');
  expect(field('rate-pair').textContent).toBe('Exchange rate used: 1 EUR = 177.18 JPY');
  expect(field('converted').textContent).toBe('€28.22');
  change('currency', 'GBP', 'change');
  expect(field('rate-pair').textContent).toBe('Exchange rate used: 1 GBP = 211.892 JPY');
});

it('shows the snapshot source as the link text instead of assuming the ECB', async () => {
  await open({ fetchImpl: async () => respond({ ...rates, source: 'Example Rates Desk' }) });
  expect(field('rate-source').textContent).toBe('Example Rates Desk reference rates');
});

it('keeps the default source link text while rates are loading or unavailable', async () => {
  await open({ fetchImpl: async () => { throw new TypeError('offline'); } });
  expect(field('rate-source').textContent).toBe('ECB reference rates');
  expect(field('rate-source').getAttribute('aria-label')).toBe('ECB reference rates (opens in a new tab)');
});

it.each([
  ['2026-11-18T23:59:59Z', false],
  ['2026-11-19T00:00:00Z', true],
])('marks the November 11 snapshot outdated only after seven calendar days (%s)', async (now, outdated) => {
  await open({ now });
  expect(field('rate-note').textContent.includes('Outdated')).toBe(outdated);
  expect(field('rate-note').textContent).toContain('November 11, 2026');
  expect(field('converted').textContent).toBe('US$31.40');
  expect(field('rate-pair').hidden).toBe(false);
});

it('requests only the same-origin rates asset and never sends or stores entered amounts', async () => {
  const fetchMock = await open();
  change('price', '123456');
  change('home', '9999');
  change('currency', 'EUR', 'change');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/rates.json');
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it.each([
  ['a failed request', () => Promise.reject(new Error('offline'))],
  ['a missing asset', async () => ({ ok: false, json: async () => ({}) })],
  ['malformed JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } })],
  ['a snapshot without JPY', async () => respond({ ...rates, unitsPerEuro: { EUR: 1, USD: 1.1 } })],
  ['an undated snapshot', async () => respond({ source: rates.source, unitsPerEuro: rates.unitsPerEuro })],
  ['an invalid rate', async () => respond({ ...rates, unitsPerEuro: { ...rates.unitsPerEuro, USD: 0 } })],
])('keeps income-based results and the picker when the rates asset is unavailable: %s', async (_name, fetchImpl) => {
  await open({ fetchImpl });
  expect(field('rate-note').textContent).toBe(' · Exchange rate unavailable');
  expect(field('rate-pair').hidden).toBe(true);
  expect(field('converted').textContent).toBe('—');
  expect(field('home-share').textContent).toBe('—');
  expect(field('equivalent').textContent).toBe('US$80.00');
  expect(field('japan-share').textContent).toBe('2%');
  expect(optionCodes().length).toBe(29);
  expect(optionCodes()).toContain('ZAR');
  expect(field('home').value).toBe('4,000.00');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('');
  change('home', '3000');
  expect(field('equivalent').textContent).toBe('€60.00');
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('Equivalent cost at the same share of income €60.00. Exchange rate unavailable.');
});

it('shows a loading state, then prefills unvisited currencies but keeps cleared incomes', async () => {
  let resolve;
  await open({ fetchImpl: () => new Promise(done => { resolve = done; }), wait: false });
  expect(field('rate-note').textContent).toBe(' · Loading exchange rate…');
  expect(field('equivalent').textContent).toBe('US$80.00');
  expect(field('converted').textContent).toBe('—');
  change('currency', 'EUR', 'change');
  expect(field('home').value).toBe('');
  change('currency', 'GBP', 'change');
  change('home', '');
  change('currency', 'EUR', 'change');
  resolve(respond(rates));
  await settle();
  expect(field('rate-note').textContent).toBe(' · November 11, 2026');
  expect(field('home').value).toBe('4,000');
  expect(field('converted').textContent).toBe('€28.22');
  change('currency', 'GBP', 'change');
  expect(field('home').value).toBe('');
});

it('falls back to USD when the loaded snapshot no longer lists the selected currency', async () => {
  let resolve;
  await open({ fetchImpl: () => new Promise(done => { resolve = done; }), wait: false });
  change('currency', 'ZAR', 'change');
  const { ZAR, ...unitsPerEuro } = rates.unitsPerEuro;
  expect(ZAR).toBeGreaterThan(0);
  resolve(respond({ ...rates, unitsPerEuro }));
  await settle();
  expect(optionCodes()).not.toContain('ZAR');
  expect(field('currency').value).toBe('USD');
  expect(field('home').value).toBe('4,000.00');
  expect(field('converted').textContent).toBe('US$31.40');
});

it('falls back to the first listed currency when the snapshot has no USD, including after Reset', async () => {
  const { USD, ...unitsPerEuro } = rates.unitsPerEuro;
  expect(USD).toBeGreaterThan(0);
  await open({ fetchImpl: async () => respond({ ...rates, unitsPerEuro }) });
  expect(optionCodes()).not.toContain('USD');
  expect(field('currency').value).toBe('AUD');
  expect(field('home-prefix').textContent).toBe('A$');
  expect(field('home').value).toBe('');
  change('home', '5000');
  expect(field('equivalent').textContent).toBe('A$100.00');
  change('currency', 'GBP', 'change');
  field('reset').click();
  expect(field('currency').value).toBe('AUD');
  expect(field('home-prefix').textContent).toBe('A$');
});

it('announces the converted price when rates arrive after the visitor starts typing', async () => {
  let resolve;
  await open({ fetchImpl: () => new Promise(done => { resolve = done; }), wait: false });
  change('price', '6000');
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('Equivalent cost at the same share of income US$96.00.');
  resolve(respond(rates));
  await settle();
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('Equivalent cost at the same share of income US$96.00, about JP¥15,286 at today\'s rate. Price at the exchange rate US$37.68.');
});

it('stays quiet when rates arrive before the visitor has touched the form', async () => {
  await open();
  vi.advanceTimersByTime(450);
  expect(field('result-announcement').textContent).toBe('');
});
