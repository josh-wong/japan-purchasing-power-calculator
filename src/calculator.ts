export interface ParsedAmount { amount: number | null; precision?: number; error: string }

export function parseAmount(raw: string, allowZero: boolean, currency: string): ParsedAmount {
  const value = raw.normalize('NFKC').trim();
  if (value === '') return { amount: null, error: '' };

  const pattern = /^(?:(\d[\d,]*)(?:\.(\d*))?|\.(\d+))$/;
  const parts = value.match(pattern);
  if (!parts) return { amount: null, error: 'Use digits, commas for grouping, and a period for decimals.' };
  if (parts[1]?.includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(parts[1])) {
    return { amount: null, error: 'Check the comma placement. For example, enter 1,234 or 1234.' };
  }

  const fraction = parts[2] ?? parts[3] ?? '';
  const decimals = Math.max(2, (new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2));
  if (fraction.length > decimals) return { amount: null, error: `Use up to ${decimals} decimal places.` };

  const wholeDigits = (parts[1] ?? '').replaceAll(',', '');
  if (wholeDigits.length > 12) return { amount: null, error: 'Use up to 12 digits before the decimal point.' };

  const amount = Number(value.replaceAll(',', ''));
  if (!allowZero && amount === 0) return { amount: null, error: 'Enter an amount greater than zero.' };
  return { amount, precision: fraction.replace(/0+$/, '').length, error: '' };
}

export function calculate(price: number | null, japan: number | null, home: number | null, yenPerUnit: number | null) {
  const japanShare = price !== null && japan !== null ? price / japan : null;
  const converted = price !== null && yenPerUnit !== null && yenPerUnit > 0 ? price / yenPerUnit : null;
  const homeShare = converted !== null && home !== null ? converted / home : null;
  const equivalent = japanShare !== null && home !== null ? japanShare * home : null;
  return { japanShare, converted, homeShare, equivalent };
}
