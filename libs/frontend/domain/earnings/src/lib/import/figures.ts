import type { EarningsPayAmountKey } from '@vaultfolio/api-contract';

/** Figures of a record in display order: key and `earnings.terms.*` label. */
export const RECORD_FIGURES: [key: string, label: string][] = [
  ['gross', 'grossTotal'],
  ['taxGross', 'taxGross'],
  ['svGrossKv', 'svGrossKv'],
  ['svGrossRv', 'svGrossRv'],
  ['wageTax', 'wageTax'],
  ['soli', 'soli'],
  ['churchTax', 'churchTax'],
  ['health', 'health'],
  ['care', 'care'],
  ['pension', 'pension'],
  ['unemployment', 'unemployment'],
  ['net', 'statutoryNet'],
  ['other', 'other'],
  ['payout', 'payout'],
];

/** Term of a figure the user may correct (`earnings.terms.*`). */
export function figureTerm(key: EarningsPayAmountKey): string {
  return RECORD_FIGURES.find(([k]) => k === key)?.[1] ?? key;
}
