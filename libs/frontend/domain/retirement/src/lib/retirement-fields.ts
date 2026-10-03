import type { ContractType } from '@vaultfolio/retirement';

/** How a figure is presented everywhere (SC-004): guaranteed is bold, a projection is italic "≈". */
export type FigureKind = 'guaranteed' | 'projection' | 'neutral';

/** Figures that are contractually guaranteed; every other monthly benefit is a projection. */
const GUARANTEED = new Set(['guaranteedMonthly', 'guaranteedCapital']);
const PROJECTION = new Set([
  'expectedMonthly',
  'projectedMonthly',
  'projectedAt1Pct',
  'projectedAt2Pct',
  'scenarioMonthly',
  'finalBonus',
]);

export function figureKind(key: string): FigureKind {
  if (GUARANTEED.has(key)) return 'guaranteed';
  return PROJECTION.has(key) ? 'projection' : 'neutral';
}

/** Form sections of design.md "Manual entry form": contract / benefits / contributions & value. */
export type FormSection = 'contract' | 'benefits' | 'contributions';

const BENEFITS = new Set([
  'fullDisabilityMonthly',
  'accruedMonthly',
  'projectedMonthly',
  'projectedAt1Pct',
  'projectedAt2Pct',
  'guaranteedMonthly',
  'expectedMonthly',
  'guaranteedCapital',
  'scenarioMonthly',
  'capitalPayout',
  'guaranteePeriodYears',
  'finalBonus',
  'surrenderValue',
  'deathBenefit',
]);

const CONTRACT = new Set(['dataPeriodFrom', 'dataPeriodTo']);

export function sectionOf(key: string): FormSection {
  if (CONTRACT.has(key)) return 'contract';
  return BENEFITS.has(key) ? 'benefits' : 'contributions';
}

/** Order of the figure inputs inside a section. */
const ORDER = [
  'dataPeriodFrom',
  'dataPeriodTo',
  'fullDisabilityMonthly',
  'accruedMonthly',
  'projectedMonthly',
  'projectedAt1Pct',
  'projectedAt2Pct',
  'guaranteedMonthly',
  'expectedMonthly',
  'scenarioMonthly',
  'guaranteedCapital',
  'capitalPayout',
  'guaranteePeriodYears',
  'finalBonus',
  'surrenderValue',
  'deathBenefit',
  'openingBalance',
  'interestCredit',
  'annualContribution',
  'accountBalance',
  'guaranteedInterestRate',
  'currentValue',
  'earningsPoints',
  'currentPensionValue',
  'contributionMonthly',
  'employerContributionMonthly',
  'subsidiesYearly',
  'contributionsMain',
  'contributionsExtra',
  'contributionsPaid',
  'contributionsOwn',
  'contributionsEmployer',
  'contributionsPublic',
];

export function sortFigureKeys(keys: readonly string[]): string[] {
  const rank = (k: string): number => {
    const i = ORDER.indexOf(k);
    return i < 0 ? ORDER.length : i;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

/** Types whose card shows the capital box instead of a monthly pension. */
export function isCapitalType(type: ContractType): boolean {
  return type === 'CAPITAL_ACCOUNT';
}

/** Order of the type chips in the form (design.md). */
export const FORM_TYPES: readonly ContractType[] = [
  'STATUTORY_PENSION',
  'DIRECT_INSURANCE',
  'PENSIONSKASSE',
  'DIREKTZUSAGE',
  'UNTERSTUETZUNGSKASSE',
  'PENSIONSFONDS',
  'CAPITAL_ACCOUNT',
  'RIESTER',
  'PRIVATE_PENSION_INSURANCE',
  'ALTERSVORSORGEDEPOT',
];
