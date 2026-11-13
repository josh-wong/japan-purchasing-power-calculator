// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  consentStorageKey, consentVersion, deleteAnalyticsCookies, hasOptOutSignal, measurementId, pageLocation,
  readConsent, startAnalytics, stopAnalytics, writeConsent,
} from './analytics';

const now = Date.parse('2026-11-13T12:00:00Z');
const day = 86_400_000;
const record = (fields: Record<string, unknown>) => JSON.stringify({ choice: 'granted', at: new Date(now).toISOString(), version: consentVersion, ...fields });
type TestWindow = Window & { dataLayer?: IArguments[] } & Record<string, unknown>;
const testWindow = window as unknown as TestWindow;

function clearCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

afterEach(() => {
  localStorage.clear();
  clearCookies();
  document.head.replaceChildren();
  delete testWindow.dataLayer;
  delete testWindow.gtag;
  delete testWindow['ga-disable-G-TEST1234'];
});

describe('measurementId', () => {
  it('accepts a GA4 measurement ID and trims surrounding space', () => {
    expect(measurementId('G-ABC1234')).toBe('G-ABC1234');
    expect(measurementId(' G-ABC1234\n')).toBe('G-ABC1234');
  });

  it.each([undefined, '', 'UA-12345-1', 'G-abc1234', 'G-1', 'G-ABC1234"><script>', 42])('rejects %j', (value) => {
    expect(measurementId(value)).toBeNull();
  });
});

describe('hasOptOutSignal', () => {
  it.each([
    [{ globalPrivacyControl: true }, {}, true],
    [{ doNotTrack: '1' }, {}, true],
    [{}, { doNotTrack: '1' }, true],
    [{ globalPrivacyControl: false, doNotTrack: '0' }, {}, false],
    [{ doNotTrack: 'unspecified' }, { doNotTrack: null }, false],
    [{}, {}, false],
  ])('reads navigator %j and window %j as %s', (nav, win, expected) => {
    expect(hasOptOutSignal(nav, win)).toBe(expected);
  });
});

describe('consent records', () => {
  it('round-trips a choice with its time and notice version', () => {
    expect(writeConsent(localStorage, 'denied', now)).toBe(true);
    expect(JSON.parse(localStorage.getItem(consentStorageKey)!)).toEqual({ choice: 'denied', at: '2026-11-13T12:00:00.000Z', version: consentVersion });
    expect(readConsent(localStorage, now + day)).toEqual({ choice: 'denied', at: '2026-11-13T12:00:00.000Z', version: consentVersion });
  });

  it('keeps a choice for just under a year, then discards it', () => {
    writeConsent(localStorage, 'granted', now);
    expect(readConsent(localStorage, now + 364 * day)?.choice).toBe('granted');
    expect(readConsent(localStorage, now + 365 * day)).toBeNull();
    expect(localStorage.getItem(consentStorageKey)).toBeNull();
  });

  it.each([
    ['an earlier notice version', record({ version: consentVersion - 1 })],
    ['no version', JSON.stringify({ choice: 'granted', at: new Date(now).toISOString() })],
    ['an unknown choice', record({ choice: 'maybe' })],
    ['a future date', record({ at: new Date(now + day).toISOString() })],
    ['an invalid date', record({ at: 'yesterday' })],
    ['malformed JSON', '{"choice":'],
    ['a JSON null', 'null'],
  ])('treats %s as no choice and removes it', (_name, raw) => {
    localStorage.setItem(consentStorageKey, raw);
    expect(readConsent(localStorage, now)).toBeNull();
    expect(localStorage.getItem(consentStorageKey)).toBeNull();
  });

  it('treats missing or failing storage as no recorded choice', () => {
    const failing = {
      getItem() { throw new DOMException('blocked', 'SecurityError'); },
      setItem() { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem() { throw new DOMException('blocked', 'SecurityError'); },
    };
    expect(readConsent(null, now)).toBeNull();
    expect(readConsent(failing, now)).toBeNull();
    expect(writeConsent(null, 'granted', now)).toBe(false);
    expect(writeConsent(failing, 'granted', now)).toBe(false);
  });
});

describe('pageLocation', () => {
  it('drops fragments and every query parameter except campaign tags', () => {
    expect(pageLocation('https://example.com/app/?price=5000&utm_source=newsletter&income=250000#result'))
      .toBe('https://example.com/app/?utm_source=newsletter');
    expect(pageLocation('https://example.com/app/privacy.html#contact')).toBe('https://example.com/app/privacy.html');
    expect(pageLocation('https://example.com/app/?utm_medium=social&utm_campaign=launch&gclid=abc'))
      .toBe('https://example.com/app/?utm_medium=social&utm_campaign=launch');
  });
});

describe('deleteAnalyticsCookies', () => {
  it('removes only this app’s prefixed cookies and keeps other sites’ Google Analytics cookies', () => {
    document.cookie = 'jppc_ga=GA1.1.111.222; path=/';
    document.cookie = 'jppc_ga_TEST1234=GS1.1.333; path=/';
    document.cookie = 'jppc__ga=GA1.1.444.555; path=/';
    document.cookie = '_ga=GA1.1.666.777; path=/';
    document.cookie = '_ga_PMP34RZWN2P=GS1.1.888; path=/';
    document.cookie = 'jppc_gallery=keep; path=/';
    document.cookie = 'other=keep; path=/';
    deleteAnalyticsCookies(document, '/');
    expect(document.cookie.split('; ').sort()).toEqual([
      '_ga=GA1.1.666.777', '_ga_PMP34RZWN2P=GS1.1.888', 'jppc_gallery=keep', 'other=keep',
    ]);
  });
});

describe('startAnalytics and stopAnalytics', () => {
  const id = 'G-TEST1234';
  const entries = () => (testWindow.dataLayer ?? []).map((entry) => Array.from(entry));

  it('queues a privacy-restricted configuration and loads gtag.js once', () => {
    startAnalytics(id, document, '/app/');
    startAnalytics(id, document, '/app/');
    const scripts = document.querySelectorAll('script');
    expect(scripts.length).toBe(1);
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST1234');
    expect(scripts[0].async).toBe(true);
    expect(entries()[0]).toEqual(['consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }]);
    expect(entries().find(([command]) => command === 'config')).toEqual(['config', id, {
      page_location: 'http://localhost:3000/',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: 'none',
      cookie_path: '/app/',
      cookie_prefix: 'jppc',
      cookie_expires: 365 * 86_400,
    }]);
    expect(testWindow.dataLayer?.[0]).not.toBeInstanceOf(Array);
  });

  it('stops collection after withdrawal and resumes without loading the script again', () => {
    startAnalytics(id, document, '/');
    document.cookie = 'jppc_ga=GA1.1.111.222; path=/';
    stopAnalytics(id, document, '/');
    expect(testWindow['ga-disable-G-TEST1234']).toBe(true);
    expect(entries().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(document.cookie).toBe('');
    startAnalytics(id, document, '/');
    expect(testWindow['ga-disable-G-TEST1234']).toBe(false);
    expect(entries().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(document.querySelectorAll('script').length).toBe(1);
  });
});
