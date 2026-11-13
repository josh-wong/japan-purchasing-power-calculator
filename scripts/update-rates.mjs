#!/usr/bin/env node
// Fetches the ECB daily reference rates and writes validated same-origin JSON.
// Usage: node scripts/update-rates.mjs [--out public/rates.json]
// Exits non-zero, and leaves any existing asset untouched, on a failed fetch or invalid data.
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundledCurrencyCodes } from '../src/currencies.ts';
import {
  RateDataError, ageInDays, comparisonCurrencies, isOutdated, isValidIsoDate, outdatedAfterDays, rateSource, validateSnapshot,
} from '../src/rate-snapshot.ts';

export const ecbDailyUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const defaultOutput = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/rates.json');
// A broad sanity band for yen per euro (about 177 in 2026) that catches gross feed or parsing errors.
const jpyPerEuroRange = [50, 500];
const maxXmlLength = 1_000_000;

function attributes(tag) {
  const found = {};
  for (const [, name, , value] of tag.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)) found[name] = value;
  return found;
}

/** Parses the ECB daily XML into `{ date, rates }`, where rates holds raw numbers keyed by currency. */
export function parseEcbXml(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') throw new RateDataError('The ECB feed was empty.');
  const dates = [];
  const rates = {};
  for (const [, body] of xml.matchAll(/<Cube\b([^>]*?)\/?>/g)) {
    const { time, currency, rate } = attributes(body);
    if (time !== undefined) dates.push(time);
    if (currency === undefined && rate === undefined) continue;
    if (!/^[A-Z]{3}$/.test(currency ?? '')) throw new RateDataError(`The ECB feed has an invalid currency code: ${currency}.`);
    if (!/^\d+(?:\.\d+)?$/.test(rate ?? '')) throw new RateDataError(`The ECB feed has an invalid ${currency} rate: ${rate}.`);
    if (currency in rates) throw new RateDataError(`The ECB feed lists ${currency} more than once.`);
    rates[currency] = Number(rate);
  }
  if (dates.length !== 1) throw new RateDataError(`The ECB feed must contain exactly one publication date, found ${dates.length}.`);
  if (!isValidIsoDate(dates[0])) throw new RateDataError(`The ECB feed has an invalid date: ${dates[0]}.`);
  if (Object.keys(rates).length === 0) throw new RateDataError('The ECB feed has no currency rates.');
  return { date: dates[0], rates };
}

/**
 * Builds the verified snapshot from feed XML. `now` rejects publication dates more than a day in
 * the future and dates the app would flag as outdated, so a stale feed stops publication.
 */
export function buildSnapshot(xml, now = Date.now()) {
  const { date, rates } = parseEcbXml(xml);
  if (ageInDays(date, now) < -1) throw new RateDataError(`The ECB feed date is in the future: ${date}.`);
  if (isOutdated(date, now)) throw new RateDataError(`The ECB feed is outdated: it is dated ${date}, more than ${outdatedAfterDays} days ago.`);
  if ('EUR' in rates && rates.EUR !== 1) throw new RateDataError(`The ECB feed lists EUR as ${rates.EUR}, not 1.`);
  const [minJpy, maxJpy] = jpyPerEuroRange;
  if (rates.JPY < minJpy || rates.JPY > maxJpy) {
    throw new RateDataError(`The ECB feed lists JPY as ${rates.JPY} per EUR, outside the expected ${minJpy}-${maxJpy} range.`);
  }
  return validateSnapshot({ source: rateSource, date, unitsPerEuro: { ...rates, EUR: 1 } });
}

export async function fetchEcbXml(fetchImpl = fetch, url = ecbDailyUrl) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/xml' } });
  } catch (error) {
    throw new RateDataError(`Could not fetch the ECB feed: ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok) throw new RateDataError(`Could not fetch the ECB feed: HTTP ${response.status}.`);
  return readLimitedText(response);
}

/** Reads the body as text, stopping as soon as it exceeds `maxXmlLength` bytes. */
async function readLimitedText(response) {
  const tooLarge = () => new RateDataError('The ECB feed was unexpectedly large.');
  const declared = Number(response.headers?.get?.('content-length'));
  if (declared > maxXmlLength) {
    await response.body?.cancel?.();
    throw tooLarge();
  }
  if (!response.body?.getReader) {
    const xml = await response.text();
    if (Buffer.byteLength(xml) > maxXmlLength) throw tooLarge();
    return xml;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let xml = '';
  let received = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    received += chunk.value.byteLength;
    if (received > maxXmlLength) {
      await reader.cancel();
      throw tooLarge();
    }
    xml += decoder.decode(chunk.value, { stream: true });
  }
  return xml + decoder.decode();
}

/**
 * Fetches, validates, and only then replaces the output file. The write goes to a
 * temporary file in the same directory so a failure cannot leave partial output.
 */
export async function updateRates({ fetchImpl = fetch, output = defaultOutput, now = Date.now(), url = ecbDailyUrl } = {}) {
  const snapshot = buildSnapshot(await fetchEcbXml(fetchImpl, url), now);
  const live = new Set(comparisonCurrencies(snapshot));
  const bundled = new Set(bundledCurrencyCodes);
  const warnings = [];
  const added = [...live].filter((code) => !bundled.has(code));
  const removed = [...bundled].filter((code) => !live.has(code));
  if (added.length || removed.length) {
    warnings.push(`The feed's currencies differ from src/currencies.ts (new: ${added.join(', ') || 'none'}; missing: ${removed.join(', ') || 'none'}). Update the bundled list.`);
  }

  await writeSnapshot(snapshot, output);
  return { snapshot, output, warnings };
}

/** Writes the snapshot to `output` through a temporary file in the same directory. */
async function writeSnapshot(snapshot, output) {
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Downloads the snapshot that is already published and validates it, so a build can still ship
 * code changes while the ECB feed is unavailable.
 */
export async function fetchPublishedSnapshot(fetchImpl = fetch, url) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new RateDataError(`Could not fetch the published snapshot: ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok) throw new RateDataError(`Could not fetch the published snapshot: HTTP ${response.status}.`);
  const text = await readLimitedText(response);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RateDataError('The published snapshot is not valid JSON.');
  }
  return validateSnapshot(parsed);
}

/**
 * Updates from the ECB. If that fails and `fallbackUrl` is set, validates and writes the
 * published snapshot instead and reports `usedFallback`.
 */
export async function updateRatesWithFallback({ fallbackUrl, fetchImpl = fetch, output = defaultOutput, ...options } = {}) {
  try {
    return { ...(await updateRates({ fetchImpl, output, ...options })), usedFallback: false };
  } catch (error) {
    if (!fallbackUrl) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    let snapshot;
    try {
      snapshot = await fetchPublishedSnapshot(fetchImpl, fallbackUrl);
    } catch (fallbackError) {
      throw new RateDataError(`${reason} The published snapshot is also unavailable: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`);
    }
    await writeSnapshot(snapshot, output);
    return { snapshot, output, usedFallback: true, warnings: [`${reason} Reused the published snapshot dated ${snapshot.date}.`] };
  }
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  if (!argv[index + 1]) throw new RateDataError(`${name} needs a value.`);
  return argv[index + 1];
}

async function main(argv) {
  const out = optionValue(argv, '--out');
  const output = out === undefined ? defaultOutput : path.resolve(out);
  const fallbackUrl = optionValue(argv, '--fallback-url');
  const { snapshot, warnings, usedFallback } = await updateRatesWithFallback({ output, fallbackUrl });
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  if (usedFallback && process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'rates_fallback=true\n');
  console.log(`Wrote ${Object.keys(snapshot.unitsPerEuro).length} ${usedFallback ? 'published' : 'ECB'} rates dated ${snapshot.date} to ${path.relative(process.cwd(), output) || output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Rate update failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
