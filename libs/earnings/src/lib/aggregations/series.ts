import type { MonthlyPoint, YearlyPoint } from '@vaultfolio/api-contract';
import { periodYear, type StoredRecord } from '../model';
import { employedPeriods, groupBy, money, ratioOf, totalsOf } from './totals';

/** The employer a period is shown under: its REGULAR record's, else its first record's. */
function periodEmployer(records: readonly StoredRecord[]): string {
  const regular = records.filter((r) => r.kind === 'REGULAR').sort((a, b) => a.seq - b.seq);
  return (regular[0] ?? records[0]).employerId;
}

/**
 * One point per period with data, ascending: the sum of every record of that period — regular,
 * corrections (counted in the month they belong to, FR-018) and payout-only.
 */
export function monthlySeries(records: readonly StoredRecord[]): MonthlyPoint[] {
  return [...groupBy(records, (r) => r.period)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, recs]) => {
      const t = totalsOf(recs);
      return {
        period,
        employerId: periodEmployer(recs),
        gross: money(t.gross),
        regular: money(t.regular),
        bonus: money(t.bonus),
        net: money(t.net),
        taxes: money(t.taxes),
        social: money(t.social),
        payout: money(t.payout),
        hasCorrection: recs.some((r) => r.kind === 'CORRECTION'),
      };
    });
}

/** Calendar-year sums of the monthly figures; ratios are taxes/social over gross (FR-026, FR-028). */
export function yearlySeries(records: readonly StoredRecord[]): YearlyPoint[] {
  return [...groupBy(records, (r) => periodYear(r.period))]
    .sort(([a], [b]) => a - b)
    .map(([year, recs]) => {
      const t = totalsOf(recs);
      return {
        year,
        monthsEmployed: employedPeriods(recs).length,
        gross: money(t.gross),
        regular: money(t.regular),
        bonus: money(t.bonus),
        net: money(t.net),
        taxes: money(t.taxes),
        social: money(t.social),
        taxRatio: ratioOf(t.taxes, t.gross),
        socialRatio: ratioOf(t.social, t.gross),
      };
    });
}

/** Periods whose shown employer differs from the previous period's (dashed markers, FR-027). */
export function employerChanges(monthly: readonly MonthlyPoint[]): string[] {
  return monthly
    .filter((m, i) => i > 0 && m.employerId !== monthly[i - 1].employerId)
    .map((m) => m.period);
}
