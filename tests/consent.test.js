// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

import rates from './fixtures/rates.json';

const measurementId = 'G-TEST1234';
const consentKey = 'japan-purchasing-power.analytics-consent';
// Cookies another site on the same domain (such as the main 080f53.com site) may set; this app must never remove them.
const otherSiteCookies = ['_ga=GA1.1.900.901', '_ga_PMP34RZWN2P=GS1.1.902'];
function setOtherSiteCookies() {
  for (const cookie of otherSiteCookies) document.cookie = `${cookie}; path=/`;
}
const cookieList = () => document.cookie.split('; ').filter(Boolean).sort();
const pages = {
  calculator: { html: readFileSync('index.html', 'utf8'), entry: '../src/main.ts' },
  privacy: { html: readFileSync('privacy.html', 'utf8'), entry: '../src/privacy.ts' },
};
const field = id => document.getElementById(id);
const panel = () => field('analytics-consent');
const button = name => Array.from(panel().querySelectorAll('button')).find(item => item.textContent === name);
const googleScripts = () => document.querySelectorAll('script[src*="googletagmanager.com"]');
const dataLayerText = () => JSON.stringify((window.dataLayer ?? []).map(entry => Array.from(entry)));
function change(id, value, type = 'input') {
  field(id).value = value;
  field(id).dispatchEvent(new Event(type, { bubbles: true }));
}
function storedChoice() {
  return JSON.parse(localStorage.getItem(consentKey) ?? 'null')?.choice ?? null;
}

async function open({ id = measurementId, page = 'calculator', now = '2026-11-13T12:00:00Z' } = {}) {
  vi.resetModules();
  vi.useFakeTimers({ now: new Date(now) });
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', id);
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => rates }));
  vi.stubGlobal('fetch', fetchMock);
  document.documentElement.innerHTML = pages[page].html.replace(/<script[\s\S]*?<\/script>/g, '');
  await import(pages[page].entry);
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
  return fetchMock;
}

function setSignal(name, value) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
  delete navigator.globalPrivacyControl;
  delete navigator.doNotTrack;
  delete window.dataLayer;
  delete window.gtag;
  delete window[`ga-disable-${measurementId}`];
});

it('adds no consent panel, settings control, or Google request when no measurement ID is configured', async () => {
  const fetchMock = await open({ id: '' });
  expect(panel()).toBeNull();
  expect(field('analytics-settings')).toBeNull();
  expect(googleScripts().length).toBe(0);
  expect(window.dataLayer).toBeUndefined();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/rates.json']);
});

it('asks first and contacts Google only after the visitor allows analytics', async () => {
  setOtherSiteCookies();
  const fetchMock = await open();
  expect(panel().hidden).toBe(false);
  expect(document.body.firstElementChild).toBe(panel());
  expect(panel().getAttribute('aria-labelledby')).toBe('consent-title');
  expect(button('Allow analytics').hidden).toBe(false);
  expect(button('Decline').hidden).toBe(false);
  expect(panel().querySelector('a').getAttribute('href')).toBe('privacy.html');
  expect(googleScripts().length).toBe(0);
  expect(window.dataLayer).toBeUndefined();
  expect(cookieList()).toEqual(otherSiteCookies);

  change('price', '123456');
  change('japan', '7654321');
  change('home', '9999');
  change('currency', 'KRW', 'change');
  change('preset', '30000', 'change');
  expect(googleScripts().length).toBe(0);

  button('Allow analytics').focus();
  button('Allow analytics').click();
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(document.querySelector('h1'));
  expect(googleScripts().length).toBe(1);
  expect(googleScripts()[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  expect(storedChoice()).toBe('granted');
  expect(Object.keys(localStorage)).toEqual([consentKey]);

  change('price', '24680');
  change('home', '13579');
  for (const value of ['123456', '123,456', '7654321', '9999', '9,999', 'KRW', '30000', '24680', '13579']) {
    expect(dataLayerText()).not.toContain(value);
  }
  expect(dataLayerText()).toContain('"allow_google_signals":false');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/rates.json']);
  expect(field('equivalent').textContent).not.toBe('—');

  await vi.advanceTimersByTimeAsync(50);
  expect(field('consent-announcement').getAttribute('role')).toBe('status');
  expect(field('consent-announcement').textContent).toBe('Analytics allowed. You can change this anytime with Analytics settings at the bottom of the page.');
});

it('collects nothing after a decline and remembers either choice on the next visit', async () => {
  await open();
  button('Decline').click();
  expect(panel().hidden).toBe(true);
  expect(storedChoice()).toBe('denied');
  expect(googleScripts().length).toBe(0);
  expect(window.dataLayer).toBeUndefined();
  await vi.advanceTimersByTimeAsync(50);
  expect(field('consent-announcement').textContent).toBe('Analytics off. You can change this anytime with Analytics settings at the bottom of the page.');

  await open();
  expect(panel().hidden).toBe(true);
  expect(googleScripts().length).toBe(0);

  localStorage.setItem(consentKey, JSON.stringify({ choice: 'granted', at: '2026-11-01T00:00:00.000Z', version: 1 }));
  await open();
  expect(panel().hidden).toBe(true);
  expect(googleScripts().length).toBe(1);
});

it('withdraws consent from Analytics settings, stops collection, and deletes the analytics cookies', async () => {
  await open();
  button('Allow analytics').click();
  setOtherSiteCookies();
  document.cookie = 'jppc_ga=GA1.1.111.222; path=/';
  document.cookie = 'jppc_ga_TEST1234=GS1.1.333; path=/';

  const settings = field('analytics-settings');
  expect(settings.closest('#footer-links')).not.toBeNull();
  expect(settings.getAttribute('aria-controls')).toBe('analytics-consent');
  settings.focus();
  settings.click();
  expect(panel().hidden).toBe(false);
  expect(settings.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(panel());
  expect(panel().querySelector('.consent-status').textContent).toBe('Analytics is currently allowed.');

  button('Decline').click();
  expect(window[`ga-disable-${measurementId}`]).toBe(true);
  expect(Array.from(window.dataLayer.at(-1))).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  expect(cookieList()).toEqual(otherSiteCookies);
  expect(storedChoice()).toBe('denied');
  expect(panel().hidden).toBe(true);
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(settings);

  settings.click();
  expect(panel().querySelector('.consent-status').textContent).toBe('Analytics is currently off.');
});

it.each([
  ['Global Privacy Control', 'globalPrivacyControl', true],
  ['Do Not Track', 'doNotTrack', '1'],
])('treats %s as a decline without asking, even over an earlier opt-in', async (_name, signal, value) => {
  localStorage.setItem(consentKey, JSON.stringify({ choice: 'granted', at: '2026-11-01T00:00:00.000Z', version: 1 }));
  document.cookie = 'jppc_ga=GA1.1.111.222; path=/';
  setOtherSiteCookies();
  setSignal(signal, value);
  await open();
  expect(panel().hidden).toBe(true);
  expect(googleScripts().length).toBe(0);
  expect(window.dataLayer).toBeUndefined();
  expect(cookieList()).toEqual(otherSiteCookies);

  field('analytics-settings').click();
  expect(panel().querySelector('.consent-status').textContent)
    .toBe('Your browser is sending a Global Privacy Control or Do Not Track signal, so analytics stays off.');
  expect(button('Allow analytics').hidden).toBe(true);
  expect(button('Decline').hidden).toBe(true);
  button('Close').click();
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(field('analytics-settings'));
  expect(googleScripts().length).toBe(0);
});

it('keeps the calculator working and asks on each visit when browser storage is blocked', async () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage is blocked', 'SecurityError');
  });
  await open();
  expect(panel().hidden).toBe(false);
  expect(field('equivalent').textContent).toBe('US$80.00');
  button('Allow analytics').click();
  expect(googleScripts().length).toBe(1);
  await vi.advanceTimersByTimeAsync(50);
  expect(field('consent-announcement').textContent).toBe('Analytics allowed for this visit. You can change this anytime with Analytics settings at the bottom of the page.');

  await open();
  expect(panel().hidden).toBe(false);
  expect(googleScripts().length).toBe(0);
});

it.each([
  ['an expired choice', { choice: 'granted', at: '2025-11-13T12:00:00.000Z', version: 1 }],
  ['a choice made under an earlier notice', { choice: 'granted', at: '2026-11-01T00:00:00.000Z', version: 0 }],
])('asks again instead of loading analytics for %s', async (_name, record) => {
  localStorage.setItem(consentKey, JSON.stringify(record));
  await open();
  expect(panel().hidden).toBe(false);
  expect(googleScripts().length).toBe(0);
  expect(localStorage.getItem(consentKey)).toBeNull();
});

it('offers the same choice on the privacy notice without linking to itself', async () => {
  await open({ page: 'privacy' });
  expect(panel().hidden).toBe(false);
  expect(panel().querySelector('a')).toBeNull();
  expect(field('analytics-settings').closest('#footer-links')).not.toBeNull();
  button('Allow analytics').focus();
  button('Allow analytics').click();
  expect(document.activeElement.textContent).toBe('Privacy notice');
  expect(googleScripts().length).toBe(1);
});
