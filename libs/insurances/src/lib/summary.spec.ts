import { summarize } from './summary';
import { buildInsuranceContract as build } from './testing/builders';

const base = {
  linkedSocial: [],
  includeSocial: true,
  year: 2026,
  today: '2026-03-01',
  warnDays: 30,
};

describe('summarize', () => {
  it('returns zeros for no contracts', () => {
    const s = summarize({ ...base, contracts: [] });
    expect(s.monthlyPrivate).toBe('0.00');
    expect(s.activeCount).toBe(0);
    expect(s.byGroup).toEqual([]);
    expect(s.timeline.every((t) => t.amount === '0.00')).toBe(true);
  });

  it('normalizes monthly, quarterly and yearly premiums', () => {
    const s = summarize({
      ...base,
      contracts: [
        build({ id: 'a', interval: 'MONTHLY', premium: '10.00' }),
        build({
          id: 'b',
          interval: 'QUARTERLY',
          premium: '30.00',
          paymentMonth: 1,
          type: 'HOUSEHOLD',
        }),
        build({ id: 'c', interval: 'YEARLY', premium: '96.00', paymentMonth: 3, type: 'CAR' }),
      ],
    });
    expect(s.monthlyPrivate).toBe('28.00');
    expect(s.yearlyPrivate).toBe('336.00');
    expect(s.monthlyTotal).toBe('28.00');
    expect(s.activeCount).toBe(3);
  });

  it('places yearly premiums in their payment month', () => {
    const s = summarize({
      ...base,
      contracts: [build({ interval: 'YEARLY', premium: '96.00', paymentMonth: 3 })],
    });
    expect(s.timeline[2].amount).toBe('96.00');
    expect(s.timeline[0].amount).toBe('0.00');
  });

  it('splits yearly cost by group with shares', () => {
    const s = summarize({
      ...base,
      contracts: [
        build({ id: 'a', premium: '100.00' }),
        build({ id: 'b', premium: '300.00', type: 'CAR' }),
      ],
    });
    expect(s.byGroup).toEqual([
      { group: 'MOBILITY', yearly: '300.00', share: 75 },
      { group: 'LIABILITY', yearly: '100.00', share: 25 },
    ]);
  });

  it('excludes future and ended contracts', () => {
    const s = summarize({
      ...base,
      contracts: [
        build({ id: 'f', startDate: '2026-06-01' }),
        build({ id: 'e', status: 'CANCELLED', endDate: '2026-02-01' }),
      ],
    });
    expect(s.activeCount).toBe(0);
  });

  it('keeps statutory costs separate and honours includeSocial', () => {
    const contracts = [
      build({ id: 'h', type: 'STATUTORY_HEALTH', interval: 'MONTHLY', premium: '300.00' }),
    ];
    const linked = [{ kind: 'PENSION' as const, monthly: '200.00', period: '2026-02' }];
    const on = summarize({ ...base, contracts, linkedSocial: linked });
    expect(on.monthlyStatutory).toBe('500.00');
    expect(on.monthlyTotal).toBe('500.00');
    expect(on.yearlyTotal).toBe('6000.00');
    expect(on.statutoryCount).toBe(2);
    expect(on.monthlyPrivate).toBe('0.00');
    const off = summarize({ ...base, contracts, linkedSocial: linked, includeSocial: false });
    expect(off.monthlyStatutory).toBe('0.00');
  });

  it('does not count a linked line twice when a manual contract exists', () => {
    const s = summarize({
      ...base,
      contracts: [build({ type: 'STATUTORY_HEALTH', interval: 'MONTHLY', premium: '300.00' })],
      linkedSocial: [{ kind: 'HEALTH', monthly: '250.00', period: '2026-02' }],
    });
    expect(s.monthlyStatutory).toBe('300.00');
  });

  it('lists upcoming deadlines with window flag', () => {
    const s = summarize({
      ...base,
      contracts: [
        build({
          id: 'near',
          name: 'Near',
          endDate: '2026-05-31',
          cancellation: { autoRenew: true, period: { value: 2, unit: 'MONTHS' } },
        }),
        build({
          id: 'far',
          name: 'Far',
          endDate: '2026-12-31',
          cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
        }),
      ],
    });
    expect(s.upcoming.map((u) => [u.id, u.date, u.daysLeft, u.withinWindow])).toEqual([
      ['near', '2026-03-31', 30, true],
      ['far', '2026-09-30', 213, false],
    ]);
  });
});
