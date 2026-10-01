import Decimal from 'decimal.js';
import {
  type CheckResult,
  type ParseError,
  type PayRecordInput,
  parseMoney,
  socialOf,
  taxesOf,
  TOLERANCE,
  toMoney,
  ZERO,
} from './model';

function result(code: CheckResult['code'], difference: Decimal): CheckResult {
  return {
    code,
    passed: difference.abs().lessThanOrEqualTo(TOLERANCE),
    difference: toMoney(difference),
  };
}

/**
 * Per-record checks (FR-011, research R4). NET: `gross − taxes − social = net` within one cent;
 * `difference` is the signed `net − (gross − taxes − social)`.
 */
export function runRecordChecks(r: Pick<PayRecordInput, 'amounts'>): CheckResult[] {
  const a = r.amounts;
  const computed = parseMoney(a.gross)
    .minus(parseMoney(taxesOf(a)))
    .minus(parseMoney(socialOf(a)));
  return [result('NET', parseMoney(a.net).minus(computed))];
}

/**
 * Per-payslip check: `Σ(net + other)` over the payslip's sections equals the printed payout within
 * one cent; `difference` is the signed `payout − Σ(net + other)`. Sections without any payout
 * (`payout: null` everywhere) have nothing to compare and pass.
 */
export function runPayoutCheck(sections: readonly Pick<PayRecordInput, 'amounts'>[]): CheckResult {
  const payouts = sections.map((s) => s.amounts.payout).filter((p): p is string => p !== null);
  if (payouts.length === 0) {
    return { code: 'PAYOUT', passed: true, difference: ZERO };
  }
  const payout = payouts.reduce((acc, p) => acc.plus(parseMoney(p)), new Decimal(0));
  const paid = sections.reduce(
    (acc, s) => acc.plus(parseMoney(s.amounts.net)).plus(parseMoney(s.amounts.other)),
    new Decimal(0),
  );
  return result('PAYOUT', payout.minus(paid));
}

/** Groups records into payslips: same employer and issue month. */
export function groupPayslips<T extends Pick<PayRecordInput, 'employer' | 'issued'>>(
  records: readonly T[],
): T[][] {
  const groups = new Map<string, T[]>();
  for (const r of records) {
    const key = `${r.employer}|${r.issued}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.values()];
}

export interface EvaluatedChecks {
  /** Check results per record, same order as the input; the PAYOUT result sits on the record(s) carrying a payout. */
  perRecord: CheckResult[][];
  /** First failing check as a `CHECK_FAILED` error, or `null` when every check passed. */
  failure: ParseError | null;
}

/**
 * Runs every check of a file (FR-011/FR-012): NET per record and PAYOUT per payslip. Any failure
 * rejects the whole file; the error names the check, the period and the signed difference.
 */
export function evaluateChecks(records: readonly PayRecordInput[]): EvaluatedChecks {
  const perRecord = records.map((r) => runRecordChecks(r));
  let failure: ParseError | null = null;
  const fail = (check: CheckResult, period: string) => {
    failure ??= {
      code: 'CHECK_FAILED',
      params: { check: check.code, period, difference: check.difference },
    };
  };
  records.forEach((r, i) => {
    for (const c of perRecord[i]) {
      if (!c.passed) fail(c, r.period);
    }
  });
  for (const payslip of groupPayslips(records)) {
    const check = runPayoutCheck(payslip);
    const carriers = payslip.filter((r) => r.amounts.payout !== null);
    for (const r of carriers) {
      perRecord[records.indexOf(r)].push(check);
    }
    if (!check.passed) {
      fail(check, (carriers[0] ?? payslip[0]).period);
    }
  }
  return { perRecord, failure };
}
