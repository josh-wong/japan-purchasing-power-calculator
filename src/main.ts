import { parseAmount, calculate, type AmountError } from './calculator';
import { bundledCurrencyCodes } from './currencies';
import { catalog, initLanguage, intlLocale, messages, onLocaleChange } from './i18n';
import { comparisonCurrencies, isOutdated, yenPerUnit, type RateSnapshot } from './rate-snapshot';
import { loadRates } from './rates';

// Translate the static page before anything else renders, so the first results use the same language.
initLanguage();

const currencySymbols: Record<string, string> = { USD: 'US$', JPY: 'JP¥', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', HKD: 'HK$', SGD: 'S$' };
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element;
}
const presetField = byId('preset') as HTMLSelectElement;
const priceField = byId('price') as HTMLInputElement;
const defaultPreset = priceField.defaultValue.replaceAll(',', '');
const japanField = byId('japan') as HTMLInputElement;
const homeField = byId('home') as HTMLInputElement;
const currencyField = byId('currency') as HTMLSelectElement;
const defaultCurrency = 'USD';
const homePayByCurrency = new Map([[defaultCurrency, homeField.defaultValue]]);
const homeErrorByCurrency = new Map<string, AmountError | null>();
const fieldErrors = new Map<HTMLInputElement, AmountError | null>();
const form = document.querySelector('form')!;
const formatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const currencyNames = new Map<string, Intl.DisplayNames | null>();
let snapshot: RateSnapshot | null = null;
let ratesStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
let announcementTimer: ReturnType<typeof setTimeout> | undefined;
// Results are announced only after the visitor has used the form, never for the initial page load.
let hasInteracted = false;

/** A cached number formatter, for the selected language unless another locale is given. */
function numberFormat(options: Intl.NumberFormatOptions, locale = intlLocale()) {
  const key = `${locale} ${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale, options));
  return formatters.get(key)!;
}

function moneyFormatter(currency: string, locale?: string) {
  return numberFormat({ style: 'currency', currency }, locale);
}

function enteredMoneyFormatter(currency: string, precision: number, locale?: string) {
  const standard = moneyFormatter(currency, locale);
  if (precision <= (standard.resolvedOptions().maximumFractionDigits ?? 2)) return standard;
  return numberFormat({ style: 'currency', currency, minimumFractionDigits: precision, maximumFractionDigits: precision }, locale);
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

function formatDate(isoDate: string) {
  const key = intlLocale();
  if (!dateFormatters.has(key)) dateFormatters.set(key, new Intl.DateTimeFormat(key, { dateStyle: 'long', timeZone: 'UTC' }));
  return dateFormatters.get(key)!.format(new Date(isoDate));
}

function moneySymbol(currency: string) {
  return currencySymbols[currency] ?? moneyFormatter(currency).formatToParts(0)
    .find((part) => part.type === 'currency')!.value;
}

function currencyLabel(code: string) {
  const key = intlLocale();
  let name: string | undefined;
  try {
    if (!currencyNames.has(key)) currencyNames.set(key, new Intl.DisplayNames(key, { type: 'currency' }));
    name = currencyNames.get(key)?.of(code);
  } catch {
    // Fall back to the bare code when the runtime lacks currency names or cannot name this one.
    currencyNames.set(key, null);
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

function listedCurrencies() {
  return Array.from(currencyField.options, (option) => option.value);
}

function showPresetLabels() {
  const { customPrice, presets } = messages().form;
  for (const option of Array.from(presetField.options)) {
    const name = (presets as Record<string, string>)[option.value];
    option.textContent = option.value === '' ? customPrice : `${name} · ${formatMoney(Number(option.value), 'JPY')}`;
  }
}

function rateFor(currency: string) {
  if (!snapshot) return null;
  const yen = yenPerUnit(snapshot, currency);
  if (yen === null) return null;
  const outdated = isOutdated(snapshot.date, Date.now());
  return {
    yenPerUnit: yen,
    note: ` · ${formatDate(snapshot.date)}${outdated ? ` · ${messages().result.outdated}` : ''}`,
  };
}

function exampleIncome(currency: string) {
  const units = snapshot?.unitsPerEuro[currency];
  const usd = snapshot?.unitsPerEuro.USD;
  if (!units || !usd) return null;
  const convertedIncome = Number(homeField.defaultValue.replaceAll(',', '')) * units / usd;
  const increment = convertedIncome >= 100_000 ? 10_000 : 1_000;
  // Plain grouping digits, so the prefilled value parses the same in every language.
  return numberFormat({ maximumFractionDigits: 0 }, 'en-US').format(Math.ceil(convertedIncome / increment) * increment);
}

function errorText(error: AmountError) {
  const text = messages().errors;
  return error.code === 'decimals' ? text.decimals(error.decimals) : text[error.code];
}

function showError(field: HTMLInputElement, error: AmountError | null) {
  if (field === homeField) homeErrorByCurrency.set(currencyField.value, error);
  else fieldErrors.set(field, error);
  const message = byId(`${field.id}-error`);
  field.setAttribute('aria-invalid', String(Boolean(error)));
  message.textContent = error ? errorText(error) : '';
  message.hidden = !error;
}

function showHomeLabels() {
  const currency = currencyField.value;
  byId('home-label').textContent = messages().form.homeLabel(currency);
  byId('home-prefix').textContent = moneySymbol(currency);
}

function showHomeField() {
  const currency = currencyField.value;
  if (!homePayByCurrency.has(currency)) {
    // An unvisited currency stays unset without a rate, so it can be prefilled once rates load.
    const example = exampleIncome(currency);
    if (example !== null) homePayByCurrency.set(currency, example);
  }
  homeField.value = homePayByCurrency.get(currency) ?? '';
  showHomeLabels();
  showError(homeField, homeErrorByCurrency.get(currency) ?? null);
}

/** The displayed share, and whether it is a positive share too small to show. */
function formatShare(share: number | null) {
  if (share === null) return { text: '—', tiny: false };
  if (share > 0 && share < 0.0001) return { text: messages().result.tinyShare, tiny: true };
  return { text: numberFormat({ style: 'percent', maximumFractionDigits: 2 }).format(share), tiny: false };
}

function render(announce = true) {
  const text = messages();
  const currency = currencyField.value;
  const price = parseAmount(priceField.value, true, 'JPY');
  const japan = parseAmount(japanField.value, false, 'JPY');
  const home = parseAmount(homeField.value, false, currency);

  if (presetField.value !== '' && price.amount !== Number(presetField.value)) presetField.value = '';

  const rate = rateFor(currency);
  const { japanShare, converted, homeShare, equivalent, equivalentYen } = calculate(price.amount, japan.amount, home.amount, rate?.yenPerUnit ?? null);
  const japanShareText = formatShare(japanShare);
  const equivalentText = equivalent === null ? '—' : formatMoney(equivalent, currency);
  const convertedText = converted === null ? '—' : formatMoney(converted, currency);
  // The yen figure repeats the amount when the comparison currency is yen, so it is left out.
  const equivalentYenAmount = equivalentYen !== null && currency !== 'JPY' ? formatMoney(equivalentYen, 'JPY') : null;

  let resultNote = text.result.promptPrice;
  if (price.amount !== null) {
    if (japan.amount === null) {
      resultNote = text.result.promptJapan;
    } else if (home.amount === null) {
      resultNote = text.result.promptHome;
    } else {
      const shareDescription = japanShare !== null && japanShare > 0 && !japanShareText.tiny
        ? text.result.aboutShare(japanShareText.text)
        : japanShareText.tiny ? text.result.tinyShareSpoken : japanShareText.text;
      resultNote = text.result.note(formatMoney(price.amount, 'JPY', price.precision), shareDescription, equivalentText);
    }
  }

  byId('equivalent').textContent = equivalentText;
  byId('equivalent-yen').hidden = equivalentYenAmount === null;
  byId('equivalent-yen').textContent = equivalentYenAmount === null ? '' : text.result.equivalentYen(equivalentYenAmount);
  byId('result-note').textContent = resultNote;
  byId('converted').textContent = convertedText;
  const sourceName = snapshot ? text.result.sourceName(snapshot.source) : text.result.defaultSource;
  byId('rate-source').textContent = sourceName;
  byId('rate-source').setAttribute('aria-label', text.result.newTab(sourceName));
  byId('rate-note').textContent = rate?.note ?? (ratesStatus === 'loading' ? text.result.rateLoading : text.result.rateUnavailable);
  byId('rate-pair').hidden = !rate;
  byId('rate-pair').textContent = rate
    ? text.result.ratePair(currency, numberFormat({ maximumSignificantDigits: 6 }).format(rate.yenPerUnit))
    : '';
  byId('japan-share').textContent = japanShareText.text;
  byId('home-share').textContent = formatShare(homeShare).text;
  byId('japan-share-note').hidden = japan.amount === null;
  byId('home-share-note').hidden = home.amount === null;
  byId('japan-share-note').textContent = japan.amount === null ? '' : text.result.shareOf(formatMoney(japan.amount, 'JPY', japan.precision));
  byId('home-share-note').textContent = home.amount === null ? '' : text.result.shareOf(formatMoney(home.amount, currency, home.precision));

  if (announce) {
    hasInteracted = true;
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      const spoken = text.announcement;
      const metrics = [
        [equivalentText, spoken.equivalent, equivalentYenAmount === null ? '' : spoken.equivalentYen(equivalentYenAmount)],
        [convertedText, spoken.converted, ''],
      ];
      const spokenResults = metrics.filter(([value]) => value !== '—').map(([value, label, suffix]) => spoken.result(label, value, suffix));
      const conversionStatus = price.amount !== null && !rate && ratesStatus !== 'loading' ? spoken.rateUnavailable : '';
      byId('result-announcement').textContent = [...spokenResults, conversionStatus, equivalent === null ? resultNote : ''].filter(Boolean).join(spoken.separator);
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
    showError(field, null);
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
  // Entries keep comma grouping and a period in every language, matching what the parser accepts.
  field.value = enteredMoneyFormatter(currency, parsed.precision ?? 0, 'en-US').formatToParts(parsed.amount)
    .filter((part) => part.type !== 'currency' && part.type !== 'literal')
    .map((part) => part.value)
    .join('');
  if (field === homeField) homePayByCurrency.set(currency, field.value);
  render(false);
});

form.addEventListener('change', (event) => {
  if (event.target === presetField) {
    if (presetField.value !== '') {
      priceField.value = numberFormat({ maximumFractionDigits: 0 }, 'en-US').format(Number(presetField.value));
      showError(priceField, null);
    }
  } else if (event.target === currencyField) {
    showHomeField();
  } else {
    return;
  }
  render();
});

byId('reset').addEventListener('click', () => {
  for (const field of [priceField, japanField, homeField]) showError(field, null);
  homePayByCurrency.clear();
  homeErrorByCurrency.clear();
  homePayByCurrency.set(defaultCurrency, homeField.defaultValue);
  presetField.value = defaultPreset;
  priceField.value = priceField.defaultValue;
  japanField.value = japanField.defaultValue;
  currencyField.value = preferredCurrency(listedCurrencies());
  showHomeField();
  render();
});

// Switching language changes only text and formatting. Entered values, results, and errors stay.
onLocaleChange(() => {
  setCurrencyOptions(listedCurrencies());
  showPresetLabels();
  showHomeLabels();
  for (const field of [priceField, japanField]) showError(field, fieldErrors.get(field) ?? null);
  showError(homeField, homeErrorByCurrency.get(currencyField.value) ?? null);
  render(false);
});

setCurrencyOptions(bundledCurrencyCodes);
showPresetLabels();
showHomeField();
render(false);

void loadRates().then((loaded) => {
  snapshot = loaded;
  ratesStatus = loaded ? 'ready' : 'unavailable';
  let selectionChanged = false;
  if (loaded) {
    const codes = comparisonCurrencies(loaded);
    selectionChanged = codes.join() !== listedCurrencies().join() && setCurrencyOptions(codes);
  }
  if (selectionChanged || !homePayByCurrency.has(currencyField.value)) showHomeField();
  // Rates can arrive after the visitor starts typing; tell them the conversion changed.
  render(hasInteracted);
});

// Runs after the calculator is wired so analytics can never block or alter it. Builds without
// a measurement ID drop this branch, so they contain no analytics code at all. Only the fixed
// English page title is passed; analytics never reads the form or the selected language.
if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  void import('./consent-banner').then(({ initAnalyticsConsent }) => initAnalyticsConsent({
    pageTitle: catalog('en').meta.calculatorTitle,
  }));
}
