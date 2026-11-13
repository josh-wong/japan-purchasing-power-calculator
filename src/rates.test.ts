import { describe, expect, it, vi } from 'vitest';
import { loadRates, ratesUrl, type FetchLike } from './rates';
import fixture from '../tests/fixtures/rates.json';

const ok = (body: unknown): FetchLike => async () => ({ ok: true, json: async () => body });

describe('rates URL', () => {
  it.each([
    ['/', '/rates.json'],
    ['/japan-purchasing-power-calculator/', '/japan-purchasing-power-calculator/rates.json'],
    ['/japan-purchasing-power-calculator', '/japan-purchasing-power-calculator/rates.json'],
    ['./', './rates.json'],
  ])('resolves base %s', (base, url) => {
    expect(ratesUrl(base)).toBe(url);
  });

  it('uses the Vite base URL by default', () => {
    expect(ratesUrl()).toBe(`${import.meta.env.BASE_URL}rates.json`);
  });
});

describe('loading', () => {
  it.each(['/', '/japan-purchasing-power-calculator/'])('requests only the asset under %s', async (base) => {
    const fetchImpl = vi.fn(ok(fixture));
    expect(await loadRates(fetchImpl, base)).toEqual(fixture);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${base}rates.json`);
    expect(url).not.toContain('?');
    expect(init).toEqual({ cache: 'no-cache', credentials: 'same-origin', signal: expect.any(AbortSignal) });
    expect(init).not.toHaveProperty('body');
  });

  it.each([
    ['an HTTP error', async () => ({ ok: false, json: async () => fixture })],
    ['a network error', async () => { throw new TypeError('Failed to fetch'); }],
    ['non-JSON content', async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } })],
    ['a null body', ok(null)],
    ['a snapshot without JPY', ok({ ...fixture, unitsPerEuro: { EUR: 1, USD: 1.1 } })],
    ['a snapshot with a bad date', ok({ ...fixture, date: 'yesterday' })],
    ['a snapshot with a bad rate', ok({ ...fixture, unitsPerEuro: { ...fixture.unitsPerEuro, USD: -2 } })],
  ] as [string, FetchLike][])('returns null for %s', async (_name, fetchImpl) => {
    expect(await loadRates(fetchImpl, '/')).toBeNull();
  });
});

describe('stalled requests', () => {
  const abortable = (signal: AbortSignal | null | undefined) => new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

  it('gives up on a request that never responds', async () => {
    const started = Date.now();
    expect(await loadRates((_url, init) => abortable(init?.signal), '/', 20)).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('gives up on a response body that never finishes', async () => {
    const stalled: FetchLike = (_url, init) => Promise.resolve({ ok: true, json: () => abortable(init?.signal) });
    expect(await loadRates(stalled, '/', 20)).toBeNull();
  });
});
