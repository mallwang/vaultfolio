import type {
  CareerEntry,
  EarningsTotals,
  LatestYear,
  LatestYearFigures,
} from '@vaultfolio/api-contract';
import { type EmployerRef, periodMonth, periodYear, type StoredRecord } from '../model';
import {
  employedPeriods,
  groupBy,
  money,
  perMonth,
  ratioOf,
  type Totals,
  totalsOf,
} from './totals';

function totalsView(t: Totals): EarningsTotals {
  return {
    gross: money(t.gross),
    net: money(t.net),
    taxes: money(t.taxes),
    social: money(t.social),
    bonus: money(t.bonus),
  };
}

function entry(key: string, label: string, records: readonly StoredRecord[]): CareerEntry {
  const t = totalsOf(records);
  const months = employedPeriods(records).length;
  const periods = records.map((r) => r.period).sort();
  return {
    key,
    label,
    firstPeriod: periods[0],
    lastPeriod: periods[periods.length - 1],
    monthsEmployed: months,
    employerCount: new Set(records.map((r) => r.employerId)).size,
    totals: totalsView(t),
    perMonth: {
      gross: perMonth(t.gross, months),
      net: perMonth(t.net, months),
      taxes: perMonth(t.taxes, months),
      social: perMonth(t.social, months),
      bonus: perMonth(t.bonus, months),
    },
    netRatio: ratioOf(t.net, t.gross),
  };
}

/**
 * Career summary (FR-024): a whole-career entry (`key: 'ALL'`, only with more than one employer)
 * followed by one entry per employer in order of their first period. Averages divide by months
 * employed. The whole-career label is empty — the UI shows its translated title.
 */
export function careerSummary(
  records: readonly StoredRecord[],
  employers: readonly EmployerRef[],
): CareerEntry[] {
  if (records.length === 0) return [];
  const labels = new Map(employers.map((e) => [e.id, e.label]));
  const perEmployer = [...groupBy(records, (r) => r.employerId)]
    .map(([id, recs]) => entry(id, labels.get(id) ?? '', recs))
    .sort((a, b) => a.firstPeriod.localeCompare(b.firstPeriod) || a.label.localeCompare(b.label));
  return perEmployer.length > 1 ? [entry('ALL', '', records), ...perEmployer] : perEmployer;
}

function figures(records: readonly StoredRecord[]): LatestYearFigures {
  const t = totalsOf(records);
  return { ...totalsView(t), netRatio: ratioOf(t.net, t.gross) };
}

/**
 * Latest-year KPIs (FR-025): the latest year with data, months 1..n (n = its latest month),
 * compared with the same months 1..n of the previous year (design decision) — `previous` is
 * `null` when the previous year has no records in those months.
 */
export function latestYearComparison(records: readonly StoredRecord[]): LatestYear | null {
  if (records.length === 0) return null;
  const latest = records.map((r) => r.period).sort()[records.length - 1];
  const year = periodYear(latest);
  const months = periodMonth(latest);
  const inRange = (y: number) =>
    records.filter((r) => periodYear(r.period) === y && periodMonth(r.period) <= months);
  const previous = inRange(year - 1);
  return {
    year,
    months,
    comparedMonths: [1, months],
    current: figures(inRange(year)),
    previous: previous.length > 0 ? figures(previous) : null,
  };
}
