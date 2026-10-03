import type { RetirementFigures } from '@vaultfolio/api-contract';
import { failedChecks, runChecks } from './checks';

const DATES = { statementDate: '2026-05-01', payoutStart: '2056-03-01' };

const statutory = (over: Record<string, unknown> = {}): RetirementFigures =>
  ({
    dataPeriodFrom: '1990-01-01',
    dataPeriodTo: '2025-12-31',
    fullDisabilityMonthly: '1500.00',
    accruedMonthly: '1200.00',
    projectedMonthly: '2000.00',
    projectedAt1Pct: '2400.00',
    projectedAt2Pct: '2900.00',
    earningsPoints: '30.0000',
    currentPensionValue: '40.00',
    ...over,
  }) as RetirementFigures;

const resultOf = (id: string, results: { id: string; ok: boolean }[]) =>
  results.find((r) => r.id === id)?.ok;

describe('statutory checks', () => {
  it('passes for consistent figures', () => {
    const results = runChecks('STATUTORY_PENSION', statutory(), DATES);
    expect(results).toEqual([
      { id: 'STATUTORY_POINTS_VALUE', ok: true },
      { id: 'STATUTORY_ORDER', ok: true },
      { id: 'STATUTORY_DATES', ok: true },
    ]);
    expect(failedChecks(results)).toEqual([]);
  });

  it('STATUTORY_POINTS_VALUE: points × value must equal the accrued pension within a cent', () => {
    const near = statutory({ earningsPoints: '30.0002', currentPensionValue: '40.00' });
    expect(resultOf('STATUTORY_POINTS_VALUE', runChecks('STATUTORY_PENSION', near, DATES))).toBe(
      true,
    ); // 1200.008 vs 1200.00
    const misread = statutory({ accruedMonthly: '1020.00' }); // a misread digit
    expect(resultOf('STATUTORY_POINTS_VALUE', runChecks('STATUTORY_PENSION', misread, DATES))).toBe(
      false,
    );
    const lostComma = statutory({ currentPensionValue: '4000' });
    expect(
      resultOf('STATUTORY_POINTS_VALUE', runChecks('STATUTORY_PENSION', lostComma, DATES)),
    ).toBe(false);
  });

  it('STATUTORY_ORDER: accrued ≤ projected ≤ 1 % ≤ 2 %, full disability ≥ accrued', () => {
    const order = (over: Record<string, unknown>) =>
      resultOf('STATUTORY_ORDER', runChecks('STATUTORY_PENSION', statutory(over), DATES));
    expect(order({ projectedAt1Pct: '2000.00' })).toBe(true);
    expect(order({ projectedMonthly: '1100.00' })).toBe(false);
    expect(order({ projectedAt1Pct: '1999.99' })).toBe(false);
    expect(order({ projectedAt2Pct: '2300.00' })).toBe(false);
    expect(order({ fullDisabilityMonthly: '1199.99' })).toBe(false);
    expect(order({ fullDisabilityMonthly: undefined, projectedAt1Pct: undefined })).toBe(true);
  });

  it('STATUTORY_DATES: payout after the letter, data period ends before the payout', () => {
    const dates = (statementDate: string, payoutStart: string, over = {}) =>
      resultOf(
        'STATUTORY_DATES',
        runChecks('STATUTORY_PENSION', statutory(over), { statementDate, payoutStart }),
      );
    expect(dates('2026-05-01', '2056-03-01')).toBe(true);
    expect(dates('2026-05-01', '2026-05-01')).toBe(false);
    expect(dates('2026-05-01', '2056-03-01', { dataPeriodTo: '2056-03-01' })).toBe(false);
    expect(
      dates('2026-05-01', '2056-03-01', {
        dataPeriodFrom: '2026-01-01',
        dataPeriodTo: '2025-01-01',
      }),
    ).toBe(false);
  });

  it('skips checks whose inputs are missing', () => {
    const results = runChecks(
      'STATUTORY_PENSION',
      { projectedMonthly: '2000.00' } as RetirementFigures,
      { statementDate: '2026-05-01' },
    );
    expect(results).toEqual([{ id: 'STATUTORY_ORDER', ok: true }]);
  });
});

describe('private statement checks', () => {
  const pension = (over: Record<string, unknown> = {}): RetirementFigures =>
    ({
      guaranteedMonthly: '100.00',
      scenarioMonthly: { '0': '110.00', '3': '150.00', '6': '200.00', '9': '260.00' },
      contributionsMain: '9000.00',
      contributionsExtra: '1000.00',
      contributionsPaid: '10000.00',
      ...over,
    }) as RetirementFigures;

  it('passes for consistent figures', () => {
    expect(runChecks('RIESTER', pension(), DATES)).toEqual([
      { id: 'SCENARIOS_MONOTONIC', ok: true },
      { id: 'GUARANTEE_BELOW_ZERO_CASE', ok: true },
      { id: 'CONTRIBUTION_SUM', ok: true },
    ]);
  });

  it('SCENARIOS_MONOTONIC: 0 ≤ 3 ≤ 6 ≤ 9 (equal values pass)', () => {
    const scenarios = (s: Record<string, string>) =>
      resultOf('SCENARIOS_MONOTONIC', runChecks('RIESTER', pension({ scenarioMonthly: s }), DATES));
    expect(scenarios({ '0': '110.00', '3': '110.00', '6': '110.00', '9': '110.00' })).toBe(true);
    expect(scenarios({ '0': '110.00', '3': '150.00', '6': '140.00', '9': '260.00' })).toBe(false);
    expect(scenarios({ '0': '110.00', '3': '15.00', '6': '200.00', '9': '260.00' })).toBe(false);
  });

  it('GUARANTEE_BELOW_ZERO_CASE: the guarantee is at most the 0 % projection', () => {
    const guarantee = (g: string) =>
      resultOf(
        'GUARANTEE_BELOW_ZERO_CASE',
        runChecks('PRIVATE_PENSION_INSURANCE', pension({ guaranteedMonthly: g }), DATES),
      );
    expect(guarantee('110.00')).toBe(true);
    expect(guarantee('110.01')).toBe(false);
  });

  it('CONTRIBUTION_SUM: main + extra payments equal the total paid', () => {
    const sum = (over: Record<string, unknown>) =>
      resultOf('CONTRIBUTION_SUM', runChecks('RIESTER', pension(over), DATES));
    expect(sum({ contributionsPaid: '10000.01' })).toBe(true);
    expect(sum({ contributionsPaid: '10000.02' })).toBe(false);
    expect(sum({ contributionsExtra: undefined })).toBeUndefined();
  });
});

describe('capital account checks', () => {
  const account = (over: Record<string, unknown> = {}): RetirementFigures =>
    ({
      openingBalance: '10000.00',
      guaranteedInterestRate: '1.2500',
      interestCredit: '125.00',
      annualContribution: '1200.00',
      accountBalance: '11325.00',
      ...over,
    }) as RetirementFigures;

  it('passes for consistent figures', () => {
    expect(runChecks('CAPITAL_ACCOUNT', account(), DATES)).toEqual([
      { id: 'ACCOUNT_ROLL_FORWARD', ok: true },
      { id: 'ACCOUNT_INTEREST', ok: true },
    ]);
  });

  it('ACCOUNT_ROLL_FORWARD: opening + interest + contribution = closing', () => {
    const roll = (over: Record<string, unknown>) =>
      resultOf('ACCOUNT_ROLL_FORWARD', runChecks('CAPITAL_ACCOUNT', account(over), DATES));
    expect(roll({ accountBalance: '11325.01' })).toBe(true);
    expect(roll({ accountBalance: '11325.02' })).toBe(false);
    expect(roll({ accountBalance: '1325.00' })).toBe(false);
  });

  it('ACCOUNT_INTEREST: the credit is the opening balance times the rate', () => {
    const interest = (over: Record<string, unknown>) =>
      resultOf('ACCOUNT_INTEREST', runChecks('CAPITAL_ACCOUNT', account(over), DATES));
    expect(interest({ interestCredit: '125.01' })).toBe(true);
    expect(interest({ interestCredit: '125.02' })).toBe(false);
    expect(interest({ guaranteedInterestRate: '2.5000' })).toBe(false);
  });
});

describe('types without checks', () => {
  it('returns no results for an Altersvorsorgedepot', () => {
    expect(runChecks('ALTERSVORSORGEDEPOT', { currentValue: '100.00' }, DATES)).toEqual([]);
  });
});
