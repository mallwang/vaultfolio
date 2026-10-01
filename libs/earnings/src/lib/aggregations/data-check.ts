import Decimal from 'decimal.js';
import type {
  DataCheckComparison,
  DataCheckDifference,
  DataCheckRow,
} from '@vaultfolio/api-contract';
import {
  type CertificateAmounts,
  type EmployerRef,
  parseMoney,
  periodYear,
  type StoredCertificate,
  type StoredRecord,
  TOLERANCE,
  toMoney,
  type YtdAmounts,
} from '../model';
import { missingRegularPeriods } from './tables';
import { groupBy } from './totals';

/** The figures compared per year (not `gross`: the printed year-to-date gross omits §37b benefits). */
const YEAR_KEYS = [
  'taxGross',
  'wageTax',
  'soli',
  'churchTax',
  'health',
  'care',
  'pension',
  'unemployment',
] as const;
type YearKey = (typeof YEAR_KEYS)[number];

/** Certificate line → compared figure, plus the multi-year (lines 10–13) and subsidy (24a/c) adjustments. */
const CERTIFICATE_MAP: Record<
  YearKey,
  {
    line: keyof CertificateAmounts;
    plus?: keyof CertificateAmounts;
    minus?: keyof CertificateAmounts;
  }
> = {
  taxGross: { line: 'grossWage', plus: 'multiYearComp' },
  wageTax: { line: 'wageTax', plus: 'multiYearWageTax' },
  soli: { line: 'soli', plus: 'multiYearSoli' },
  churchTax: { line: 'churchTax', plus: 'multiYearChurchTax' },
  pension: { line: 'pensionEmployee' },
  health: { line: 'health', minus: 'employerSubsidyHealth' },
  care: { line: 'care', minus: 'employerSubsidyCare' },
  unemployment: { line: 'unemployment' },
};

function sums(records: readonly StoredRecord[]): Record<YearKey, Decimal> {
  return Object.fromEntries(
    YEAR_KEYS.map((k) => [
      k,
      records.reduce((acc, r) => acc.plus(parseMoney(r.amounts[k])), new Decimal(0)),
    ]),
  ) as Record<YearKey, Decimal>;
}

function compare(
  expected: Partial<Record<YearKey, Decimal>>,
  actual: Record<YearKey, Decimal>,
): DataCheckComparison {
  const keys = YEAR_KEYS.filter((k) => expected[k] !== undefined);
  const differences: DataCheckDifference[] = keys
    .filter((k) => (expected[k] as Decimal).minus(actual[k]).abs().greaterThan(TOLERANCE))
    .map((k) => ({
      field: k,
      expected: toMoney(expected[k] as Decimal),
      actual: toMoney(actual[k]),
      difference: toMoney(actual[k].minus(expected[k] as Decimal)),
    }));
  return { status: differences.length ? 'DIFFERS' : 'MATCH', compared: keys.length, differences };
}

const NOT_AVAILABLE: DataCheckComparison = {
  status: 'NOT_AVAILABLE',
  compared: 0,
  differences: [],
};
const NOT_COMPARABLE: DataCheckComparison = {
  status: 'NOT_COMPARABLE',
  compared: 0,
  differences: [],
};

/** Last regular record of the year with printed year-to-date totals (highest issued, period, seq). */
function lastWithYtd(records: readonly StoredRecord[]): StoredRecord | null {
  return records
    .filter((r) => r.kind === 'REGULAR' && r.amounts.ytd)
    .reduce<StoredRecord | null>((best, r) => {
      if (!best) return r;
      const a = [r.issued, r.period, String(r.seq).padStart(4, '0')].join('|');
      const b = [best.issued, best.period, String(best.seq).padStart(4, '0')].join('|');
      return a > b ? r : best;
    }, null);
}

function subsidies(records: readonly StoredRecord[], key: 'health' | 'care'): Decimal {
  return records.reduce(
    (acc, r) =>
      acc.plus(r.amounts.employerSubsidy ? parseMoney(r.amounts.employerSubsidy[key]) : 0),
    new Decimal(0),
  );
}

/** Printed year-to-date totals; voluntary KV/PV: the printed total is the full contribution, the records hold the own share. */
function ytdExpected(
  last: StoredRecord,
  known: readonly StoredRecord[],
): Partial<Record<YearKey, Decimal>> {
  const printed = last.amounts.ytd as YtdAmounts;
  const expected: Partial<Record<YearKey, Decimal>> = {};
  for (const k of YEAR_KEYS) {
    const value = printed[k];
    if (value === undefined) continue;
    expected[k] =
      k === 'health' || k === 'care'
        ? parseMoney(value).minus(subsidies(known, k))
        : parseMoney(value);
  }
  return expected;
}

/** Certified totals mapped onto the record keys (lines 10–13 added, subsidies subtracted). */
function certificateExpected(cert: StoredCertificate): Record<YearKey, Decimal> {
  return Object.fromEntries(
    YEAR_KEYS.map((k) => {
      const map = CERTIFICATE_MAP[k];
      let value = parseMoney(cert.amounts[map.line]);
      if (map.plus) value = value.plus(parseMoney(cert.amounts[map.plus]));
      if (map.minus) value = value.minus(parseMoney(cert.amounts[map.minus]));
      return [k, value];
    }),
  ) as Record<YearKey, Decimal>;
}

function certificateCheck(
  cert: StoredCertificate | undefined,
  hasPayslips: boolean,
  actual: Record<YearKey, Decimal>,
): DataCheckComparison {
  if (!cert) return NOT_AVAILABLE;
  return hasPayslips ? compare(certificateExpected(cert), actual) : NOT_COMPARABLE;
}

function completenessCheck(
  records: readonly StoredRecord[],
  hasPayslips: boolean,
): DataCheckRow['completeness'] {
  if (!hasPayslips) return { status: 'NO_PAYSLIPS', missingPeriods: [] };
  const missingPeriods = missingRegularPeriods(records);
  return { status: missingPeriods.length ? 'MISSING' : 'COMPLETE', missingPeriods };
}

/**
 * Data check per employer and year (FR-033): payslip sums vs. the year-to-date totals of the
 * year's last payslip, vs. the wage-tax certificate (lines 10–13 added, voluntary KV/PV subsidies
 * subtracted), and completeness of regular months. Corrections issued after the year's last
 * payslip can be in neither printed value: they are excluded from both comparisons and listed.
 * A year without any regular payslip (e.g. only a certificate) is `NO_PAYSLIPS` and its
 * certificate `NOT_COMPARABLE` — comparing against zero sums says nothing.
 */
export function dataCheck(
  records: readonly StoredRecord[],
  certificates: readonly StoredCertificate[],
  employers: readonly EmployerRef[],
): DataCheckRow[] {
  const labels = new Map(employers.map((e) => [e.id, e.label]));
  const groups = groupBy(records, (r) => `${r.employerId}|${periodYear(r.period)}`);
  for (const c of certificates) {
    const key = `${c.employerId}|${c.year}`;
    if (!groups.has(key)) groups.set(key, []);
  }

  const rows: DataCheckRow[] = [];
  for (const [key, recs] of groups) {
    const [employerId, yearText] = key.split('|');
    const year = Number(yearText);
    const last = lastWithYtd(recs);
    const late = last ? recs.filter((r) => r.issued > last.issued) : [];
    const known = recs.filter((r) => !late.includes(r));
    const actual = sums(known);
    const cert = certificates.find((c) => c.employerId === employerId && c.year === year);
    const hasPayslips = recs.some((r) => r.kind === 'REGULAR');
    rows.push({
      year,
      employerId,
      employerLabel: labels.get(employerId) ?? '',
      ytd: last ? compare(ytdExpected(last, known), actual) : NOT_AVAILABLE,
      certificate: certificateCheck(cert, hasPayslips, actual),
      completeness: completenessCheck(recs, hasPayslips),
      lateCorrections: late
        .map((r) => ({ period: r.period, issued: r.issued }))
        .sort((a, b) => a.period.localeCompare(b.period)),
    });
  }
  return rows.sort((a, b) => a.year - b.year || a.employerLabel.localeCompare(b.employerLabel));
}

/** Rows with any failing check — the count shown on the Data check tab and the overview strip. */
export function dataCheckIssueCount(rows: readonly DataCheckRow[]): number {
  return rows.filter(
    (r) =>
      r.ytd.status === 'DIFFERS' ||
      r.certificate.status === 'DIFFERS' ||
      r.completeness.status === 'MISSING',
  ).length;
}
