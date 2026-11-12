// Deterministic migration fixture, not a live rate feed. See issue #1.
export const savedRates: { date: string; unitsPerEuro: Record<string, number> } = {
  date: '2026-11-11',
  unitsPerEuro: {
    JPY: 177.18, EUR: 1, USD: 1.1127, AUD: 1.6222, CAD: 1.5839,
    GBP: 0.83618, HKD: 8.7298, KRW: 1487.57, NZD: 1.9928, SGD: 1.4271, CHF: 0.9234,
  },
};
