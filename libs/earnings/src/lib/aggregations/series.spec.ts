import { RECORDS } from '../testing/aggregation.fixtures';
import { employerChanges, monthlySeries, yearlySeries } from './series';

describe('monthlySeries', () => {
  const monthly = monthlySeries(RECORDS);

  it('has one point per period with data, ascending', () => {
    expect(monthly).toHaveLength(3 + 12 + 9);
    expect(monthly[0].period).toBe('2024-10');
    expect(monthly[monthly.length - 1].period).toBe('2026-09');
  });

  it('adds corrections to the month they belong to', () => {
    expect(monthly.find((m) => m.period === '2026-07')).toEqual({
      period: '2026-07',
      employerId: 'emp-b',
      gross: '4900.00',
      regular: '4900.00',
      bonus: '0.00',
      net: '3125.40',
      taxes: '775.00',
      social: '999.60',
      payout: '3180.00',
      hasCorrection: true,
    });
  });

  it('splits regular and bonus pay', () => {
    expect(monthly.find((m) => m.period === '2024-12')).toMatchObject({
      gross: '5000.00',
      regular: '4000.00',
      bonus: '1000.00',
      taxes: '900.00',
      net: '3284.00',
    });
  });

  it('keeps payout-only months with their payout', () => {
    expect(monthly.find((m) => m.period === '2025-03')).toEqual({
      period: '2025-03',
      employerId: 'emp-b',
      gross: '0.00',
      regular: '0.00',
      bonus: '0.00',
      net: '0.00',
      taxes: '0.00',
      social: '0.00',
      payout: '150.00',
      hasCorrection: false,
    });
  });

  it('marks employer changes', () => {
    expect(employerChanges(monthly)).toEqual(['2025-01']);
  });
});

describe('yearlySeries', () => {
  it('sums calendar years; months employed exclude payout-only months', () => {
    expect(yearlySeries(RECORDS)).toEqual([
      {
        year: 2024,
        monthsEmployed: 3,
        gross: '13000.00',
        regular: '12000.00',
        bonus: '1000.00',
        net: '8452.00',
        taxes: '2100.00',
        social: '2448.00',
        taxRatio: '0.1615',
        socialRatio: '0.1883',
      },
      {
        year: 2025,
        monthsEmployed: 11,
        gross: '55000.00',
        regular: '55000.00',
        bonus: '0.00',
        net: '34980.00',
        taxes: '8800.00',
        social: '11220.00',
        taxRatio: '0.1600',
        socialRatio: '0.2040',
      },
      {
        year: 2026,
        monthsEmployed: 9,
        gross: '44900.00',
        regular: '44900.00',
        bonus: '0.00',
        net: '28565.40',
        taxes: '7175.00',
        social: '9159.60',
        taxRatio: '0.1598',
        socialRatio: '0.2040',
      },
    ]);
  });
});
