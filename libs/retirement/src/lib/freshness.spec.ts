import { expectedMonthlyOf, guaranteedMonthlyOf, isIncomplete, isOutdated } from './freshness';
import { buildRecord } from './testing/builders';

describe('isOutdated', () => {
  const now = new Date('2026-10-03T12:00:00Z');

  it('keeps a statement of exactly twelve months ago current and flags one day older', () => {
    expect(isOutdated('2025-10-03', now)).toBe(false);
    expect(isOutdated('2025-10-02', now)).toBe(true);
    expect(isOutdated('2026-04-01', now)).toBe(false);
  });
});

describe('expectedMonthlyOf / guaranteedMonthlyOf', () => {
  it('uses the typed expected figure first', () => {
    const r = buildRecord({ contractType: 'DIRECT_INSURANCE' });
    expect(expectedMonthlyOf(r)).toBe('280.00');
    expect(guaranteedMonthlyOf(r)).toBe('200.00');
  });

  it('derives the expected pension of an imported statement from the chosen scenario (default 3 %)', () => {
    const figures = {
      guaranteedMonthly: '100.00',
      scenarioMonthly: { '0': '110.00', '3': '150.00', '6': '200.00', '9': '260.00' },
    };
    const base = { contractType: 'RIESTER', origin: 'IMPORTED', figures } as const;
    expect(expectedMonthlyOf(buildRecord({ ...base, supplement: null }))).toBe('150.00');
    expect(expectedMonthlyOf(buildRecord({ ...base, supplement: { expectedScenario: '6' } }))).toBe(
      '200.00',
    );
    expect(
      expectedMonthlyOf(buildRecord({ ...base, supplement: { expectedMonthly: '175.00' } })),
    ).toBe('175.00');
  });

  it('reads the statutory projection and nothing for capital without a supplement', () => {
    expect(expectedMonthlyOf(buildRecord({ contractType: 'STATUTORY_PENSION' }))).toBe('2000.00');
    expect(expectedMonthlyOf(buildRecord({ contractType: 'CAPITAL_ACCOUNT' }))).toBeUndefined();
    expect(
      expectedMonthlyOf(
        buildRecord({
          contractType: 'CAPITAL_ACCOUNT',
          origin: 'IMPORTED',
          supplement: { expectedMonthly: '45.00' },
        }),
      ),
    ).toBe('45.00');
  });

  it('knows no guarantee for depots, capital accounts and the statutory pension', () => {
    for (const contractType of [
      'ALTERSVORSORGEDEPOT',
      'CAPITAL_ACCOUNT',
      'STATUTORY_PENSION',
    ] as const) {
      expect(guaranteedMonthlyOf(buildRecord({ contractType }))).toBeUndefined();
    }
  });
});

describe('isIncomplete', () => {
  it('flags a depot without an expected pension and a contract without any pension figure', () => {
    expect(
      isIncomplete(
        buildRecord({ contractType: 'ALTERSVORSORGEDEPOT', figures: { currentValue: '5000.00' } }),
      ),
    ).toBe(true);
    expect(
      isIncomplete(buildRecord({ contractType: 'RIESTER', figures: { currentValue: '1.00' } })),
    ).toBe(true);
  });

  it('accepts complete contracts, capital accounts and the statutory pension', () => {
    expect(isIncomplete(buildRecord({ contractType: 'ALTERSVORSORGEDEPOT' }))).toBe(false);
    expect(isIncomplete(buildRecord({ contractType: 'RIESTER' }))).toBe(false);
    expect(isIncomplete(buildRecord({ contractType: 'CAPITAL_ACCOUNT' }))).toBe(false);
    expect(isIncomplete(buildRecord({ contractType: 'STATUTORY_PENSION' }))).toBe(false);
  });
});
