#!/usr/bin/env node
// Fetches the ECB daily reference rates and writes validated same-origin JSON.
// Usage: node scripts/update-rates.mjs [--out public/rates.json]
// Exits non-zero, and leaves any existing asset untouched, on a failed fetch or invalid data.
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundledCurrencyCodes } from '../src/currencies.ts';
import { RateDataError, comparisonCurrencies, isValidIsoDate, rateSource, validateSnapshot } from '../src/rate-snapshot.ts';

export const ecbDailyUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const defaultOutput = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/rates.json');
const dayMs = 86_400_000;
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

/** Builds the verified snapshot from feed XML. `now` rejects publication dates in the future. */
export function buildSnapshot(xml, now = Date.now()) {
  const { date, rates } = parseEcbXml(xml);
  if (Date.parse(`${date}T00:00:00Z`) > now + dayMs) throw new RateDataError(`The ECB feed date is in the future: ${date}.`);
  if ('EUR' in rates && rates.EUR !== 1) throw new RateDataError(`The ECB feed lists EUR as ${rates.EUR}, not 1.`);
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
  const xml = await response.text();
  if (xml.length > maxXmlLength) throw new RateDataError('The ECB feed was unexpectedly large.');
  return xml;
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

  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  return { snapshot, output, warnings };
}

async function main(argv) {
  const flag = argv.indexOf('--out');
  const output = flag === -1 ? defaultOutput : path.resolve(argv[flag + 1] ?? '');
  if (flag !== -1 && !argv[flag + 1]) throw new RateDataError('--out needs a file path.');
  const { snapshot, warnings } = await updateRates({ output });
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  console.log(`Wrote ${Object.keys(snapshot.unitsPerEuro).length} ECB rates dated ${snapshot.date} to ${path.relative(process.cwd(), output) || output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Rate update failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
