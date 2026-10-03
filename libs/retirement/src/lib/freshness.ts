import type { RetirementPensionFigures, RetirementRecord } from '@vaultfolio/api-contract';
import { type Money, familyOf } from './model';

/** Statements older than this many months are flagged "outdated" (research R8). */
export const OUTDATED_AFTER_MONTHS = 12;

/**
 * Whether `statementDate` (`YYYY-MM-DD`) lies more than {@link OUTDATED_AFTER_MONTHS} months before
 * `now`. Exactly twelve months back is still current; the clock is injected for tests.
 */
export function isOutdated(statementDate: string, now: Date): boolean {
  const [y, m, d] = statementDate.split('-').map(Number);
  const limit = new Date(Date.UTC(y, m - 1 + OUTDATED_AFTER_MONTHS, d));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return today.getTime() > limit.getTime();
}

/**
 * The expected monthly pension of a contract, or `undefined` when none is known: the typed or
 * supplemented expected figure, else — for an imported private statement — the printed scenario the
 * user chose (default 3 %, research R9). Capital accounts and the statutory pension have their own
 * rules and return `undefined`/their projection respectively.
 */
export function expectedMonthlyOf(record: RetirementRecord): Money | undefined {
  switch (familyOf(record.contractType)) {
    case 'STATUTORY':
      return (record.figures as { projectedMonthly?: Money }).projectedMonthly;
    case 'CAPITAL_ACCOUNT':
    case 'DEPOT': {
      const figures = record.figures as { expectedMonthly?: Money };
      return record.supplement?.expectedMonthly ?? figures.expectedMonthly;
    }
    default: {
      const figures = record.figures as RetirementPensionFigures;
      if (figures.expectedMonthly !== undefined) return figures.expectedMonthly;
      if (record.supplement?.expectedMonthly !== undefined)
        return record.supplement.expectedMonthly;
      return figures.scenarioMonthly?.[record.supplement?.expectedScenario ?? '3'];
    }
  }
}

/** The guaranteed monthly pension of a contract (`undefined` for none; depots never have one). */
export function guaranteedMonthlyOf(record: RetirementRecord): Money | undefined {
  return familyOf(record.contractType) === 'PENSION'
    ? (record.figures as RetirementPensionFigures).guaranteedMonthly
    : undefined;
}

/**
 * Whether a record lacks the figure that feeds the monthly sums: a contract with neither a
 * guaranteed nor an expected pension. Capital accounts count as complete (they are capital, not a
 * pension, FR-002d); the statutory record always has its required projection.
 */
export function isIncomplete(record: RetirementRecord): boolean {
  switch (familyOf(record.contractType)) {
    case 'STATUTORY':
    case 'CAPITAL_ACCOUNT':
      return false;
    case 'DEPOT':
      return expectedMonthlyOf(record) === undefined;
    default:
      return guaranteedMonthlyOf(record) === undefined && expectedMonthlyOf(record) === undefined;
  }
}
