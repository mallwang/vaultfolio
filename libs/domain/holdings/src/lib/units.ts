import Decimal from 'decimal.js';

export type HoldingUnit = 'G' | 'OZT';

export const HOLDING_UNITS: readonly HoldingUnit[] = ['G', 'OZT'];

export const GRAMS_PER_TROY_OUNCE = '31.1035';

/** Converts a decimal-string quantity to grams, exactly (no float arithmetic). */
export function toGrams(quantity: string, unit: HoldingUnit): string {
  const value = new Decimal(quantity);
  return (unit === 'OZT' ? value.times(GRAMS_PER_TROY_OUNCE) : value).toFixed();
}
