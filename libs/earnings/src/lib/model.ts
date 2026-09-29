import Decimal from 'decimal.js';
import type {
  EarningsCertificateAmounts,
  EarningsCertificateInput,
  EarningsCheckResult,
  EarningsEmployerSubsidy,
  EarningsImportFile,
  EarningsIssueCode,
  EarningsMoney,
  EarningsOneOffAmounts,
  EarningsOneOffKey,
  EarningsPayRecordAmounts,
  EarningsPayRecordInput,
  EarningsRecordKind,
  EarningsStoredPayRecordAmounts,
  EarningsYtdAmounts,
} from '@vaultfolio/api-contract';

/**
 * Normalized earnings model shared by the browser (parsers, preview pre-checks) and the backend
 * (validation, checks, aggregation). The shapes are declared once in `@vaultfolio/api-contract`
 * and re-exported here under the names of contracts/earnings-lib.md.
 */
export type Money = EarningsMoney;
export type RecordKind = EarningsRecordKind;
export type OneOffKey = EarningsOneOffKey;
export type PayRecordAmounts = EarningsPayRecordAmounts;
export type StoredPayRecordAmounts = EarningsStoredPayRecordAmounts;
export type OneOffAmounts = EarningsOneOffAmounts;
export type EmployerSubsidy = EarningsEmployerSubsidy;
export type YtdAmounts = EarningsYtdAmounts;
export type CertificateAmounts = EarningsCertificateAmounts;
export type PayRecordInput = EarningsPayRecordInput;
export type CertificateInput = EarningsCertificateInput;
export type CheckResult = EarningsCheckResult;
export type ImportFileInput = EarningsImportFile;

export type ParseErrorCode = EarningsIssueCode;

export interface ParseError {
  code: ParseErrorCode;
  params?: Record<string, string>;
}

export type ParseOutcome =
  | { ok: true; employer: string; records: PayRecordInput[]; certificates: CertificateInput[] }
  | { ok: false; error: ParseError };

/** A decrypted record as the backend loads it for aggregation. */
export interface StoredRecord {
  id: string;
  importId: string;
  employerId: string;
  period: string;
  issued: string;
  kind: RecordKind;
  seq: number;
  amounts: StoredPayRecordAmounts;
}

/** A decrypted certificate as the backend loads it for aggregation. */
export interface StoredCertificate {
  id: string;
  importId: string;
  employerId: string;
  year: number;
  amounts: CertificateAmounts;
}

export interface EmployerRef {
  id: string;
  label: string;
}

export const RECORD_KINDS: readonly RecordKind[] = ['REGULAR', 'CORRECTION', 'PAYOUT_ONLY'];

export const TAX_KEYS = ['wageTax', 'soli', 'churchTax'] as const;
export const SOCIAL_KEYS = ['health', 'care', 'pension', 'unemployment'] as const;

/** Money keys of `PayRecordAmounts` that are always present. */
export const PAY_AMOUNT_KEYS = [
  'gross',
  'taxGross',
  'svGrossKv',
  'svGrossRv',
  ...TAX_KEYS,
  ...SOCIAL_KEYS,
  'net',
  'other',
] as const;
export type PayAmountKey = (typeof PAY_AMOUNT_KEYS)[number];

export const ONE_OFF_KEYS: readonly OneOffKey[] = [
  'gross',
  'taxGross',
  ...TAX_KEYS,
  ...SOCIAL_KEYS,
];

export const CERTIFICATE_KEYS = [
  'grossWage',
  'wageTax',
  'soli',
  'churchTax',
  'multiYearComp',
  'multiYearWageTax',
  'multiYearSoli',
  'multiYearChurchTax',
  'pensionEmployer',
  'pensionEmployee',
  'employerSubsidyHealth',
  'employerSubsidyCare',
  'health',
  'care',
  'unemployment',
] as const satisfies readonly (keyof CertificateAmounts)[];

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MONEY_PATTERN = /^-?\d{1,9}\.\d{2}$/;

// ------------------------------------------------------------------ money helpers

export const ZERO: Money = '0.00';

/** One-cent tolerance of every arithmetic check (FR-011). */
export const TOLERANCE = new Decimal('0.01');

export function isMoney(value: unknown): value is Money {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

/** Parses a canonical money string; anything else (numbers, `"1,00"`, `"1.5"`) throws. */
export function parseMoney(value: Money): Decimal {
  if (!isMoney(value)) {
    throw new TypeError('Not a canonical money string');
  }
  return new Decimal(value);
}

/** Formats a decimal as a canonical money string (2 dp, half-up, no `-0.00`). */
export function toMoney(value: Decimal.Value): Money {
  const d = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return d.isZero() ? ZERO : d.toFixed(2);
}

export function add(...values: Money[]): Money {
  return sum(values);
}

export function sub(a: Money, b: Money): Money {
  return toMoney(parseMoney(a).minus(parseMoney(b)));
}

export function neg(a: Money): Money {
  return toMoney(parseMoney(a).negated());
}

export function sum(values: readonly Money[]): Money {
  return toMoney(values.reduce((acc, v) => acc.plus(parseMoney(v)), new Decimal(0)));
}

/** Integer cents → money string: `123456` → `"1234.56"`, `-2207` → `"-22.07"`. */
export function centsToMoney(cents: number): Money {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError('Cents must be an integer');
  }
  return toMoney(new Decimal(cents).dividedBy(100));
}

/** `numerator / denominator` with 4 decimal places; `"0.0000"` for a zero denominator. */
export function ratio(numerator: Money, denominator: Money): string {
  const d = parseMoney(denominator);
  if (d.isZero()) {
    return '0.0000';
  }
  const r = parseMoney(numerator).dividedBy(d).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return r.isZero() ? '0.0000' : r.toFixed(4);
}

/** `value / count` as money (per-month averages); `"0.00"` for a zero count. */
export function divide(value: Money, count: number): Money {
  return count === 0 ? ZERO : toMoney(parseMoney(value).dividedBy(count));
}

/** True when `|a − b| ≤ 0.01`. */
export function withinTolerance(a: Money, b: Money): boolean {
  return parseMoney(a).minus(parseMoney(b)).abs().lessThanOrEqualTo(TOLERANCE);
}

export function taxesOf(a: Pick<PayRecordAmounts, (typeof TAX_KEYS)[number]>): Money {
  return sum(TAX_KEYS.map((k) => a[k]));
}

export function socialOf(a: Pick<PayRecordAmounts, (typeof SOCIAL_KEYS)[number]>): Money {
  return sum(SOCIAL_KEYS.map((k) => a[k]));
}

/** One-off value of a key, `"0.00"` when absent. */
export function oneOffOf(a: { oneOff: OneOffAmounts }, key: OneOffKey): Money {
  return a.oneOff[key] ?? ZERO;
}

export function emptyPayRecordAmounts(): PayRecordAmounts {
  return {
    gross: ZERO,
    taxGross: ZERO,
    svGrossKv: ZERO,
    svGrossRv: ZERO,
    wageTax: ZERO,
    soli: ZERO,
    churchTax: ZERO,
    health: ZERO,
    care: ZERO,
    pension: ZERO,
    unemployment: ZERO,
    net: ZERO,
    other: ZERO,
    payout: null,
    oneOff: {},
    employerSubsidy: null,
    ytd: null,
  };
}

export function emptyCertificateAmounts(): CertificateAmounts {
  return Object.fromEntries(
    CERTIFICATE_KEYS.map((k) => [k, ZERO]),
  ) as unknown as CertificateAmounts;
}

// ------------------------------------------------------------------ periods

export function periodYear(period: string): number {
  return Number(period.slice(0, 4));
}

export function periodMonth(period: string): number {
  return Number(period.slice(5, 7));
}

export function toPeriod(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Whole months from `from` to `to` (`2026-07` → `2026-09` = 2). */
export function monthsBetween(from: string, to: string): number {
  return (periodYear(to) - periodYear(from)) * 12 + periodMonth(to) - periodMonth(from);
}

/** Normalized employer name: trimmed, inner whitespace collapsed (FR-020). */
export function normalizeEmployerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
