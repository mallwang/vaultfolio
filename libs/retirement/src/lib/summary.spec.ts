import { buildRecord } from './testing/builders';
import { summarize } from './summary';

const NOW = new Date('2026-06-15T12:00:00Z');

/** Mockup dataset: guaranteed 403, expected 2 860, savings 335. */
const mockup = () => [
  buildRecord({
    id: 'sv',
    contractType: 'STATUTORY_PENSION',
    figures: { projectedMonthly: '2200.00' },
    payoutStart: '2056-03-01',
  }),
  buildRecord({
    id: 'di',
    contractType: 'DIRECT_INSURANCE',
    figures: {
      guaranteedMonthly: '203.00',
      expectedMonthly: '280.00',
      contributionMonthly: '100.00',
      employerContributionMonthly: '60.00',
    },
  }),
  buildRecord({
    id: 'ri',
    contractType: 'RIESTER',
    figures: {
      guaranteedMonthly: '100.00',
      expectedMonthly: '150.00',
      contributionMonthly: '60.00',
    },
  }),
  buildRecord({
    id: 'pp',
    contractType: 'PRIVATE_PENSION_INSURANCE',
    figures: {
      guaranteedMonthly: '100.00',
      expectedMonthly: '230.00',
      contributionMonthly: '115.00',
    },
  }),
];

describe('summarize', () => {
  it('reproduces the mockup totals exactly', () => {
    const s = summarize(mockup(), NOW);
    expect(s.guaranteedMonthly).toBe('403.00');
    expect(s.expectedMonthly).toBe('2860.00');
    expect(s.differenceMonthly).toBe('2457.00');
    expect(s.monthlySavings).toBe('335.00');
    expect(s.pillars.statutory.count).toBe(1);
    expect(s.pillars.occupational.guaranteedMonthly).toBe('203.00');
    expect(s.pillars.private.expectedMonthly).toBe('380.00');
  });

  it('returns zeros and no pension start for no records', () => {
    const s = summarize([], NOW);
    expect(s.expectedMonthly).toBe('0.00');
    expect(s.pensionStart).toBeNull();
    expect(s.pillars.private).toEqual({
      count: 0,
      guaranteedMonthly: '0.00',
      expectedMonthly: '0.00',
      items: [],
    });
  });

  it('counts a contract without expected figure at its guarantee', () => {
    const s = summarize(
      [buildRecord({ contractType: 'DIREKTZUSAGE', figures: { guaranteedMonthly: '120.00' } })],
      NOW,
    );
    expect(s.expectedMonthly).toBe('120.00');
  });

  it('uses the supplemented scenario/figures of imported records', () => {
    const s = summarize(
      [
        buildRecord({
          origin: 'IMPORTED',
          figures: {
            guaranteedMonthly: '100.00',
            scenarioMonthly: { '3': '150.00', '6': '200.00' },
          },
          supplement: { expectedScenario: '6', contributionMonthly: '42.50' },
        }),
      ],
      NOW,
    );
    expect(s.expectedMonthly).toBe('200.00');
    expect(s.monthlySavings).toBe('42.50');
  });

  it('only counts savings of ACTIVE contracts', () => {
    const s = summarize(
      [
        buildRecord({ status: 'PAID_UP', figures: { contributionMonthly: '60.00' } }),
        buildRecord({ id: 'b', status: 'IN_PAYOUT', figures: { contributionMonthly: '60.00' } }),
      ],
      NOW,
    );
    expect(s.monthlySavings).toBe('0.00');
  });

  it('keeps capital separate from monthly sums', () => {
    const s = summarize([buildRecord({ contractType: 'CAPITAL_ACCOUNT' })], NOW);
    expect(s.capital.total).toBe('11325.00');
    expect(s.capital.items).toHaveLength(1);
    expect(s.expectedMonthly).toBe('0.00');
    expect(s.guaranteedMonthly).toBe('0.00');
  });

  describe('pension start', () => {
    it('takes the statutory retirement date and flags earlier/same/later contracts', () => {
      const s = summarize(
        [
          buildRecord({ id: 'sv', contractType: 'STATUTORY_PENSION', payoutStart: '2056-03-01' }),
          buildRecord({ id: 'e', payoutStart: '2055-01-01' }),
          buildRecord({ id: 's', payoutStart: '2056-03-01' }),
          buildRecord({ id: 'l', payoutStart: '2057-01-01' }),
        ],
        NOW,
      );
      expect(s.pensionStart).toEqual({ date: '2056-03-01', source: 'STATUTORY' });
      const rel = Object.fromEntries(s.items.map((i) => [i.id, i.startRelation]));
      expect(rel).toEqual({ sv: null, e: 'EARLIER', s: 'SAME', l: 'LATER' });
    });

    it('falls back to the earliest contract start without a statutory record', () => {
      const s = summarize(
        [
          buildRecord({ id: 'a', payoutStart: '2052-01-01' }),
          buildRecord({ id: 'b', payoutStart: '2050-01-01' }),
        ],
        NOW,
      );
      expect(s.pensionStart).toEqual({ date: '2050-01-01', source: 'EARLIEST_CONTRACT' });
      expect(s.items.every((i) => i.startRelation === null)).toBe(true);
    });
  });

  it('flags outdated statements at the 12-month boundary', () => {
    const s = summarize(
      [
        buildRecord({ id: 'ok', statementDate: '2025-06-15' }),
        buildRecord({ id: 'old', statementDate: '2025-06-14' }),
      ],
      NOW,
    );
    expect(s.items.map((i) => i.outdated)).toEqual([false, true]);
    expect(s.flags.outdatedCount).toBe(1);
  });

  it('flags incomplete records', () => {
    const s = summarize([buildRecord({ figures: { currentValue: '1000.00' } })], NOW);
    expect(s.items[0].incomplete).toBe(true);
    expect(s.flags.incompleteCount).toBe(1);
  });

  describe('Altersvorsorgedepot', () => {
    it('contributes to savings and expected pension but never to guaranteed', () => {
      const s = summarize(
        [
          buildRecord({
            contractType: 'ALTERSVORSORGEDEPOT',
            figures: {
              currentValue: '5000.00',
              expectedMonthly: '40.00',
              contributionMonthly: '50.00',
            },
          }),
        ],
        NOW,
      );
      expect(s.guaranteedMonthly).toBe('0.00');
      expect(s.expectedMonthly).toBe('40.00');
      expect(s.monthlySavings).toBe('50.00');
      expect(s.pillars.private.count).toBe(1);
      expect(s.capital.total).toBe('5000.00');
    });

    it('is incomplete with only a current value and no expected pension', () => {
      const s = summarize(
        [
          buildRecord({
            contractType: 'ALTERSVORSORGEDEPOT',
            figures: { currentValue: '1000.00' },
          }),
        ],
        NOW,
      );
      expect(s.items[0].incomplete).toBe(true);
      expect(s.expectedMonthly).toBe('0.00');
    });
  });
});
