import Decimal from 'decimal.js';
import type {
  RetirementContractType,
  RetirementMoney,
  RetirementOrigin,
  RetirementPillar,
  RetirementScenario,
  RetirementStatus,
} from '@vaultfolio/api-contract';

export type {
  RetirementCapitalAccountFigures,
  RetirementCheckId,
  RetirementDepotFigures,
  RetirementFigures,
  RetirementImportInfo,
  RetirementManualRecordInput,
  RetirementMoney,
  RetirementPensionFigures,
  RetirementPillarSummary,
  RetirementRecord,
  RetirementRecordInput,
  RetirementScenarioMonthly,
  RetirementStartRelation,
  RetirementStatutoryFigures,
  RetirementSummary,
  RetirementSummaryItem,
  RetirementSupplement,
  RetirementSupplementPatch,
} from '@vaultfolio/api-contract';

export type Pillar = RetirementPillar;
export type ContractType = RetirementContractType;
export type Origin = RetirementOrigin;
export type Status = RetirementStatus;
export type Scenario = RetirementScenario;
export type Money = RetirementMoney;

export const PILLARS = [
  'STATUTORY',
  'OCCUPATIONAL',
  'PRIVATE',
] as const satisfies readonly Pillar[];
export const ORIGINS = ['IMPORTED', 'MANUAL'] as const satisfies readonly Origin[];
export const STATUSES = ['ACTIVE', 'PAID_UP', 'IN_PAYOUT'] as const satisfies readonly Status[];
export const SCENARIOS = ['0', '3', '6', '9'] as const satisfies readonly Scenario[];

/** Contract types per pillar (data-model.md). */
export const TYPES_BY_PILLAR: Readonly<Record<Pillar, readonly ContractType[]>> = {
  STATUTORY: ['STATUTORY_PENSION'],
  OCCUPATIONAL: [
    'DIRECT_INSURANCE',
    'PENSIONSKASSE',
    'DIREKTZUSAGE',
    'UNTERSTUETZUNGSKASSE',
    'PENSIONSFONDS',
    'CAPITAL_ACCOUNT',
  ],
  PRIVATE: ['RIESTER', 'PRIVATE_PENSION_INSURANCE', 'ALTERSVORSORGEDEPOT'],
};

export const CONTRACT_TYPES: readonly ContractType[] = PILLARS.flatMap((p) => TYPES_BY_PILLAR[p]);

export function isContractType(value: unknown): value is ContractType {
  return typeof value === 'string' && (CONTRACT_TYPES as readonly string[]).includes(value);
}

export function pillarOf(type: ContractType): Pillar {
  return PILLARS.find((p) => TYPES_BY_PILLAR[p].includes(type)) as Pillar;
}

/** Whether `type` belongs to `pillar` (the pairing the database CHECK enforces). */
export function typeMatchesPillar(type: ContractType, pillar: Pillar): boolean {
  return TYPES_BY_PILLAR[pillar].includes(type);
}

// ------------------------------------------------------------------ field map

export type FieldKind = 'money' | 'decimal' | 'date' | 'int' | 'scenarios';

export interface FieldSpec {
  kind: FieldKind;
  /** Inclusive upper bound that rejects typos (money/decimal/int). */
  max?: number;
  /** Decimal places allowed (decimal kind). */
  places?: number;
}

const MONTHLY: FieldSpec = { kind: 'money', max: 100_000 };
const CAPITAL: FieldSpec = { kind: 'money', max: 100_000_000 };
const DATE: FieldSpec = { kind: 'date' };

const STATUTORY_FIELDS = {
  dataPeriodFrom: DATE,
  dataPeriodTo: DATE,
  fullDisabilityMonthly: MONTHLY,
  accruedMonthly: MONTHLY,
  projectedMonthly: MONTHLY,
  projectedAt1Pct: MONTHLY,
  projectedAt2Pct: MONTHLY,
  earningsPoints: { kind: 'decimal', max: 200, places: 4 },
  currentPensionValue: { kind: 'money', max: 1000 },
  contributionsOwn: CAPITAL,
  contributionsEmployer: CAPITAL,
  contributionsPublic: CAPITAL,
} as const satisfies Record<string, FieldSpec>;

/** Fields of the pension-contract families that are typed in only for `MANUAL` records. */
const PENSION_CORE = {
  guaranteedMonthly: MONTHLY,
  expectedMonthly: MONTHLY,
  guaranteedCapital: CAPITAL,
  scenarioMonthly: { kind: 'scenarios' },
  currentValue: CAPITAL,
  contributionsPaid: CAPITAL,
  contributionsMain: CAPITAL,
  contributionsExtra: CAPITAL,
  surrenderValue: CAPITAL,
  deathBenefit: CAPITAL,
  guaranteePeriodYears: { kind: 'int', max: 60 },
  capitalPayout: CAPITAL,
} as const satisfies Record<string, FieldSpec>;

const CAPITAL_ACCOUNT_CORE = {
  openingBalance: CAPITAL,
  accountBalance: CAPITAL,
  guaranteedInterestRate: { kind: 'decimal', max: 100, places: 4 },
  interestCredit: CAPITAL,
  annualContribution: CAPITAL,
  finalBonus: CAPITAL,
} as const satisfies Record<string, FieldSpec>;

const DEPOT_CORE = { currentValue: CAPITAL } as const satisfies Record<string, FieldSpec>;

/** Contract-type families that share a figure shape. */
type Family = 'STATUTORY' | 'PENSION' | 'CAPITAL_ACCOUNT' | 'DEPOT';

export function familyOf(type: ContractType): Family {
  if (type === 'STATUTORY_PENSION') return 'STATUTORY';
  if (type === 'CAPITAL_ACCOUNT') return 'CAPITAL_ACCOUNT';
  if (type === 'ALTERSVORSORGEDEPOT') return 'DEPOT';
  return 'PENSION';
}

/** Fields that may be supplied by the user on top of an imported statement (R5). */
export const SUPPLEMENT_FIELDS = {
  contributionMonthly: MONTHLY,
  employerContributionMonthly: MONTHLY,
  subsidiesYearly: MONTHLY,
  expectedMonthly: MONTHLY,
  expectedScenario: { kind: 'int' },
} as const satisfies Record<string, FieldSpec>;

export type SupplementKey = keyof typeof SUPPLEMENT_FIELDS;

/** Supplement fields that apply to `type` (empty where nothing can be supplemented). */
export function supplementKeysOf(type: ContractType): readonly SupplementKey[] {
  switch (type) {
    case 'STATUTORY_PENSION':
    case 'ALTERSVORSORGEDEPOT':
      return [];
    case 'CAPITAL_ACCOUNT':
      return ['contributionMonthly', 'employerContributionMonthly', 'expectedMonthly'];
    case 'RIESTER':
      return ['contributionMonthly', 'subsidiesYearly', 'expectedScenario'];
    case 'PRIVATE_PENSION_INSURANCE':
      return ['contributionMonthly', 'expectedScenario'];
    default:
      return ['contributionMonthly', 'employerContributionMonthly', 'expectedScenario'];
  }
}

/**
 * Figure fields a record of `type` may carry. For `MANUAL` records the user-supplied contribution
 * fields live in `figures`; for `IMPORTED` ones they belong to the supplement and are not listed.
 */
export function figureFieldsOf(
  type: ContractType,
  origin: Origin = 'MANUAL',
): Readonly<Record<string, FieldSpec>> {
  const supplemental: Record<string, FieldSpec> =
    origin === 'MANUAL'
      ? Object.fromEntries(
          supplementKeysOf(type)
            .filter((k) => k !== 'expectedScenario' && k !== 'expectedMonthly')
            .map((k) => [k, SUPPLEMENT_FIELDS[k]]),
        )
      : {};
  switch (familyOf(type)) {
    case 'STATUTORY':
      return STATUTORY_FIELDS;
    case 'CAPITAL_ACCOUNT':
      return {
        ...CAPITAL_ACCOUNT_CORE,
        expectedMonthly: MONTHLY,
        ...supplemental,
      };
    case 'DEPOT':
      return {
        ...DEPOT_CORE,
        expectedMonthly: MONTHLY,
        ...supplemental,
        contributionMonthly: MONTHLY,
      };
    default:
      return { ...PENSION_CORE, ...supplemental };
  }
}

/** Figure fields that must be present, per type. */
export function requiredFiguresOf(type: ContractType): readonly string[] {
  if (type === 'STATUTORY_PENSION') return ['projectedMonthly'];
  if (type === 'CAPITAL_ACCOUNT') return ['accountBalance'];
  return [];
}

/** Whether a record of `type` needs a provider label (occupational and private). */
export function needsProviderLabel(type: ContractType): boolean {
  return type !== 'STATUTORY_PENSION';
}

// ------------------------------------------------------------------ money helpers

export const ZERO: Money = '0.00';

/** One-cent tolerance of the arithmetic checks. */
export const TOLERANCE = new Decimal('0.01');

const MONEY_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;

/** Canonical money string: exact decimal, two places, half-up, never `-0.00`. */
export function toMoney(value: Decimal.Value): Money {
  const d = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return d.isZero() ? ZERO : d.toFixed(2);
}

/** Whether `value` is an amount string with at most two decimals (`"1234"`, `"1234.5"`, `"1234.56"`). */
export function isAmountString(value: unknown): value is string {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

export function dec(value: Money | undefined | null): Decimal {
  return new Decimal(value ?? 0);
}

export function sum(values: readonly (Money | undefined | null)[]): Money {
  return toMoney(values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0)));
}

export function maxOf(a: Money, b: Money): Money {
  return Decimal.max(dec(a), dec(b)).toFixed(2);
}

/** `|a − b| ≤ tolerance` (default one cent). */
export function withinTolerance(
  a: Decimal.Value,
  b: Decimal.Value,
  tolerance: Decimal = TOLERANCE,
): boolean {
  return new Decimal(a).minus(b).abs().lessThanOrEqualTo(tolerance);
}
