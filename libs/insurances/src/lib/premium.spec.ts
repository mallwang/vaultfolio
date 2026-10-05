import {
  isActiveIn,
  isActiveOn,
  monthlyCost,
  paymentMonths,
  paymentsPerYear,
  yearlyCost,
} from './premium';
import { buildContract } from './testing/builders';

describe('premium', () => {
  it.each([
    ['MONTHLY', '10.00', '120.00', '10.00'],
    ['QUARTERLY', '30.00', '120.00', '10.00'],
    ['HALF_YEARLY', '60.00', '120.00', '10.00'],
    ['YEARLY', '96.00', '96.00', '8.00'],
  ] as const)('normalizes %s %s', (interval, premium, yearly, monthly) => {
    const c = buildContract({ interval, premium });
    expect(yearlyCost(c).toFixed(2)).toBe(yearly);
    expect(monthlyCost(c).toFixed(2)).toBe(monthly);
  });

  it('counts payments per year', () => {
    expect([
      paymentsPerYear('MONTHLY'),
      paymentsPerYear('QUARTERLY'),
      paymentsPerYear('HALF_YEARLY'),
    ]).toEqual([12, 4, 2]);
  });

  it('keeps exact decimals for odd premiums', () => {
    expect(monthlyCost(buildContract({ premium: '100.00' })).toFixed(4)).toBe('8.3333');
  });

  it('derives payment months per interval', () => {
    expect(paymentMonths(buildContract({ interval: 'QUARTERLY', paymentMonth: 2 }))).toEqual([
      2, 5, 8, 11,
    ]);
    expect(paymentMonths(buildContract({ interval: 'HALF_YEARLY', paymentMonth: 9 }))).toEqual([
      3, 9,
    ]);
    expect(paymentMonths(buildContract({ interval: 'YEARLY', paymentMonth: 3 }))).toEqual([3]);
    expect(paymentMonths(buildContract({ interval: 'YEARLY', startDate: '2025-06-15' }))).toEqual([
      6,
    ]);
    expect(paymentMonths(buildContract({ interval: 'MONTHLY' }))).toHaveLength(12);
  });

  it('decides activity by date', () => {
    const c = buildContract({
      startDate: '2026-03-01',
      endDate: '2026-08-31',
      status: 'CANCELLED',
    });
    expect(isActiveOn(c, '2026-02-28')).toBe(false);
    expect(isActiveOn(c, '2026-06-01')).toBe(true);
    expect(isActiveOn(c, '2026-09-01')).toBe(false);
    expect(isActiveIn(c, 2026, 8)).toBe(true);
    expect(isActiveIn(c, 2026, 9)).toBe(false);
    expect(isActiveIn(c, 2026, 2)).toBe(false);
  });

  it('treats cancelled contracts without end date as inactive', () => {
    expect(isActiveOn(buildContract({ status: 'CANCELLED' }), '2026-01-01')).toBe(false);
  });
});
