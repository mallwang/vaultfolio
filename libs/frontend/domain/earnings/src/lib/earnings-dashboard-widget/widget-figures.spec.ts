import type { EarningsOverview, YearlyPoint } from '@vaultfolio/api-contract';
import { widgetFigures } from './widget-figures';

function year(y: number, gross: string): YearlyPoint {
  return {
    year: y,
    monthsEmployed: 12,
    gross,
    regular: gross,
    bonus: '0.00',
    net: '0.00',
    taxes: '0.00',
    social: '0.00',
    taxRatio: '0',
    socialRatio: '0',
  };
}

function overview(
  yearly: YearlyPoint[],
  months: number,
  latestGross = '9000.00',
): EarningsOverview {
  const figures = {
    gross: latestGross,
    net: '0.00',
    taxes: '0.00',
    social: '0.00',
    bonus: '0.00',
    netRatio: '0',
  };
  return {
    hasData: true,
    career: [],
    latestYear: {
      year: yearly[yearly.length - 1].year,
      months,
      comparedMonths: [1, months],
      current: figures,
      previous: null,
    },
    yearly,
    monthly: [],
    employerChanges: [],
    dataCheckIssues: 0,
  };
}

describe('widgetFigures', () => {
  it('compares the last two complete years and marks the running year as partial', () => {
    const f = widgetFigures(
      overview([year(2024, '80000.00'), year(2025, '86400.00'), year(2026, '70000.00')], 9),
    );

    expect(f.bars.map((b) => [b.year, b.partial])).toEqual([
      [2024, false],
      [2025, false],
      [2026, true],
    ]);
    expect(f.growth?.from).toBe(2024);
    expect(f.growth?.to).toBe(2025);
    expect(f.growth?.ratio).toBeCloseTo(0.08, 5);
  });

  it('does not let a January with one month look like a drop', () => {
    const f = widgetFigures(
      overview(
        [year(2025, '86400.00'), year(2026, '93600.00'), year(2027, '7900.00')],
        1,
        '7900.00',
      ),
    );
    expect(f.growth?.to).toBe(2026);
    expect(f.perMonth).toBe('7900.00');
  });

  it('treats a latest year with twelve months as complete', () => {
    const f = widgetFigures(overview([year(2025, '80000.00'), year(2026, '88000.00')], 12));
    expect(f.bars[1].partial).toBe(false);
    expect(f.growth?.to).toBe(2026);
  });

  it('keeps only the latest ten years and has no growth with a single complete year', () => {
    const many = Array.from({ length: 12 }, (_, i) => year(2015 + i, '50000.00'));
    expect(widgetFigures(overview(many, 12)).bars).toHaveLength(10);
    expect(widgetFigures(overview([year(2026, '5000.00')], 3)).growth).toBeNull();
  });

  it('averages the latest year over its months', () => {
    expect(widgetFigures(overview([year(2026, '45000.00')], 9, '45000.00')).perMonth).toBe(
      '5000.00',
    );
  });
});
