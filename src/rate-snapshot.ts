// Shared by the browser app and scripts/update-rates.mjs. Node runs this file
// directly through type stripping, so keep to erasable TypeScript syntax and
// avoid imports.

export interface RateSnapshot {
  source: string;
  date: string;
  unitsPerEuro: Record<string, number>;
}

export class RateDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateDataError';
  }
}

export const rateSource = 'European Central Bank';
export const outdatedAfterDays = 7;
const dayMs = 86_400_000;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Throws a RateDataError unless the value is a complete, verified snapshot. */
export function validateSnapshot(value: unknown): RateSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RateDataError('Rate data must be a JSON object.');
  }
  const { source, date, unitsPerEuro } = value as Record<string, unknown>;
  if (typeof source !== 'string' || source.trim() === '') throw new RateDataError('Rate data is missing its source.');
  if (!isValidIsoDate(date)) throw new RateDataError(`Rate data has an invalid date: ${String(date)}.`);
  if (typeof unitsPerEuro !== 'object' || unitsPerEuro === null || Array.isArray(unitsPerEuro)) {
    throw new RateDataError('Rate data is missing its currency rates.');
  }

  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(unitsPerEuro)) {
    if (!/^[A-Z]{3}$/.test(code)) throw new RateDataError(`Rate data has an invalid currency code: ${code}.`);
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new RateDataError(`Rate data has an invalid ${code} rate: ${String(rate)}.`);
    }
    rates[code] = rate;
  }
  if (!('JPY' in rates)) throw new RateDataError('Rate data is missing the JPY rate.');
  if (rates.EUR !== 1) throw new RateDataError('Rate data must include EUR with a value of 1.');
  return { source, date, unitsPerEuro: Object.fromEntries(Object.entries(rates).sort(([a], [b]) => a.localeCompare(b))) };
}

/** Comparison currencies: every published currency except JPY, with USD first. */
export function comparisonCurrencies(snapshot: RateSnapshot): string[] {
  const codes = Object.keys(snapshot.unitsPerEuro).filter((code) => code !== 'JPY').sort();
  return codes.includes('USD') ? ['USD', ...codes.filter((code) => code !== 'USD')] : codes;
}

/** Yen per one unit of the currency: JPY per EUR divided by target units per EUR. */
export function yenPerUnit(snapshot: RateSnapshot, currency: string): number | null {
  const units = snapshot.unitsPerEuro[currency];
  const jpy = snapshot.unitsPerEuro.JPY;
  if (typeof units !== 'number' || !(units > 0) || !(jpy > 0)) return null;
  return jpy / units;
}

/** Whole UTC calendar days between the publication date and now. */
export function ageInDays(date: string, now: number): number {
  return Math.floor(now / dayMs) - Math.floor(Date.parse(`${date}T00:00:00Z`) / dayMs);
}

/** A snapshot is outdated when it is more than seven calendar days old. */
export function isOutdated(date: string, now: number): boolean {
  return ageInDays(date, now) > outdatedAfterDays;
}
