import {
  MONTH_GRID_METRICS,
  type MonthGrid,
  type MonthGridMetric,
  type TaxYearRow,
} from '@vaultfolio/api-contract';
import { type EmployerRef, periodMonth, periodYear, type StoredRecord, toPeriod } from '../model';
import { monthlySeries } from './series';
import { employedPeriods, groupBy, money, ratioOf, totalsOf } from './totals';

/** Months without a regular record between the first and last regular month of `year`. */
function gapsBetween(year: number, regular: ReadonlySet<string>): string[] {
  const months = [...regular].map(periodMonth).sort((a, b) => a - b);
  const gaps: string[] = [];
  for (let m = months[0] ?? 1; m <= (months[months.length - 1] ?? 0); m++) {
    if (!regular.has(toPeriod(year, m))) gaps.push(toPeriod(year, m));
  }
  return gaps;
}

/**
 * Regular months missing in a year: every month between the first and last month with a REGULAR
 * record, plus every month that only has a correction (spec Edge Cases). Payout-only months never
 * count as present.
 */
export function missingRegularPeriods(records: readonly StoredRecord[]): string[] {
  const missing = new Set<string>();
  for (const [year, recs] of groupBy(records, (r) => periodYear(r.period))) {
    const regular = new Set(recs.filter((r) => r.kind === 'REGULAR').map((r) => r.period));
    for (const period of gapsBetween(year, regular)) missing.add(period);
    for (const r of recs) {
      if (r.kind === 'CORRECTION' && !regular.has(r.period)) missing.add(r.period);
    }
  }
  return [...missing].sort();
}

/** Year × month grid for every metric (FR-030). */
export function monthGrid(records: readonly StoredRecord[]): MonthGrid {
  const monthly = monthlySeries(records);
  const metrics = Object.fromEntries(
    MONTH_GRID_METRICS.map((metric) => [
      metric,
      Object.fromEntries(monthly.map((m) => [m.period, m[metric]])),
    ]),
  ) as Record<MonthGridMetric, Record<string, string>>;
  return {
    years: [...new Set(monthly.map((m) => periodYear(m.period)))].sort((a, b) => a - b),
    metrics,
    bonusPeriods: monthly.filter((m) => m.bonus !== '0.00').map((m) => m.period),
    missingPeriods: missingRegularPeriods(records),
  };
}

/** All taxes and contributions per calendar year and employer (FR-031). */
export function taxesPerYear(
  records: readonly StoredRecord[],
  employers: readonly EmployerRef[],
): TaxYearRow[] {
  const labels = new Map(employers.map((e) => [e.id, e.label]));
  return [...groupBy(records, (r) => `${periodYear(r.period)}|${r.employerId}`).values()]
    .map((recs) => {
      const t = totalsOf(recs);
      const employerId = recs[0].employerId;
      return {
        year: periodYear(recs[0].period),
        employerId,
        employerLabel: labels.get(employerId) ?? '',
        monthsEmployed: employedPeriods(recs).length,
        gross: money(t.gross),
        bonus: money(t.bonus),
        taxGross: money(t.taxGross),
        wageTax: money(t.wageTax),
        soli: money(t.soli),
        churchTax: money(t.churchTax),
        health: money(t.health),
        care: money(t.care),
        pension: money(t.pension),
        unemployment: money(t.unemployment),
        taxRatio: ratioOf(t.taxes, t.gross),
        socialRatio: ratioOf(t.social, t.gross),
      };
    })
    .sort((a, b) => a.year - b.year || a.employerLabel.localeCompare(b.employerLabel));
}
