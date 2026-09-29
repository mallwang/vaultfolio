import type { EChartsOption } from 'echarts';
import type { MonthlyPoint, YearlyPoint } from '@vaultfolio/api-contract';
import {
  type ChartFormat,
  type ChartLabels,
  grossPerYearOption,
  monthlyOption,
  monthlyTotals,
  ratiosOption,
} from './earnings-charts';

const COLORS = {
  net: '#2563eb',
  taxes: '#ea580c',
  social: '#0d9488',
  regular: '#6366f1',
  bonus: '#dc2626',
};
const LABELS: ChartLabels = {
  regular: 'Regular pay',
  bonus: 'Bonus',
  net: 'Net',
  taxes: 'Taxes',
  social: 'Social insurance',
  bonusMonth: 'Bonus month',
  employerChange: 'Employer change',
};
const FORMAT: ChartFormat = {
  money: (v) => `€${v.toFixed(2)}`,
  moneyWhole: (v) => `€${Math.round(v)}`,
  percent: (v) => `${(v * 100).toFixed(1)} %`,
  month: (p) => p,
};

function year(y: number, partial: Partial<YearlyPoint> = {}): YearlyPoint {
  return {
    year: y,
    monthsEmployed: 12,
    gross: '60000.00',
    regular: '57000.00',
    bonus: '3000.00',
    net: '36000.00',
    taxes: '12000.00',
    social: '12000.00',
    taxRatio: '0.2000',
    socialRatio: '0.2000',
    ...partial,
  };
}

function month(period: string, partial: Partial<MonthlyPoint> = {}): MonthlyPoint {
  return {
    period,
    employerId: 'e1',
    gross: '5000.00',
    regular: '5000.00',
    bonus: '0.00',
    net: '3100.00',
    taxes: '900.00',
    social: '1000.00',
    payout: '3060.00',
    hasCorrection: false,
    ...partial,
  };
}

/** Loose view of an ECharts series for assertions. */
interface AnySeries {
  name: string;
  stack?: string;
  data: { value: number; itemStyle: { color: string; borderWidth: number } }[];
  label: { formatter(p: { dataIndex: number }): string };
  endLabel: { formatter(p: { value: number }): string };
  lineStyle: { color: string };
  markLine: { data: unknown[] };
  [key: string]: unknown;
}

/** Calls the monthly tooltip formatter the way ECharts' axis trigger does for category `index`. */
function tooltipAt(option: EChartsOption, series: AnySeries[], index: number): string {
  const { formatter } = option.tooltip as { formatter: (params: unknown) => string };
  return formatter(
    series.map((s) => {
      const item = s.data[index] as { value?: unknown } | number | null;
      return {
        seriesType: s['type'],
        seriesName: s.name,
        marker: '',
        dataIndex: index,
        value: item !== null && typeof item === 'object' ? item.value : (item ?? undefined),
        axisValueLabel: (option.xAxis as { data: string[] }).data[index],
      };
    }),
  );
}

describe('grossPerYearOption', () => {
  it('stacks regular pay and bonus per year in the earnings palette', () => {
    const option = grossPerYearOption(
      [year(2025), year(2026, { monthsEmployed: 9, regular: '45000.00', bonus: '0.00' })],
      'total',
      COLORS,
      LABELS,
      FORMAT,
    );
    const series = option.series as AnySeries[];

    expect((option.xAxis as { data: string[] }).data).toEqual(['2025', '2026']);
    expect(series[0]).toMatchObject({
      name: 'Regular pay',
      stack: 'gross',
      data: [57000, 45000],
      itemStyle: { color: '#6366f1' },
    });
    expect(series[1]).toMatchObject({
      name: 'Bonus',
      stack: 'gross',
      data: [3000, 0],
      itemStyle: { color: '#dc2626' },
    });
    expect(series[1].label.formatter({ dataIndex: 0 })).toBe('€60000');
  });

  it('divides by the months employed in "per month employed" mode', () => {
    const option = grossPerYearOption(
      [year(2026, { monthsEmployed: 9, regular: '45000.00', bonus: '900.00' })],
      'perMonth',
      COLORS,
      LABELS,
      FORMAT,
    );
    const series = option.series as AnySeries[];

    expect(series[0].data).toEqual([5000]);
    expect(series[1].data).toEqual([100]);
  });
});

describe('monthlyTotals', () => {
  it('sums two employers in one month exactly', () => {
    const totals = monthlyTotals([
      month('2026-02'),
      month('2026-01'),
      month('2026-02', { employerId: 'e2', net: '0.10', bonus: '1.00', hasCorrection: true }),
    ]);

    expect(totals.map((t) => t.period)).toEqual(['2026-01', '2026-02']);
    expect(totals[1]).toMatchObject({
      net: '3100.10',
      bonus: '1.00',
      gross: '10000.00',
      hasCorrection: true,
    });
  });
});

describe('monthlyOption', () => {
  const months = Array.from({ length: 40 }, (_, i) => {
    const y = 2023 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, '0');
    return month(`${y}-${m}`, m === '12' ? { bonus: '3000.00', gross: '8000.00' } : {});
  });

  it('shows the last 36 months by default range 3Y and everything with All', () => {
    expect(monthlyOption(months, '3y', null, [], COLORS, LABELS, FORMAT).periods).toHaveLength(36);
    expect(monthlyOption(months, '1y', null, [], COLORS, LABELS, FORMAT).periods[0]).toBe(
      '2025-05',
    );
    expect(monthlyOption(months, 'all', null, [], COLORS, LABELS, FORMAT).periods).toHaveLength(40);
  });

  it('counts the range in calendar months, so older data behind a gap stays out', () => {
    const gapped = [month('2013-11'), month('2013-12'), month('2026-08'), month('2026-09')];
    expect(monthlyOption(gapped, '3y', null, [], COLORS, LABELS, FORMAT).periods).toEqual([
      '2026-08',
      '2026-09',
    ]);
    expect(monthlyOption(gapped, '1y', null, [], COLORS, LABELS, FORMAT).periods).toEqual([
      '2026-08',
      '2026-09',
    ]);
    // 2013-11 … 2026-09: every calendar month in between gets a slot
    expect(monthlyOption(gapped, 'all', null, [], COLORS, LABELS, FORMAT).periods).toHaveLength(
      155,
    );
    // 36 months back from 2026-09 starts at 2023-10
    const edge = [month('2023-09'), month('2023-10'), month('2026-09')];
    const edgePeriods = monthlyOption(edge, '3y', null, [], COLORS, LABELS, FORMAT).periods;
    expect(edgePeriods).toHaveLength(36);
    expect([edgePeriods[0], edgePeriods[35]]).toEqual(['2023-10', '2026-09']);
  });

  it('leaves a gap for a month without data', () => {
    const gapped = [month('2025-12', { bonus: '3000.00' }), month('2026-01'), month('2026-03')];
    const { option, periods } = monthlyOption(gapped, 'all', null, [], COLORS, LABELS, FORMAT);
    const series = option.series as AnySeries[];

    expect(periods).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
    for (const s of series.slice(0, 3)) {
      expect(s.data[2]).toBeNull();
      expect(s.data[3]).not.toBeNull();
    }
    expect(series[3].data[2]).toBeNull();
    // the axis tooltip shows '–' in a month without data
    const tooltip = tooltipAt(option, series, 2);
    expect(tooltip).toContain('2026-02');
    expect(tooltip.match(/–/g)).toHaveLength(3);
    expect(tooltip).not.toContain('Bonus month');
  });

  it('lists the bonus row with its amount only in bonus months', () => {
    const months = [month('2025-12', { bonus: '3000.00' }), month('2026-01')];
    const { option } = monthlyOption(months, 'all', null, [], COLORS, LABELS, FORMAT);
    const series = option.series as AnySeries[];

    const december = tooltipAt(option, series, 0);
    expect(december).toContain('Net');
    expect(december).toContain('€3100.00');
    expect(december).toContain('Bonus month');
    expect(december).toContain('€3000.00');
    expect(tooltipAt(option, series, 1)).not.toContain('Bonus month');
  });

  it('stacks net + taxes + social, marks bonus months, employer changes and the selected month', () => {
    const { option, periods } = monthlyOption(
      months,
      '1y',
      '2025-12',
      ['2025-06', '2020-01'],
      COLORS,
      LABELS,
      FORMAT,
    );
    const series = option.series as AnySeries[];
    const selected = periods.indexOf('2025-12');

    expect(series.slice(0, 3).map((s) => [s.name, s.stack, s.data[0].value])).toEqual([
      ['Net', 'month', 3100],
      ['Taxes', 'month', 900],
      ['Social insurance', 'month', 1000],
    ]);
    expect(series[0].data[0].itemStyle.color).toBe('#2563eb');
    expect((series[0] as unknown as { itemStyle: { color: string } }).itemStyle.color).toBe(
      '#2563eb',
    );
    expect(series[0].data[selected].itemStyle.borderWidth).toBe(2);
    expect(series[0].data[0].itemStyle.borderWidth).toBe(1);
    expect(series[0].markLine.data).toEqual([{ xAxis: '2025-06' }]);
    expect(series[3].data[selected]).not.toBeNull();
    expect(series[3].data[0]).toBeNull();
  });
});

describe('ratiosOption', () => {
  it('draws taxes % and social % per year with a labeled last value', () => {
    const option = ratiosOption(
      [year(2025), year(2026, { taxRatio: '0.2150' })],
      COLORS,
      LABELS,
      FORMAT,
    );
    const series = option.series as AnySeries[];

    expect(series[0]).toMatchObject({ name: 'Taxes', type: 'line', data: [0.2, 0.215] });
    expect(series[0].endLabel.formatter({ value: 0.215 })).toBe('21.5 %');
    expect(series[1].lineStyle.color).toBe('#0d9488');
  });
});
