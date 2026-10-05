import { nextCancellationDate } from './deadline';
import { buildContract } from './testing/builders';

const months3 = { value: 3, unit: 'MONTHS' as const };

describe('nextCancellationDate', () => {
  it('derives 30 Sep for a 3-month period and term end 31 Dec', () => {
    const c = buildContract({
      endDate: '2025-12-31',
      cancellation: { autoRenew: true, period: months3 },
    });
    expect(nextCancellationDate(c, '2025-06-01')).toEqual({
      kind: 'DEADLINE',
      date: '2025-09-30',
      termEnd: '2025-12-31',
    });
  });

  it('moves to the next term after the deadline passed', () => {
    const c = buildContract({
      endDate: '2025-12-31',
      cancellation: { autoRenew: true, period: months3 },
    });
    expect(nextCancellationDate(c, '2025-10-01')).toEqual({
      kind: 'DEADLINE',
      date: '2026-09-30',
      termEnd: '2026-12-31',
    });
  });

  it('includes the deadline day itself', () => {
    const c = buildContract({
      endDate: '2025-12-31',
      cancellation: { autoRenew: true, period: months3 },
    });
    expect(nextCancellationDate(c, '2025-09-30')).toMatchObject({ date: '2025-09-30' });
  });

  it('derives the first term from start and default 12 months', () => {
    const c = buildContract({
      startDate: '2025-03-15',
      cancellation: { autoRenew: true, period: months3 },
    });
    expect(nextCancellationDate(c, '2025-04-01')).toEqual({
      kind: 'DEADLINE',
      date: '2025-12-14',
      termEnd: '2026-03-14',
    });
  });

  it('clamps month ends', () => {
    const c = buildContract({
      endDate: '2025-05-31',
      cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
    });
    expect(nextCancellationDate(c, '2025-01-01')).toMatchObject({ date: '2025-02-28' });
  });

  it('handles leap years', () => {
    const c = buildContract({
      endDate: '2024-05-31',
      cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
    });
    expect(nextCancellationDate(c, '2024-01-01')).toMatchObject({ date: '2024-02-29' });
  });

  it('subtracts weeks as 7 days', () => {
    const c = buildContract({
      endDate: '2025-12-31',
      cancellation: { autoRenew: true, period: { value: 4, unit: 'WEEKS' } },
    });
    expect(nextCancellationDate(c, '2025-01-01')).toMatchObject({ date: '2025-12-03' });
  });

  it('uses a fixed cancellation date such as 30 Nov', () => {
    const c = buildContract({
      type: 'CAR',
      endDate: '2025-12-31',
      cancellation: { autoRenew: true, fixedDate: { day: 30, month: 11 } },
    });
    expect(nextCancellationDate(c, '2025-05-01')).toEqual({
      kind: 'DEADLINE',
      date: '2025-11-30',
      termEnd: '2025-12-31',
    });
    expect(nextCancellationDate(c, '2025-12-01')).toMatchObject({ date: '2026-11-30' });
  });

  it('clamps a fixed 29 Feb in non-leap years', () => {
    const c = buildContract({
      endDate: '2025-03-31',
      cancellation: { autoRenew: true, fixedDate: { day: 29, month: 2 } },
    });
    expect(nextCancellationDate(c, '2025-01-01')).toMatchObject({ date: '2025-02-28' });
  });

  it('honours renewal months', () => {
    const c = buildContract({
      startDate: '2025-01-01',
      cancellation: { autoRenew: true, period: months3, minimumTermMonths: 24, renewalMonths: 6 },
    });
    expect(nextCancellationDate(c, '2026-10-01')).toMatchObject({
      termEnd: '2027-06-30',
      date: '2027-03-30',
    });
  });

  it('shows ENDS without auto-renewal and with end date', () => {
    const c = buildContract({ endDate: '2026-06-30', cancellation: { autoRenew: false } });
    expect(nextCancellationDate(c, '2026-01-01')).toEqual({ kind: 'ENDS', date: '2026-06-30' });
  });

  it('has no deadline once an ending contract ended', () => {
    const c = buildContract({ endDate: '2026-06-30', cancellation: { autoRenew: false } });
    expect(nextCancellationDate(c, '2026-07-01')).toEqual({ kind: 'NONE' });
  });

  it('is ANYTIME when open-ended', () => {
    const c = buildContract({
      cancellation: { autoRenew: false, period: { value: 1, unit: 'MONTHS' } },
    });
    expect(nextCancellationDate(c, '2026-01-01')).toEqual({
      kind: 'ANYTIME',
      period: { value: 1, unit: 'MONTHS' },
    });
  });

  it('uses a single minimum term without auto-renewal', () => {
    const c = buildContract({
      startDate: '2025-01-01',
      cancellation: { autoRenew: false, minimumTermMonths: 24, period: months3 },
    });
    expect(nextCancellationDate(c, '2025-06-01')).toMatchObject({
      date: '2026-09-30',
      termEnd: '2026-12-31',
    });
    expect(nextCancellationDate(c, '2026-10-01').kind).toBe('ANYTIME');
  });

  it('has no deadline for inactive contracts', () => {
    expect(nextCancellationDate(buildContract({ status: 'CANCELLED' }), '2026-01-01')).toEqual({
      kind: 'NONE',
    });
  });
});
