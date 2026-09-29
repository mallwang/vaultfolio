/**
 * Shared contract for the Earnings API — see
 * specs/032-earnings-domain/contracts/earnings-api.md and data-model.md. Plain TypeScript
 * interfaces, no runtime dependency, imported by `apps/backend`, `libs/earnings` and
 * `libs/frontend/domain/earnings` so the tiers can never drift on shape (Principle II).
 *
 * Every monetary field is a canonical decimal string with exactly two decimal places
 * (`"1234.56"`, `"-45.00"`), never a JSON number. Ratios are decimal strings with four decimal
 * places (`"0.6160"`).
 */

/** Canonical decimal string, two decimal places. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- names the money format at every use site of the contract
export type EarningsMoney = string;

export type EarningsRecordKind = 'REGULAR' | 'CORRECTION' | 'PAYOUT_ONLY';

export type EarningsSourceType = 'PAYSLIP_PDF' | 'CERTIFICATE_PDF' | 'EXPORT_JSON';

/** Keys of a record's amounts that can carry a one-off (bonus) portion. */
export type EarningsOneOffKey =
  | 'gross'
  | 'taxGross'
  | 'wageTax'
  | 'soli'
  | 'churchTax'
  | 'health'
  | 'care'
  | 'pension'
  | 'unemployment';

/** One-off portion of the record's amounts; a missing key means `"0.00"`. */
export type EarningsOneOffAmounts = Partial<Record<EarningsOneOffKey, EarningsMoney>>;

/** Printed year-to-date totals (regular record of a payslip only); only printed keys are present. */
export type EarningsYtdAmounts = Partial<Record<EarningsOneOffKey, EarningsMoney>>;

/** Employer subsidy for voluntary health / long-term-care insurance (FR-019). */
export interface EarningsEmployerSubsidy {
  health: EarningsMoney;
  care: EarningsMoney;
}

/**
 * Figures of one payslip section (FR-017). Deductions are positive from the employee's view;
 * corrections may carry negative values.
 */
export interface EarningsPayRecordAmounts {
  gross: EarningsMoney;
  taxGross: EarningsMoney;
  svGrossKv: EarningsMoney;
  svGrossRv: EarningsMoney;
  wageTax: EarningsMoney;
  soli: EarningsMoney;
  churchTax: EarningsMoney;
  health: EarningsMoney;
  care: EarningsMoney;
  pension: EarningsMoney;
  unemployment: EarningsMoney;
  net: EarningsMoney;
  other: EarningsMoney;
  /** Only on the section of the payslip's own month, else `null`. */
  payout: EarningsMoney | null;
  oneOff: EarningsOneOffAmounts;
  employerSubsidy: EarningsEmployerSubsidy | null;
  ytd: EarningsYtdAmounts | null;
}

export type EarningsCheckCode = 'NET' | 'PAYOUT';

export interface EarningsCheckResult {
  code: EarningsCheckCode;
  passed: boolean;
  /** Signed `expected − actual`; `"0.00"` when exactly equal. */
  difference: EarningsMoney;
}

/** Amounts as stored and returned by read routes: the submitted figures plus check results. */
export interface EarningsStoredPayRecordAmounts extends EarningsPayRecordAmounts {
  checks: EarningsCheckResult[];
}

/** Certified totals of a wage-tax certificate (official form lines); missing lines are `"0.00"`. */
export interface EarningsCertificateAmounts {
  /** Line 3 */
  grossWage: EarningsMoney;
  /** Line 4 */
  wageTax: EarningsMoney;
  /** Line 5 */
  soli: EarningsMoney;
  /** Line 6 */
  churchTax: EarningsMoney;
  /** Line 10 — multi-year compensation (reduced-rate pay) */
  multiYearComp: EarningsMoney;
  /** Line 11 */
  multiYearWageTax: EarningsMoney;
  /** Line 12 */
  multiYearSoli: EarningsMoney;
  /** Line 13 */
  multiYearChurchTax: EarningsMoney;
  /** Line 22a */
  pensionEmployer: EarningsMoney;
  /** Line 23a */
  pensionEmployee: EarningsMoney;
  /** Line 24a */
  employerSubsidyHealth: EarningsMoney;
  /** Line 24c */
  employerSubsidyCare: EarningsMoney;
  /** Line 25 */
  health: EarningsMoney;
  /** Line 26 */
  care: EarningsMoney;
  /** Line 27 */
  unemployment: EarningsMoney;
}

// ------------------------------------------------------------------ import

export interface EarningsPayRecordInput {
  employer: string;
  /** `YYYY-MM` — month the values belong to (FR-018). */
  period: string;
  /** `YYYY-MM` — month of the payslip containing the section. */
  issued: string;
  kind: EarningsRecordKind;
  seq: number;
  amounts: EarningsPayRecordAmounts;
}

export interface EarningsCertificateInput {
  employer: string;
  year: number;
  amounts: EarningsCertificateAmounts;
}

/** One file of an import batch — the whitelisted figures only (FR-008, FR-009, FR-017). */
export interface EarningsImportFile {
  /** Browser-local id, echoed back. */
  clientFileId: string;
  fileName: string;
  sourceType: EarningsSourceType;
  /** Lowercase hex SHA-256 of the file bytes, computed in the browser. */
  fileSha256: string;
  parserId: string;
  parserVersion: string;
  records: EarningsPayRecordInput[];
  certificates: EarningsCertificateInput[];
}

/** Body of `POST /earnings/imports/preview` and `POST /earnings/imports`. */
export interface EarningsImportBatch {
  files: EarningsImportFile[];
}

/**
 * Every code a parser, the export reader, the validation or the API can report for a file. The UI
 * translates each code (FR-046); parsers never produce language text.
 */
export type EarningsIssueCode =
  | 'UNSUPPORTED_FORMAT'
  | 'IMAGE_ONLY'
  | 'PASSWORD_PROTECTED'
  | 'UNREADABLE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_LINE'
  | 'CHECK_FAILED'
  | 'EARNINGS_UNKNOWN_FIELD'
  | 'INVALID_VALUE'
  | 'LIMIT_EXCEEDED'
  | 'EXPORT_UNSUPPORTED_VERSION'
  | 'EXPORT_UNKNOWN_FIELD'
  | 'BATCH_CONFLICT';

export interface EarningsRejection {
  code: EarningsIssueCode;
  /** Codes, paths, periods, check names and the check difference — never document text. */
  params?: Record<string, string>;
}

export type EarningsPreviewStatus = 'NEW' | 'REPLACES' | 'DUPLICATE' | 'REJECTED';

/** A stored record or certificate that a file of the batch would replace (FR-016). */
export interface EarningsReplacedItem {
  employer: string;
  /** Set for records. */
  period: string | null;
  kind: EarningsRecordKind | null;
  seq: number | null;
  /** Set for certificates. */
  year: number | null;
  importedAt: string;
  fileName: string;
}

export interface EarningsDuplicateOf {
  importId: string;
  importedAt: string;
  fileName: string;
}

export interface EarningsFilePreview {
  clientFileId: string;
  status: EarningsPreviewStatus;
  employers: string[];
  /** Distinct periods of the file's records, ascending. */
  periods: string[];
  /** Distinct certificate years, ascending. */
  years: number[];
  recordCount: number;
  certificateCount: number;
  includesCorrection: boolean;
  replaces: EarningsReplacedItem[];
  duplicateOf: EarningsDuplicateOf | null;
  /** `clientFileId` of another file in this batch that shares an identity or the fingerprint. */
  conflictsWith: string | null;
  rejection: EarningsRejection | null;
}

export interface EarningsImportPreview {
  files: EarningsFilePreview[];
}

export type EarningsCommitStatus = 'SAVED' | 'SKIPPED_DUPLICATE' | 'REJECTED';

export interface EarningsFileResult {
  clientFileId: string;
  status: EarningsCommitStatus;
  importId?: string;
  recordCount?: number;
  certificateCount?: number;
  rejection?: EarningsRejection;
}

export interface EarningsImportResult {
  files: EarningsFileResult[];
}

/** One row of the import history (`GET /earnings/imports`, FR-021). */
export interface EarningsImportSummary {
  id: string;
  fileName: string;
  sourceType: EarningsSourceType;
  parserId: string;
  parserVersion: string;
  importedAt: string;
  /** Records still attributed to this import (0 once all were replaced). */
  recordCount: number;
  certificateCount: number;
  employers: string[];
  firstPeriod: string | null;
  lastPeriod: string | null;
  years: number[];
}

// ------------------------------------------------------------------ employers

export interface EarningsEmployer {
  id: string;
  detectedName: string;
  displayName: string | null;
}

/** Body of `PUT /earnings/employers/:id`; empty after trimming → `null` (use detected name). */
export interface RenameEarningsEmployerRequest {
  displayName: string;
}

// ------------------------------------------------------------------ read models

export interface EarningsTotals {
  gross: EarningsMoney;
  net: EarningsMoney;
  taxes: EarningsMoney;
  social: EarningsMoney;
  bonus: EarningsMoney;
}

export interface CareerEntry {
  /** `'ALL'` for the whole career, else the employer id. */
  key: string;
  label: string;
  firstPeriod: string;
  lastPeriod: string;
  monthsEmployed: number;
  employerCount: number;
  totals: EarningsTotals;
  /** Totals divided by months employed. */
  perMonth: EarningsTotals;
  netRatio: string;
}

export interface LatestYearFigures extends EarningsTotals {
  netRatio: string;
}

export interface LatestYear {
  year: number;
  /** Number of months with data in the latest year (latest month number). */
  months: number;
  /** First and last compared month number, e.g. `[1, 9]`. */
  comparedMonths: [number, number];
  current: LatestYearFigures;
  /** Same months of the previous year; `null` without data for it. */
  previous: LatestYearFigures | null;
}

export interface YearlyPoint {
  year: number;
  monthsEmployed: number;
  gross: EarningsMoney;
  regular: EarningsMoney;
  bonus: EarningsMoney;
  net: EarningsMoney;
  taxes: EarningsMoney;
  social: EarningsMoney;
  taxRatio: string;
  socialRatio: string;
}

export interface MonthlyPoint {
  period: string;
  employerId: string;
  gross: EarningsMoney;
  regular: EarningsMoney;
  bonus: EarningsMoney;
  net: EarningsMoney;
  taxes: EarningsMoney;
  social: EarningsMoney;
  payout: EarningsMoney;
  hasCorrection: boolean;
}

export interface EarningsOverview {
  hasData: boolean;
  career: CareerEntry[];
  latestYear: LatestYear | null;
  yearly: YearlyPoint[];
  monthly: MonthlyPoint[];
  /** Periods whose employer differs from the previous month's. */
  employerChanges: string[];
  dataCheckIssues: number;
}

export interface EarningsRecordDetail {
  id: string;
  employerId: string;
  employerLabel: string;
  period: string;
  issued: string;
  kind: EarningsRecordKind;
  seq: number;
  amounts: EarningsStoredPayRecordAmounts;
  import: { id: string; fileName: string };
}

export type MonthGridMetric = 'gross' | 'regular' | 'bonus' | 'net' | 'taxes' | 'social' | 'payout';

export const MONTH_GRID_METRICS: readonly MonthGridMetric[] = [
  'gross',
  'regular',
  'bonus',
  'net',
  'taxes',
  'social',
  'payout',
];

export interface MonthGrid {
  years: number[];
  /** Per metric: `period → amount` for every period with data. */
  metrics: Record<MonthGridMetric, Record<string, EarningsMoney>>;
  bonusPeriods: string[];
  /** Missing regular months inside an employment year. */
  missingPeriods: string[];
}

export interface TaxYearRow {
  year: number;
  employerId: string;
  employerLabel: string;
  monthsEmployed: number;
  gross: EarningsMoney;
  bonus: EarningsMoney;
  taxGross: EarningsMoney;
  wageTax: EarningsMoney;
  soli: EarningsMoney;
  churchTax: EarningsMoney;
  health: EarningsMoney;
  care: EarningsMoney;
  pension: EarningsMoney;
  unemployment: EarningsMoney;
  taxRatio: string;
  socialRatio: string;
}

export interface CertificateRow {
  id: string;
  year: number;
  employerId: string;
  employerLabel: string;
  amounts: EarningsCertificateAmounts;
  fileName: string;
}

export interface EarningsTables {
  monthGrid: MonthGrid;
  taxesPerYear: TaxYearRow[];
  certificates: CertificateRow[];
}

export type DataCheckComparisonStatus = 'MATCH' | 'DIFFERS' | 'NOT_AVAILABLE';

export interface DataCheckComparison {
  status: DataCheckComparisonStatus;
  /** Number of values compared. */
  compared: number;
  /** Field names of the differing values — never amounts. */
  differing: string[];
}

export interface DataCheckRow {
  year: number;
  employerId: string;
  employerLabel: string;
  ytd: DataCheckComparison;
  certificate: DataCheckComparison;
  completeness: { status: 'COMPLETE' | 'MISSING'; missingPeriods: string[] };
  /** Corrections issued after the year's last payslip, excluded from both comparisons. */
  lateCorrections: { period: string; issued: string }[];
}

// ------------------------------------------------------------------ errors

/** Whole-request error codes of the `/earnings/*` routes. */
export type EarningsErrorCode =
  | 'EARNINGS_UNAVAILABLE'
  | 'EARNINGS_UNKNOWN_FIELD'
  | 'INVALID_BATCH'
  | 'INVALID_VALUE'
  | 'LIMIT_EXCEEDED'
  | 'EARNINGS_IMPORT_NOT_FOUND'
  | 'EARNINGS_EMPLOYER_NOT_FOUND';
