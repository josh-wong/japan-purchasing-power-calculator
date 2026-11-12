import { parseAmount, calculate } from './calculator';
import { savedRates } from './rates';

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
const form = document.querySelector('form')!;
const moneyFormatters = new Map<string, Intl.NumberFormat>();
const rateFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const percentFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const dayMs = 86_400_000;
let announcementTimer: ReturnType<typeof setTimeout> | undefined;

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

function rateFor(currency: string) {
  const snapshot = savedRates;
  const units = snapshot.unitsPerEuro[currency];
  if (!units) return null;
  const rateDate = new Date(snapshot.date);
  const ageDays = Math.floor(Date.now() / dayMs) - Math.floor(rateDate.getTime() / dayMs);
  const freshness = ageDays > 7 ? ' · Outdated' : '';
  return {
    yenPerUnit: snapshot.unitsPerEuro.JPY / units,
    note: ` · Illustrative rate snapshot — ${dateFormat.format(rateDate)}${freshness}`,
  };
}





function showError(field: HTMLInputElement, error: string) {
  const message = byId(`${field.id}-error`);
  field.setAttribute('aria-invalid', String(Boolean(error)));
  message.textContent = error;
  message.hidden = !error;
}

function showHomeField() {
  const currency = currencyField.value;
  if (!homePayByCurrency.has(currency)) {
    const units = savedRates.unitsPerEuro[currency];
    const usd = savedRates.unitsPerEuro.USD;
    const defaultIncome = Number(homeField.defaultValue.replaceAll(',', ''));
    const convertedIncome = units && usd ? defaultIncome * units / usd : null;
    const increment = convertedIncome !== null && convertedIncome >= 100_000 ? 10_000 : 1_000;
    const value = convertedIncome === null ? ''
      : wholeNumberFormat.format(Math.ceil(convertedIncome / increment) * increment);
    homePayByCurrency.set(currency, value);
  }
  homeField.value = homePayByCurrency.get(currency) ?? '';
  byId('home-label').textContent = `Comparison income (${currency})`;
  byId('home-prefix').textContent = moneySymbol(currency);
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
  showError(priceField, price.error);
  showError(japanField, japan.error);
  showError(homeField, home.error);

  if (presetField.value !== '' && price.amount !== Number(presetField.value)) presetField.value = '';

  const rate = rateFor(currency);
  const { japanShare, converted, homeShare, equivalent } = calculate(price.amount, japan.amount, home.amount, rate?.yenPerUnit ?? null);
  const japanShareText = formatShare(japanShare);
  const equivalentText = equivalent === null ? '—' : formatMoney(equivalent, currency);
  const convertedText = converted === null ? '—' : formatMoney(converted, currency);

  let resultNote = 'Enter a price in yen to compare the cost.';
  if (price.amount !== null) {
    if (japan.amount === null) {
      resultNote = 'Enter the income in Japan to see the equivalent cost.';
    } else if (home.amount === null) {
      resultNote = 'Enter a comparison income to see the equivalent cost.';
    } else {
      const shareDescription = japanShare !== null && japanShare > 0 && japanShareText !== '<0.01%'
        ? `about ${japanShareText}`
        : spokenShare(japanShareText);
      resultNote = `This purchase takes ${shareDescription} of the monthly pay entered for Japan. The same share of the comparison income comes to ${equivalentText}.`;
    }
  }

  byId('equivalent').textContent = equivalentText;
  byId('result-note').textContent = resultNote;
  byId('converted').textContent = convertedText;
  byId('rate-note').textContent = rate?.note ?? ' · Exchange rate unavailable';
  byId('rate-pair').hidden = !rate;
  byId('rate-pair').textContent = rate ? `Exchange rate used: 1 ${currency} = ${rateFormat.format(rate.yenPerUnit)} JPY.` : '';
  byId('japan-share').textContent = japanShareText;
  byId('home-share').textContent = formatShare(homeShare);
  byId('japan-share-note').hidden = japan.amount === null;
  byId('home-share-note').hidden = home.amount === null;
  byId('japan-share-note').textContent = japan.amount === null ? '' : `Of ${formatMoney(japan.amount, 'JPY', japan.precision)}`;
  byId('home-share-note').textContent = home.amount === null ? '' : `Of ${formatMoney(home.amount, currency, home.precision)}`;

  if (announce) {
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      const metrics = [
        ['equivalent', 'Equivalent cost based on income'], ['converted', 'Converted price'],
        ['japan-share', 'Percentage of income in Japan'], ['home-share', 'Percentage of comparison income at the converted price'],
      ];
      const spokenResults = metrics.map(([id, label]) => {
        const value = byId(id).textContent ?? '';
        return value === '—' ? '' : `${label} ${spokenShare(value)}. `;
      }).join('');
      const conversionStatus = price.amount !== null && byId('rate-pair').hidden ? 'Exchange rate unavailable.' : '';
      byId('result-announcement').textContent = [spokenResults.trim(), conversionStatus, byId('result-note').textContent].filter(Boolean).join(' ');
    }, 450);
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', (event) => {
  const field = event.target as HTMLInputElement;
  if (field === homeField) homePayByCurrency.set(currencyField.value, field.value);
  if (field === priceField || field === japanField || field === homeField) render();
});

form.addEventListener('focusout', (event) => {
  const field = event.target as HTMLInputElement;
  if (field !== priceField && field !== japanField && field !== homeField) return;
  const currency = field === homeField ? currencyField.value : 'JPY';
  const parsed = parseAmount(field.value, field === priceField, currency);
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
    if (presetField.value !== '') priceField.value = wholeNumberFormat.format(Number(presetField.value));
  } else if (event.target === currencyField) {
    showHomeField();
  } else {
    return;
  }
  render();
});

byId('reset').addEventListener('click', () => {
  homePayByCurrency.clear();
  homePayByCurrency.set(defaultCurrency, homeField.defaultValue);
  presetField.value = defaultPreset;
  priceField.value = priceField.defaultValue;
  japanField.value = japanField.defaultValue;
  currencyField.value = defaultCurrency;
  showHomeField();
  render();
});

showHomeField();
render(false);
