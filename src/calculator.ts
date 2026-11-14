/** Why an entry was rejected. The view turns it into text in the selected language. */
export type AmountError =
  | { code: 'format' }
  | { code: 'decimals'; decimals: number }
  | { code: 'digits' }
  | { code: 'zero' };
export interface ParsedAmount { amount: number | null; precision?: number; error: AmountError | null }

export function parseAmount(raw: string, allowZero: boolean, currency: string): ParsedAmount {
  const value = raw.normalize('NFKC').trim();
  if (value === '') return { amount: null, error: null };

  const pattern = /^(?:(\d[\d,]*)(?:\.(\d*))?|\.(\d+))$/;
  const parts = value.match(pattern);
  if (!parts) return { amount: null, error: { code: 'format' } };

  const fraction = parts[2] ?? parts[3] ?? '';
  const decimals = Math.max(2, (new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2));
  if (fraction.length > decimals) return { amount: null, error: { code: 'decimals', decimals } };

  const wholeDigits = (parts[1] ?? '').replaceAll(',', '');
  if (wholeDigits.length > 12) return { amount: null, error: { code: 'digits' } };

  const amount = Number(value.replaceAll(',', ''));
  if (!allowZero && amount === 0) return { amount: null, error: { code: 'zero' } };
  return { amount, precision: fraction.replace(/0+$/, '').length, error: null };
}

export function calculate(price: number | null, japan: number | null, home: number | null, yenPerUnit: number | null) {
  const japanShare = price !== null && japan !== null ? price / japan : null;
  const converted = price !== null && yenPerUnit !== null && yenPerUnit > 0 ? price / yenPerUnit : null;
  const homeShare = converted !== null && home !== null ? converted / home : null;
  const equivalent = japanShare !== null && home !== null ? japanShare * home : null;
  // Converts the unrounded equivalent back to yen, so it needs a rate but the equivalent itself does not.
  const equivalentYen = equivalent !== null && yenPerUnit !== null && yenPerUnit > 0 ? equivalent * yenPerUnit : null;
  return { japanShare, converted, homeShare, equivalent, equivalentYen };
}
