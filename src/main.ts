import { parseAmount, calculate } from './calculator';
import { bundledCurrencyCodes } from './currencies';
import { comparisonCurrencies, isOutdated, yenPerUnit, type RateSnapshot } from './rate-snapshot';
import { loadRates } from './rates';

const currencySymbols: Record<string, string> = { USD: 'US$', JPY: 'JP¥', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', HKD: 'HK$', SGD: 'S$' };
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element;
}
const presetField = byId('preset') as HTMLSelectElement;
const priceField = byId('price') as HTMLInputElement;
const defaultPreset = priceField.defaultValue.replaceAll(',', '');
const wholeNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const japanField = byId('japan') as HTMLInputElement;
const homeField = byId('home') as HTMLInputElement;
const currencyField = byId('currency') as HTMLSelectElement;
const defaultCurrency = 'USD';
const homePayByCurrency = new Map([[defaultCurrency, homeField.defaultValue]]);
const homeErrorByCurrency = new Map<string, string>();
const form = document.querySelector('form')!;
const moneyFormatters = new Map<string, Intl.NumberFormat>();
const rateFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const percentFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
let currencyNames: Intl.DisplayNames | undefined;
let snapshot: RateSnapshot | null = null;
let ratesStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
let announcementTimer: ReturnType<typeof setTimeout> | undefined;
// Results are announced only after the visitor has used the form, never for the initial page load.
let hasInteracted = false;

function moneyFormatter(currency: string) {
  if (!moneyFormatters.has(currency)) {
    moneyFormatters.set(currency, new Intl.NumberFormat('en-US', { style: 'currency', currency }));
  }
  return moneyFormatters.get(currency)!;
}

function enteredMoneyFormatter(currency: string, precision: number) {
  const standard = moneyFormatter(currency);
  if (precision <= (standard.resolvedOptions().maximumFractionDigits ?? 2)) return standard;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: precision, maximumFractionDigits: precision,
  });
}

function formatMoney(amount: number, currency: string, precision = 0) {
  const formatter = enteredMoneyFormatter(currency, precision);
  const symbol = currencySymbols[currency];
  if (!symbol) return formatter.format(amount);
  return formatter.formatToParts(amount)
    .filter((part) => part.type !== 'literal' || part.value.trim() !== '')
    .map((part) => part.type === 'currency' ? symbol : part.value)
    .join('');
}

function moneySymbol(currency: string) {
  return currencySymbols[currency] ?? moneyFormatter(currency).formatToParts(0)
    .find((part) => part.type === 'currency')!.value;
}

function currencyLabel(code: string) {
  let name: string | undefined;
  try {
    currencyNames ??= new Intl.DisplayNames('en', { type: 'currency' });
    name = currencyNames.of(code);
  } catch {
    // Fall back to the bare code when the runtime lacks currency names or cannot name this one.
  }
  return name && name !== code ? `${code} · ${name}` : code;
}

/** USD when listed; otherwise the first listed currency, so the select never ends up empty. */
function preferredCurrency(codes: string[]) {
  return codes.includes(defaultCurrency) ? defaultCurrency : codes[0];
}

function setCurrencyOptions(codes: string[]) {
  const selected = currencyField.value;
  currencyField.replaceChildren(...codes.map((code) => new Option(currencyLabel(code), code)));
  currencyField.value = codes.includes(selected) ? selected : preferredCurrency(codes);
  return currencyField.value !== selected;
}

function rateFor(currency: string) {
  if (!snapshot) return null;
  const yen = yenPerUnit(snapshot, currency);
  if (yen === null) return null;
  const outdated = isOutdated(snapshot.date, Date.now());
  return {
    yenPerUnit: yen,
    note: ` · ${dateFormat.format(new Date(snapshot.date))}${outdated ? ' · Outdated' : ''}`,
  };
}

function exampleIncome(currency: string) {
  const units = snapshot?.unitsPerEuro[currency];
  const usd = snapshot?.unitsPerEuro.USD;
  if (!units || !usd) return null;
  const convertedIncome = Number(homeField.defaultValue.replaceAll(',', '')) * units / usd;
  const increment = convertedIncome >= 100_000 ? 10_000 : 1_000;
  return wholeNumberFormat.format(Math.ceil(convertedIncome / increment) * increment);
}

function showError(field: HTMLInputElement, error: string) {
  if (field === homeField) homeErrorByCurrency.set(currencyField.value, error);
  const message = byId(`${field.id}-error`);
  field.setAttribute('aria-invalid', String(Boolean(error)));
  message.textContent = error;
  message.hidden = !error;
}

function showHomeField() {
  const currency = currencyField.value;
  if (!homePayByCurrency.has(currency)) {
    // An unvisited currency stays unset without a rate, so it can be prefilled once rates load.
    const example = exampleIncome(currency);
    if (example !== null) homePayByCurrency.set(currency, example);
  }
  homeField.value = homePayByCurrency.get(currency) ?? '';
  byId('home-label').textContent = `Monthly income (${currency})`;
  byId('home-prefix').textContent = moneySymbol(currency);
  showError(homeField, homeErrorByCurrency.get(currency) ?? '');
}

function formatShare(share: number | null) {
  if (share === null) return '—';
  return share > 0 && share < 0.0001 ? '<0.01%' : percentFormat.format(share);
}

function spokenShare(text: string) {
  return text === '<0.01%' ? 'less than 0.01%' : text;
}

function render(announce = true) {
  const currency = currencyField.value;
  const price = parseAmount(priceField.value, true, 'JPY');
  const japan = parseAmount(japanField.value, false, 'JPY');
  const home = parseAmount(homeField.value, false, currency);

  if (presetField.value !== '' && price.amount !== Number(presetField.value)) presetField.value = '';

  const rate = rateFor(currency);
  const { japanShare, converted, homeShare, equivalent } = calculate(price.amount, japan.amount, home.amount, rate?.yenPerUnit ?? null);
  const japanShareText = formatShare(japanShare);
  const equivalentText = equivalent === null ? '—' : formatMoney(equivalent, currency);
  const convertedText = converted === null ? '—' : formatMoney(converted, currency);

  let resultNote = 'Enter a price in yen to compare the cost.';
  if (price.amount !== null) {
    if (japan.amount === null) {
      resultNote = 'Enter a monthly income in yen to see the equivalent cost.';
    } else if (home.amount === null) {
      resultNote = 'Enter a comparison income to see the equivalent cost.';
    } else {
      const shareDescription = japanShare !== null && japanShare > 0 && japanShareText !== '<0.01%'
        ? `about ${japanShareText}`
        : spokenShare(japanShareText);
      resultNote = `${formatMoney(price.amount, 'JPY', price.precision)} is ${shareDescription} of the entered income in yen. The same share of the comparison income is ${equivalentText}.`;
    }
  }

  byId('equivalent').textContent = equivalentText;
  byId('result-note').textContent = resultNote;
  byId('converted').textContent = convertedText;
  byId('rate-note').textContent = rate?.note ?? (ratesStatus === 'loading' ? ' · Loading exchange rate…' : ' · Exchange rate unavailable');
  byId('rate-pair').hidden = !rate;
  byId('rate-pair').textContent = rate ? `Exchange rate used: 1 ${currency} = ${rateFormat.format(rate.yenPerUnit)} JPY` : '';
  byId('japan-share').textContent = japanShareText;
  byId('home-share').textContent = formatShare(homeShare);
  byId('japan-share-note').hidden = japan.amount === null;
  byId('home-share-note').hidden = home.amount === null;
  byId('japan-share-note').textContent = japan.amount === null ? '' : `Of ${formatMoney(japan.amount, 'JPY', japan.precision)}`;
  byId('home-share-note').textContent = home.amount === null ? '' : `Of ${formatMoney(home.amount, currency, home.precision)}`;

  if (announce) {
    hasInteracted = true;
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      const metrics = [
        ['equivalent', 'Equivalent cost at the same share of income'], ['converted', 'Price at the exchange rate'],
      ];
      const spokenResults = metrics.map(([id, label]) => {
        const value = byId(id).textContent ?? '';
        return value === '—' ? '' : `${label} ${value}. `;
      }).join('');
      const conversionStatus = price.amount !== null && !rate && ratesStatus !== 'loading' ? 'Exchange rate unavailable.' : '';
      byId('result-announcement').textContent = [spokenResults.trim(), conversionStatus, equivalent === null ? resultNote : ''].filter(Boolean).join(' ');
    }, 450);
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', (event) => {
  const field = event.target as HTMLInputElement;
  if (field === homeField) {
    homePayByCurrency.set(currencyField.value, field.value);
  }
  if (field === priceField || field === japanField || field === homeField) {
    showError(field, '');
    render();
  }
});

form.addEventListener('focusout', (event) => {
  const field = event.target as HTMLInputElement;
  if (field !== priceField && field !== japanField && field !== homeField) return;
  const currency = field === homeField ? currencyField.value : 'JPY';
  const parsed = parseAmount(field.value, field === priceField, currency);
  showError(field, parsed.error);
  if (parsed.amount === null) return;
  field.value = enteredMoneyFormatter(currency, parsed.precision ?? 0).formatToParts(parsed.amount)
    .filter((part) => part.type !== 'currency' && part.type !== 'literal')
    .map((part) => part.value)
    .join('');
  if (field === homeField) homePayByCurrency.set(currency, field.value);
  render(false);
});

form.addEventListener('change', (event) => {
  if (event.target === presetField) {
    if (presetField.value !== '') {
      priceField.value = wholeNumberFormat.format(Number(presetField.value));
      showError(priceField, '');
    }
  } else if (event.target === currencyField) {
    showHomeField();
  } else {
    return;
  }
  render();
});

byId('reset').addEventListener('click', () => {
  for (const field of [priceField, japanField, homeField]) showError(field, '');
  homePayByCurrency.clear();
  homeErrorByCurrency.clear();
  homePayByCurrency.set(defaultCurrency, homeField.defaultValue);
  presetField.value = defaultPreset;
  priceField.value = priceField.defaultValue;
  japanField.value = japanField.defaultValue;
  currencyField.value = preferredCurrency(Array.from(currencyField.options, (option) => option.value));
  showHomeField();
  render();
});

setCurrencyOptions(bundledCurrencyCodes);
showHomeField();
render(false);

void loadRates().then((loaded) => {
  snapshot = loaded;
  ratesStatus = loaded ? 'ready' : 'unavailable';
  let selectionChanged = false;
  if (loaded) {
    const sourceName = `${loaded.source} reference rates`;
    const sourceLink = byId('rate-source');
    sourceLink.textContent = sourceName;
    sourceLink.setAttribute('aria-label', `${sourceName} (opens in a new tab)`);
    const codes = comparisonCurrencies(loaded);
    const listed = Array.from(currencyField.options, (option) => option.value);
    selectionChanged = codes.join() !== listed.join() && setCurrencyOptions(codes);
  }
  if (selectionChanged || !homePayByCurrency.has(currencyField.value)) showHomeField();
  // Rates can arrive after the visitor starts typing; tell them the conversion changed.
  render(hasInteracted);
});
