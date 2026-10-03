/**
 * Shared contract for the Retirement API — see
 * specs/037-altersvorsorge-retirement-planning/contracts/retirement-api.md and data-model.md.
 * Plain TypeScript interfaces, no runtime dependency, imported by `apps/backend`,
 * `libs/retirement` and `libs/frontend/domain/retirement` so the tiers can never drift on shape
 * (Principle II).
 *
 * Every monetary field is a canonical decimal string (`"1234.56"`), never a JSON number. Rates and
 * earnings points are decimal strings with up to four decimal places.
 */

/** Canonical decimal string (EUR, two decimal places). */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- names the money format at every use site of the contract
export type RetirementMoney = string;

export type RetirementPillar = 'STATUTORY' | 'OCCUPATIONAL' | 'PRIVATE';

export type RetirementContractType =
  | 'STATUTORY_PENSION'
  | 'DIRECT_INSURANCE'
  | 'PENSIONSKASSE'
  | 'DIREKTZUSAGE'
  | 'UNTERSTUETZUNGSKASSE'
  | 'PENSIONSFONDS'
  | 'CAPITAL_ACCOUNT'
  | 'RIESTER'
  | 'PRIVATE_PENSION_INSURANCE'
  | 'ALTERSVORSORGEDEPOT';

export type RetirementOrigin = 'IMPORTED' | 'MANUAL';

export type RetirementStatus = 'ACTIVE' | 'PAID_UP' | 'IN_PAYOUT';

/** Annual return assumption of the projections printed on private statements (percent). */
export type RetirementScenario = '0' | '3' | '6' | '9';

export type RetirementScenarioMonthly = Partial<Record<RetirementScenario, RetirementMoney>>;

/** Plausibility checks shared by the parsers (device) and the server (data-model.md). */
export type RetirementCheckId =
  | 'STATUTORY_POINTS_VALUE'
  | 'STATUTORY_ORDER'
  | 'STATUTORY_DATES'
  | 'SCENARIOS_MONOTONIC'
  | 'GUARANTEE_BELOW_ZERO_CASE'
  | 'CONTRIBUTION_SUM'
  | 'ACCOUNT_ROLL_FORWARD'
  | 'ACCOUNT_INTEREST';

/** Figures of the DRV Renteninformation (`STATUTORY_PENSION`). `projectedMonthly` is required. */
export interface RetirementStatutoryFigures {
  /** `YYYY-MM-DD` — period the stored DRV data covers. */
  dataPeriodFrom?: string;
  dataPeriodTo?: string;
  fullDisabilityMonthly?: RetirementMoney;
  accruedMonthly?: RetirementMoney;
  projectedMonthly: RetirementMoney;
  projectedAt1Pct?: RetirementMoney;
  projectedAt2Pct?: RetirementMoney;
  /** Entgeltpunkte, up to four decimal places. */
  earningsPoints?: string;
  currentPensionValue?: RetirementMoney;
  contributionsOwn?: RetirementMoney;
  contributionsEmployer?: RetirementMoney;
  contributionsPublic?: RetirementMoney;
}

/**
 * Occupational and private pension contracts. The three contribution fields are typed for
 * `MANUAL` records; for `IMPORTED` records they live in the supplement.
 */
export interface RetirementPensionFigures {
  guaranteedMonthly?: RetirementMoney;
  expectedMonthly?: RetirementMoney;
  guaranteedCapital?: RetirementMoney;
  scenarioMonthly?: RetirementScenarioMonthly;
  currentValue?: RetirementMoney;
  contributionsPaid?: RetirementMoney;
  /** Main contributions paid to date (printed on private statements; used by `CONTRIBUTION_SUM`). */
  contributionsMain?: RetirementMoney;
  /** Extra payments paid to date (printed on private statements; used by `CONTRIBUTION_SUM`). */
  contributionsExtra?: RetirementMoney;
  surrenderValue?: RetirementMoney;
  deathBenefit?: RetirementMoney;
  guaranteePeriodYears?: number;
  capitalPayout?: RetirementMoney;
  contributionMonthly?: RetirementMoney;
  employerContributionMonthly?: RetirementMoney;
  subsidiesYearly?: RetirementMoney;
}

/** Employer capital account (`CAPITAL_ACCOUNT`). `accountBalance` is required. */
export interface RetirementCapitalAccountFigures {
  openingBalance?: RetirementMoney;
  accountBalance: RetirementMoney;
  /** Percent, up to four decimal places. */
  guaranteedInterestRate?: string;
  interestCredit?: RetirementMoney;
  annualContribution?: RetirementMoney;
  finalBonus?: RetirementMoney;
  expectedMonthly?: RetirementMoney;
  contributionMonthly?: RetirementMoney;
  employerContributionMonthly?: RetirementMoney;
}

/** Altersvorsorgedepot: no guaranteed figures. */
export interface RetirementDepotFigures {
  currentValue?: RetirementMoney;
  expectedMonthly?: RetirementMoney;
  contributionMonthly?: RetirementMoney;
}

export type RetirementFigures =
  | RetirementStatutoryFigures
  | RetirementPensionFigures
  | RetirementCapitalAccountFigures
  | RetirementDepotFigures;

/** Figures the statement does not print; editable on `IMPORTED` records (PATCH …/supplement). */
export interface RetirementSupplement {
  contributionMonthly?: RetirementMoney;
  employerContributionMonthly?: RetirementMoney;
  subsidiesYearly?: RetirementMoney;
  expectedMonthly?: RetirementMoney;
  expectedScenario?: RetirementScenario;
}

/** Provenance of an imported record; sent by the client, never the document itself. */
export interface RetirementImportInfo {
  parserId: string;
  parserVersion: string;
  /** The text came from on-device recognition (shows the "double-check" marker). */
  ocrRead: boolean;
}

/** `PUT` body: replaces a manual record. */
export interface RetirementManualRecordInput {
  contractType: RetirementContractType;
  status: RetirementStatus;
  providerLabel?: string;
  /** `YYYY-MM-DD`, not in the future. */
  statementDate: string;
  payoutStart?: string;
  identifier?: string;
  figures: RetirementFigures;
}

/** `POST` body, discriminated by `origin`. */
export interface RetirementRecordInput extends RetirementManualRecordInput {
  origin: RetirementOrigin;
  /** `IMPORTED` only. */
  supplement?: RetirementSupplement;
  /** Required iff `origin = 'IMPORTED'`. */
  import?: RetirementImportInfo;
  /** `IMPORTED` only: id of the record of the same pillar and type this one replaces. */
  replaces?: string;
}

/** `PATCH …/supplement` body; `status` is the plain column. */
export interface RetirementSupplementPatch extends RetirementSupplement {
  status?: RetirementStatus;
}

export interface RetirementRecord {
  id: string;
  pillar: RetirementPillar;
  contractType: RetirementContractType;
  origin: RetirementOrigin;
  status: RetirementStatus;
  providerLabel: string | null;
  statementDate: string;
  payoutStart: string | null;
  identifier: string | null;
  figures: RetirementFigures;
  supplement: RetirementSupplement | null;
  import: RetirementImportInfo | null;
  createdAt: string;
  updatedAt: string;
}

export type RetirementStartRelation = 'EARLIER' | 'SAME' | 'LATER';

export interface RetirementSummaryItem {
  id: string;
  pillar: RetirementPillar;
  contractType: RetirementContractType;
  origin: RetirementOrigin;
  providerLabel: string | null;
  guaranteedMonthly: RetirementMoney;
  expectedMonthly: RetirementMoney;
  /** Capital figure (capital account balance, depot value); never part of the monthly sums. */
  capital: RetirementMoney | null;
  payoutStart: string | null;
  startRelation: RetirementStartRelation | null;
  outdated: boolean;
  incomplete: boolean;
}

export interface RetirementPillarSummary {
  count: number;
  guaranteedMonthly: RetirementMoney;
  expectedMonthly: RetirementMoney;
  items: RetirementSummaryItem[];
}

export interface RetirementSummary {
  expectedMonthly: RetirementMoney;
  guaranteedMonthly: RetirementMoney;
  differenceMonthly: RetirementMoney;
  monthlySavings: RetirementMoney;
  pensionStart: { date: string; source: 'STATUTORY' | 'EARLIEST_CONTRACT' } | null;
  capital: { total: RetirementMoney; items: RetirementSummaryItem[] };
  pillars: {
    statutory: RetirementPillarSummary;
    occupational: RetirementPillarSummary;
    private: RetirementPillarSummary;
  };
  flags: { outdatedCount: number; incompleteCount: number };
  items: RetirementSummaryItem[];
}
