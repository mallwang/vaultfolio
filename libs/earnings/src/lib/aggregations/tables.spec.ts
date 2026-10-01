import { EMPLOYERS, RECORDS } from '../testing/aggregation.fixtures';
import { storedRecord } from '../testing/builders';
import { missingRegularPeriods, monthGrid, taxesPerYear } from './tables';

describe('monthGrid', () => {
  const grid = monthGrid(RECORDS);

  it('lists years, bonus months and missing months inside an employment year', () => {
    expect(grid.years).toEqual([2024, 2025, 2026]);
    expect(grid.bonusPeriods).toEqual(['2024-12']);
    expect(grid.missingPeriods).toEqual(['2025-03']);
  });

  it('holds every metric per period', () => {
    expect(Object.keys(grid.metrics)).toEqual([
      'gross',
      'regular',
      'bonus',
      'net',
      'taxes',
      'social',
      'payout',
    ]);
    expect(grid.metrics.gross['2026-07']).toBe('4900.00');
    expect(grid.metrics.regular['2024-12']).toBe('4000.00');
    expect(grid.metrics.bonus['2024-12']).toBe('1000.00');
    expect(grid.metrics.net['2026-07']).toBe('3125.40');
    expect(grid.metrics.taxes['2026-07']).toBe('775.00');
    expect(grid.metrics.social['2026-07']).toBe('999.60');
    expect(grid.metrics.payout['2025-03']).toBe('150.00');
    expect(grid.metrics.gross['2025-02']).toBe('5000.00');
    expect(Object.keys(grid.metrics.gross)).toHaveLength(24);
  });
});

describe('missingRegularPeriods', () => {
  it('reports a month that only has a correction', () => {
    const records = [
      storedRecord({ period: '2026-08', issued: '2026-08' }),
      storedRecord({ period: '2026-09', issued: '2026-09' }),
      storedRecord({ period: '2026-06', issued: '2026-09', kind: 'CORRECTION', seq: 4 }),
    ];
    expect(missingRegularPeriods(records)).toEqual(['2026-06']);
  });

  it('uses only the months between the first and last regular month (mid-year join)', () => {
    const records = ['2026-05', '2026-06', '2026-08'].map((p) =>
      storedRecord({ period: p, issued: p }),
    );
    expect(missingRegularPeriods(records)).toEqual(['2026-07']);
  });
});

describe('taxesPerYear', () => {
  it('sums every tax and contribution per year and employer', () => {
    expect(taxesPerYear(RECORDS, EMPLOYERS)).toEqual([
      {
        year: 2024,
        employerId: 'emp-a',
        employerLabel: 'Northwind Instruments AG',
        monthsEmployed: 3,
        gross: '13000.00',
        bonus: '1000.00',
        taxGross: '13000.00',
        wageTax: '2100.00',
        soli: '0.00',
        churchTax: '0.00',
        health: '960.00',
        care: '216.00',
        pension: '1116.00',
        unemployment: '156.00',
        taxRatio: '0.1615',
        socialRatio: '0.1883',
      },
      {
        year: 2025,
        employerId: 'emp-b',
        employerLabel: 'Brightline Software GmbH',
        monthsEmployed: 11,
        gross: '55000.00',
        bonus: '0.00',
        taxGross: '55000.00',
        wageTax: '8800.00',
        soli: '0.00',
        churchTax: '0.00',
        health: '4400.00',
        care: '990.00',
        pension: '5115.00',
        unemployment: '715.00',
        taxRatio: '0.1600',
        socialRatio: '0.2040',
      },
      {
        year: 2026,
        employerId: 'emp-b',
        employerLabel: 'Brightline Software GmbH',
        monthsEmployed: 9,
        gross: '44900.00',
        bonus: '0.00',
        taxGross: '44900.00',
        wageTax: '7175.00',
        soli: '0.00',
        churchTax: '0.00',
        health: '3592.00',
        care: '808.20',
        pension: '4175.70',
        unemployment: '583.70',
        taxRatio: '0.1598',
        socialRatio: '0.2040',
      },
    ]);
  });
});
