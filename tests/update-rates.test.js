import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RateDataError } from '../src/rate-snapshot.ts';
import { buildSnapshot, fetchEcbXml, parseEcbXml, optionValue, updateRates, updateRatesWithFallback } from '../scripts/update-rates.mjs';

const xml = readFileSync('tests/fixtures/ecb-daily.xml', 'utf8');
const expected = JSON.parse(readFileSync('tests/fixtures/rates.json', 'utf8'));
const now = Date.parse('2026-11-12T12:00:00Z');
const feed = (date, ...cubes) => `<gesmes:Envelope><Cube><Cube time='${date}'>${cubes.map(([code, rate]) => `<Cube currency='${code}' rate='${rate}'/>`).join('')}</Cube></Cube></gesmes:Envelope>`;
const respond = (body, init = {}) => async () => ({ ok: true, status: 200, text: async () => body, ...init });

describe('ECB feed parsing', () => {
  it('turns the daily XML into a dated snapshot with EUR added at 1', () => {
    const snapshot = buildSnapshot(xml, now);
    expect(snapshot).toEqual(expected);
    expect(snapshot.source).toBe('European Central Bank');
    expect(snapshot.date).toBe('2026-11-11');
    expect(snapshot.unitsPerEuro.EUR).toBe(1);
    expect(snapshot.unitsPerEuro.JPY).toBe(177.18);
    expect(Object.keys(snapshot.unitsPerEuro).length).toBe(30);
  });

  it('accepts double-quoted attributes in any order', () => {
    const { date, rates } = parseEcbXml('<Cube time="2026-11-11"><Cube rate="1.5" currency="JPY"/><Cube rate="2" currency="USD" /></Cube>');
    expect(date).toBe('2026-11-11');
    expect(rates).toEqual({ JPY: 1.5, USD: 2 });
  });

  it.each([
    ['a missing date', '<Cube><Cube currency="JPY" rate="177"/></Cube>'],
    ['two dates', '<Cube time="2026-11-11"><Cube currency="JPY" rate="177"/></Cube><Cube time="2026-11-10"/>'],
    ['an impossible date', feed('2026-02-30', ['JPY', '177'])],
    ['a month 13 date', feed('2026-13-01', ['JPY', '177'])],
    ['a non-ISO date', feed('11/11/2026', ['JPY', '177'])],
    ['no currencies', feed('2026-11-11')],
    ['an empty body', ''],
    ['an HTML error page', '<html><body>Service unavailable</body></html>'],
  ])('rejects %s', (_name, body) => {
    expect(() => buildSnapshot(body, now)).toThrow(RateDataError);
  });

  it.each(['0', '0.0', '-1.2', 'abc', '', '1e3', 'NaN', 'Infinity', '1,5', '.5'])('rejects the rate %j', (rate) => {
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', '177'], ['USD', rate]), now)).toThrow(/invalid USD rate/);
  });

  it('rejects invalid or duplicated currency codes and a missing JPY rate', () => {
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', '177'], ['usd', '1.1']), now)).toThrow(/invalid currency/);
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', '177'], ['USDX', '1.1']), now)).toThrow(/invalid currency/);
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', '177'], ['USD', '1.1'], ['USD', '1.2']), now)).toThrow(/more than once/);
    expect(() => buildSnapshot(feed('2026-11-11', ['USD', '1.1'], ['GBP', '0.8']), now)).toThrow(/missing the JPY rate/);
  });

  it('rejects an EUR entry other than 1 and a date more than a day in the future', () => {
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', '177'], ['EUR', '2']), now)).toThrow(/EUR/);
    expect(() => buildSnapshot(feed('2026-11-14', ['JPY', '177']), now)).toThrow(/in the future/);
    expect(buildSnapshot(feed('2026-11-13', ['JPY', '177']), now).date).toBe('2026-11-13');
  });
});

describe('stale and implausible feeds', () => {
  it('accepts a feed up to seven days old and rejects an older one', () => {
    expect(buildSnapshot(feed('2026-11-05', ['JPY', '177']), now).date).toBe('2026-11-05');
    expect(() => buildSnapshot(feed('2026-11-04', ['JPY', '177']), now)).toThrow(/outdated/);
  });

  it.each(['1.77', '49.9', '500.1', '17700'])('rejects a yen rate of %s per euro', (rate) => {
    expect(() => buildSnapshot(feed('2026-11-11', ['JPY', rate]), now)).toThrow(/JPY.*expected/);
  });

  it('keeps the previous asset when a refresh serves a stale feed', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'rates-stale-'));
    const output = path.join(directory, 'rates.json');
    try {
      await updateRates({ fetchImpl: respond(xml), output, now });
      const before = await readFile(output, 'utf8');
      const stale = xml.replace("time='2026-11-11'", "time='2026-10-01'");
      await expect(updateRates({ fetchImpl: respond(stale), output, now })).rejects.toThrow(/outdated/);
      expect(await readFile(output, 'utf8')).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('fetching', () => {
  it('requests the given URL and returns the response text', async () => {
    const calls = [];
    const text = await fetchEcbXml(async (...args) => { calls.push(args); return { ok: true, text: async () => 'body' }; }, 'https://example.test/feed.xml');
    expect(text).toBe('body');
    expect(calls[0][0]).toBe('https://example.test/feed.xml');
  });

  it('fails on a network error, an HTTP error, or an oversized body', async () => {
    await expect(fetchEcbXml(async () => { throw new TypeError('fetch failed'); })).rejects.toThrow(/Could not fetch the ECB feed: fetch failed/);
    await expect(fetchEcbXml(respond('', { ok: false, status: 503 }))).rejects.toThrow(/HTTP 503/);
    await expect(fetchEcbXml(respond('x'.repeat(1_000_001)))).rejects.toThrow(/unexpectedly large/);
  });
});

describe('bounding the response size', () => {
  const streamOf = (...chunks) => new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  }));

  it('reads a streamed body, including multibyte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('¥ rates');
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    }));
    expect(await fetchEcbXml(async () => response)).toBe('¥ rates');
  });

  it('stops reading a stream that exceeds the limit', async () => {
    let pulls = 0;
    const endless = new Response(new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(400_000)));
      },
    }));
    await expect(fetchEcbXml(async () => endless)).rejects.toThrow(/unexpectedly large/);
    expect(pulls).toBeLessThan(10);
  });

  it('rejects a declared length over the limit without reading the body', async () => {
    const response = new Response(streamOf('x').body, { headers: { 'content-length': '2000000' } });
    await expect(fetchEcbXml(async () => response)).rejects.toThrow(/unexpectedly large/);
  });

  it('counts bytes, not characters, for plain-text responses', async () => {
    await expect(fetchEcbXml(respond('¥'.repeat(600_000)))).rejects.toThrow(/unexpectedly large/);
  });
});

describe('writing the asset', () => {
  let directory;
  let output;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'rates-test-'));
    output = path.join(directory, 'public', 'rates.json');
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('writes validated JSON and leaves no temporary files', async () => {
    const result = await updateRates({ fetchImpl: respond(xml), output, now });
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(expected);
    expect(result.snapshot).toEqual(expected);
    expect(result.warnings).toEqual([]);
    expect(await readdir(path.dirname(output))).toEqual(['rates.json']);
  });

  it('warns, without failing, when the feed differs from the bundled currency list', async () => {
    const changed = xml.replace("<Cube currency='ZAR' rate='18.5219'/>", "<Cube currency='XYZ' rate='2'/>");
    const { warnings } = await updateRates({ fetchImpl: respond(changed), output, now });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('new: XYZ');
    expect(warnings[0]).toContain('missing: ZAR');
  });

  it.each([
    ['a failed fetch', async () => { throw new Error('offline'); }],
    ['an HTTP error', respond('', { ok: false, status: 500 })],
    ['a missing JPY rate', respond(xml.replace("<Cube currency='JPY' rate='177.18'/>", ''))],
    ['an invalid date', respond(xml.replace("time='2026-11-11'", "time='2026-99-99'"))],
    ['an invalid rate', respond(xml.replace("rate='1.1127'", "rate='0'"))],
    ['truncated XML', respond(xml.slice(0, 400))],
  ])('keeps the previous verified asset after %s', async (_name, fetchImpl) => {
    await updateRates({ fetchImpl: respond(xml), output, now });
    const before = await readFile(output, 'utf8');
    await expect(updateRates({ fetchImpl, output, now })).rejects.toThrow(RateDataError);
    expect(await readFile(output, 'utf8')).toBe(before);
    expect(await readdir(path.dirname(output))).toEqual(['rates.json']);
  });

  it('does not create an asset when the first update fails', async () => {
    await expect(updateRates({ fetchImpl: respond('<nope/>'), output, now })).rejects.toThrow(RateDataError);
    expect(existsSync(output)).toBe(false);
  });

  it('replaces an older asset with newer verified data', async () => {
    await updateRates({ fetchImpl: respond(xml), output, now });
    const newer = xml.replace("time='2026-11-11'", "time='2026-11-12'").replace("rate='177.18'", "rate='176.96'");
    await updateRates({ fetchImpl: respond(newer), output, now });
    const written = JSON.parse(await readFile(output, 'utf8'));
    expect(written.date).toBe('2026-11-12');
    expect(written.unitsPerEuro.JPY).toBe(176.96);
  });
});

describe('published snapshot fallback', () => {
  let dir;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'rates-fallback-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const fallbackUrl = 'https://example.test/rates.json';
  const route = (ecb, published) => async (url) => (String(url) === fallbackUrl ? published() : ecb());
  const down = async () => { throw new Error('offline'); };
  const json = (value) => async () => ({ ok: true, status: 200, text: async () => value });

  it('uses the ECB feed and ignores the fallback when the feed works', async () => {
    const output = path.join(dir, 'rates.json');
    const result = await updateRatesWithFallback({ fetchImpl: route(respond(xml), json('{}')), output, now, fallbackUrl });
    expect(result.usedFallback).toBe(false);
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(expected);
  });

  it('writes the validated published snapshot when the ECB fetch fails', async () => {
    const output = path.join(dir, 'rates.json');
    const result = await updateRatesWithFallback({ fetchImpl: route(down, json(JSON.stringify(expected))), output, now, fallbackUrl });
    expect(result.usedFallback).toBe(true);
    expect(result.warnings[0]).toContain('offline');
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(expected);
  });

  it('fails without a fallback URL, and when the published snapshot is unusable', async () => {
    const output = path.join(dir, 'rates.json');
    await expect(updateRatesWithFallback({ fetchImpl: route(down, json('{}')), output, now })).rejects.toThrow(RateDataError);
    await expect(updateRatesWithFallback({ fetchImpl: route(down, json('{}')), output, now, fallbackUrl })).rejects.toThrow(/also unavailable/);
    await expect(updateRatesWithFallback({ fetchImpl: route(down, json('<html>')), output, now, fallbackUrl })).rejects.toThrow(/also unavailable/);
    await expect(updateRatesWithFallback({ fetchImpl: route(down, async () => ({ ok: false, status: 404 })), output, now, fallbackUrl })).rejects.toThrow(/404/);
    expect(existsSync(output)).toBe(false);
  });

  it('rejects a published snapshot that is already outdated', async () => {
    const output = path.join(dir, 'rates.json');
    const old = { ...expected, date: '2026-10-01' };
    await expect(updateRatesWithFallback({ fetchImpl: route(down, json(JSON.stringify(old))), output, now, fallbackUrl })).rejects.toThrow(/outdated/);
  });

  it('does not fall back on errors that are not feed problems', async () => {
    const output = path.join(dir, 'missing', 'rates.json');
    const blocker = path.join(dir, 'missing');
    await (await import('node:fs/promises')).writeFile(blocker, 'a file where a directory is needed');
    await expect(updateRatesWithFallback({ fetchImpl: route(respond(xml), json(JSON.stringify(expected))), output, now, fallbackUrl })).rejects.not.toThrow(RateDataError);
  });
});

describe('command-line options', () => {
  it('reads both --name value and --name=value', () => {
    expect(optionValue(['--fallback-url=https://a.test/x?y=1'], '--fallback-url')).toBe('https://a.test/x?y=1');
    expect(optionValue(['--fallback-url', 'https://a.test'], '--fallback-url')).toBe('https://a.test');
    expect(optionValue([], '--fallback-url')).toBeUndefined();
    expect(() => optionValue(['--fallback-url='], '--fallback-url')).toThrow(RateDataError);
    expect(() => optionValue(['--fallback-url'], '--fallback-url')).toThrow(RateDataError);
  });
});
