import Decimal from 'decimal.js';
import type {
  RetirementCapitalAccountFigures,
  RetirementCheckId,
  RetirementFigures,
  RetirementPensionFigures,
  RetirementStatutoryFigures,
} from '@vaultfolio/api-contract';
import { type ContractType, familyOf, withinTolerance } from './model';

/** Outcome of one plausibility check — the id only, never a figure (log/response safe). */
export interface CheckResult {
  id: RetirementCheckId;
  ok: boolean;
}

export interface CheckDates {
  statementDate: string;
  payoutStart?: string | null;
}

/** Non-decreasing chain over the values that are present. */
function nonDecreasing(values: readonly (string | undefined)[]): boolean {
  const present = values.filter((v): v is string => v !== undefined).map((v) => new Decimal(v));
  return present.every((v, i) => i === 0 || v.greaterThanOrEqualTo(present[i - 1]));
}

function statutoryChecks(f: RetirementStatutoryFigures, dates: CheckDates): CheckResult[] {
  const out: CheckResult[] = [];
  if (f.earningsPoints !== undefined && f.currentPensionValue !== undefined && f.accruedMonthly) {
    out.push({
      id: 'STATUTORY_POINTS_VALUE',
      ok: withinTolerance(
        new Decimal(f.earningsPoints).times(f.currentPensionValue),
        f.accruedMonthly,
      ),
    });
  }
  out.push({
    id: 'STATUTORY_ORDER',
    ok:
      nonDecreasing([f.accruedMonthly, f.projectedMonthly, f.projectedAt1Pct, f.projectedAt2Pct]) &&
      (f.fullDisabilityMonthly === undefined ||
        f.accruedMonthly === undefined ||
        new Decimal(f.fullDisabilityMonthly).greaterThanOrEqualTo(f.accruedMonthly)),
  });
  if (dates.payoutStart) {
    const payoutAfterStatement = dates.payoutStart > dates.statementDate;
    const periodBeforePayout = f.dataPeriodTo === undefined || f.dataPeriodTo < dates.payoutStart;
    const periodOrdered =
      f.dataPeriodFrom === undefined ||
      f.dataPeriodTo === undefined ||
      f.dataPeriodFrom <= f.dataPeriodTo;
    out.push({
      id: 'STATUTORY_DATES',
      ok: payoutAfterStatement && periodBeforePayout && periodOrdered,
    });
  }
  return out;
}

function pensionChecks(f: RetirementPensionFigures): CheckResult[] {
  const out: CheckResult[] = [];
  const s = f.scenarioMonthly;
  if (s) {
    out.push({ id: 'SCENARIOS_MONOTONIC', ok: nonDecreasing([s['0'], s['3'], s['6'], s['9']]) });
    if (f.guaranteedMonthly !== undefined && s['0'] !== undefined) {
      out.push({
        id: 'GUARANTEE_BELOW_ZERO_CASE',
        ok: new Decimal(f.guaranteedMonthly).lessThanOrEqualTo(s['0']),
      });
    }
  }
  if (
    f.contributionsMain !== undefined &&
    f.contributionsExtra !== undefined &&
    f.contributionsPaid !== undefined
  ) {
    out.push({
      id: 'CONTRIBUTION_SUM',
      ok: withinTolerance(
        new Decimal(f.contributionsMain).plus(f.contributionsExtra),
        f.contributionsPaid,
      ),
    });
  }
  return out;
}

function capitalAccountChecks(f: RetirementCapitalAccountFigures): CheckResult[] {
  const out: CheckResult[] = [];
  if (
    f.openingBalance !== undefined &&
    f.interestCredit !== undefined &&
    f.annualContribution !== undefined
  ) {
    out.push({
      id: 'ACCOUNT_ROLL_FORWARD',
      ok: withinTolerance(
        new Decimal(f.openingBalance).plus(f.interestCredit).plus(f.annualContribution),
        f.accountBalance,
      ),
    });
  }
  if (
    f.openingBalance !== undefined &&
    f.interestCredit !== undefined &&
    f.guaranteedInterestRate !== undefined
  ) {
    out.push({
      id: 'ACCOUNT_INTEREST',
      ok: withinTolerance(
        new Decimal(f.openingBalance).times(f.guaranteedInterestRate).dividedBy(100),
        f.interestCredit,
      ),
    });
  }
  return out;
}

/**
 * Runs every plausibility check that applies to `type` and whose inputs are present. A parser
 * rejects a document if any result is `ok: false`; the server re-runs the same checks for imports.
 */
export function runChecks(
  type: ContractType,
  figures: RetirementFigures,
  dates: CheckDates,
): CheckResult[] {
  switch (familyOf(type)) {
    case 'STATUTORY':
      return statutoryChecks(figures as RetirementStatutoryFigures, dates);
    case 'PENSION':
      return pensionChecks(figures as RetirementPensionFigures);
    case 'CAPITAL_ACCOUNT':
      return capitalAccountChecks(figures as RetirementCapitalAccountFigures);
    default:
      return [];
  }
}

/** Ids of the failed checks (empty when everything is plausible). */
export function failedChecks(results: readonly CheckResult[]): RetirementCheckId[] {
  return results.filter((r) => !r.ok).map((r) => r.id);
}
