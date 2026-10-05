import type { InsuranceContract } from '@vaultfolio/api-contract';
import { REQUIREMENTS } from '@vaultfolio/insurances';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import {
  FINANZTIP_URLS,
  buildRows,
  cancellationLabel,
  daysLeftLabel,
  groupBreakdown,
  requirementTypeId,
} from './insurances-view';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}|${JSON.stringify(params)}` : key;
const noGaps = { missing: [], covered: [], dismissed: [], redundant: [] };

describe('buildRows', () => {
  const contract = (over: Partial<InsuranceContract> = {}): InsuranceContract =>
    buildInsuranceContract(over) as InsuranceContract;

  it('derives monthly, yearly and the deadline per contract', () => {
    const [row] = buildRows({
      contracts: [
        contract({
          endDate: '2026-12-31',
          cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
        }),
      ],
      linked: [],
      gaps: noGaps,
      today: '2026-09-10',
      warnDays: 30,
      t,
    });
    expect(row).toMatchObject({
      kind: 'CONTRACT',
      monthly: '8.00',
      yearly: '96.00',
      deadline: '2026-09-30',
      daysLeft: 20,
      withinWindow: true,
      active: true,
    });
  });

  it('flags the deadline only inside the warning window', () => {
    const [row] = buildRows({
      contracts: [contract({ endDate: '2026-12-31' })],
      linked: [],
      gaps: noGaps,
      today: '2026-06-01',
      warnDays: 30,
      t,
    });
    expect(row.withinWindow).toBe(false);
  });

  it('adds read-only linked rows without deadline', () => {
    const rows = buildRows({
      contracts: [],
      linked: [{ kind: 'HEALTH', monthly: '400.00', period: '2026-09' }],
      gaps: noGaps,
      today: '2026-09-10',
      warnDays: 30,
      t,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'LINKED',
      typeId: 'STATUTORY_HEALTH',
      yearly: '4800.00',
      info: { kind: 'NONE' },
      deadline: '',
    });
  });

  it('marks overlapping contracts', () => {
    const rows = buildRows({
      contracts: [contract({ id: 'a' }), contract({ id: 'b' })],
      linked: [],
      gaps: {
        ...noGaps,
        redundant: [
          { contractId: 'a', type: 'GLASS', otherContractId: 'b', reason: 'COMBINATION' },
        ],
      },
      today: '2026-09-10',
      warnDays: 30,
      t,
    });
    expect(rows.map((r) => r.overlap)).toEqual([true, true]);
  });

  it('marks ended contracts inactive', () => {
    const [row] = buildRows({
      contracts: [contract({ status: 'CANCELLED', endDate: '2026-01-31' })],
      linked: [],
      gaps: noGaps,
      today: '2026-09-10',
      warnDays: 30,
      t,
    });
    expect(row.active).toBe(false);
  });
});

describe('labels', () => {
  it('describes every cancellation kind', () => {
    expect(
      cancellationLabel({ kind: 'DEADLINE', date: '2026-09-30', termEnd: '2026-12-31' }, t, 'en'),
    ).toContain('insurances.cancellation.deadline');
    expect(cancellationLabel({ kind: 'ENDS', date: '2026-09-30' }, t, 'en')).toContain(
      'insurances.cancellation.ends',
    );
    expect(cancellationLabel({ kind: 'ANYTIME' }, t, 'en')).toBe('insurances.cancellation.anytime');
    expect(
      cancellationLabel({ kind: 'ANYTIME', period: { value: 1, unit: 'MONTHS' } }, t, 'en'),
    ).toContain('insurances.cancellation.anytimeWith');
    expect(cancellationLabel({ kind: 'NONE' }, t, 'en')).toBe('insurances.cancellation.none');
  });

  it('labels the days left', () => {
    expect(daysLeftLabel(0, t)).toBe('insurances.cancellation.today');
    expect(daysLeftLabel(5, t)).toContain('"days":5');
  });
});

describe('groupBreakdown', () => {
  const rowsOf = (...contracts: Partial<InsuranceContract>[]) =>
    buildRows({
      contracts: contracts.map((c) => buildInsuranceContract(c) as InsuranceContract),
      linked: [],
      gaps: noGaps,
      today: '2026-09-10',
      warnDays: 30,
      t,
    });

  it('sums the yearly cost per group and lists contracts largest first', () => {
    const groups = groupBreakdown(
      rowsOf(
        { id: 'a', name: 'Haftpflicht', type: 'PRIVATE_LIABILITY', premium: '8.00' },
        { id: 'b', name: 'Kfz', type: 'CAR', premium: '40.00' },
        { id: 'c', name: 'Tier', type: 'PET_LIABILITY', premium: '4.00' },
      ),
      true,
    );
    expect(groups.map((g) => [g.group, g.yearly])).toEqual([
      ['MOBILITY', '40.00'],
      ['LIABILITY', '12.00'],
    ]);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Haftpflicht', 'Tier']);
  });

  it('ignores inactive contracts and statutory ones when social is off', () => {
    const rows = rowsOf(
      { id: 'a', status: 'CANCELLED', endDate: '2026-01-01' },
      { id: 'b', type: 'STATUTORY_HEALTH', premium: '300.00' },
    );
    expect(groupBreakdown(rows, false)).toEqual([]);
    expect(groupBreakdown(rows, true).map((g) => g.group)).toEqual(['PERSONS']);
  });
});

describe('gap-check links', () => {
  it('has a Finanztip guide and a preselected type for every requirement', () => {
    for (const requirement of REQUIREMENTS) {
      expect(FINANZTIP_URLS[requirement.id]).toMatch(/^https:\/\/www\.finanztip\.de\//);
      expect(requirement.satisfiedBy).toContain(requirementTypeId(requirement.id));
    }
    expect(requirementTypeId('LIABILITY')).toBe('PRIVATE_LIABILITY');
  });
});
