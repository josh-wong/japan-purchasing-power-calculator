// Last verified comparison currencies from the ECB daily feed (JPY excluded,
// EUR included). The picker uses these when rates.json cannot load.
// scripts/update-rates.mjs warns when the live feed no longer matches.
export const bundledCurrencyCodes = [
  'USD', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS',
  'INR', 'ISK', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR',
];
