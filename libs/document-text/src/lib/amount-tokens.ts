import Decimal from 'decimal.js';

/** Formats a decimal as a canonical money string, e.g. `1234.56` (2 dp, half-up, no `-0.00`). */
export function toMoney(value: Decimal.Value): string {
  const d = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return d.isZero() ? '0.00' : d.toFixed(2);
}

/** German amount: `1.234,56`, optionally signed `-5,63` or trailing-minus `591,70-`. */
const GERMAN_AMOUNT = /(?<![\d.])(-?)(\d[\d.]*),(\d{2})(-)?/;
/** Every German amount of a line; a trailing `-` counts only when not followed by an uppercase letter (`12,00-E`). */
const GERMAN_AMOUNTS = /(?<![\d,.])-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:-(?![A-ZÄÖÜ]))?/g;
/** Hours/days quantities printed next to amounts, e.g. `8,00 S`, `21,00 T`, `160,00 H`. */
const QUANTITY = /(?<!\d)\d+,\d{2}(?: ?-)? ?[STH]\b/g;

/** Converts a German amount to a canonical money string; `null` when `text` holds none. */
export function parseGermanAmount(text: string): string | null {
  const m = GERMAN_AMOUNT.exec(text);
  if (!m) return null;
  const negative = m[1] === '-' || m[4] === '-';
  const value = `${negative ? '-' : ''}${m[2].replaceAll('.', '')}.${m[3]}`;
  return toMoney(value);
}

/** All money amounts of a text, left to right, quantities (hours/days) removed. */
export function amountsIn(text: string): string[] {
  const cleaned = text.replace(QUANTITY, ' ');
  return [...cleaned.matchAll(GERMAN_AMOUNTS)].map((m) => parseGermanAmount(m[0]) as string);
}

/** Text before the first amount (the line's label). */
export function labelOf(text: string): string {
  const cleaned = text.replace(QUANTITY, ' ');
  GERMAN_AMOUNTS.lastIndex = 0;
  const idx = cleaned.search(GERMAN_AMOUNTS);
  return (idx < 0 ? cleaned : cleaned.slice(0, idx)).trim();
}
