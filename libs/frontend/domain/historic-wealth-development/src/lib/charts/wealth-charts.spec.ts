import type { WealthEntry } from '@vaultfolio/wealth';
import {
  type WealthChartFormat,
  chartSummary,
  classLabels,
  wealthChartColors,
  wealthChartOption,
} from './wealth-charts';

const format: WealthChartFormat = {
  money: (v) => `€${v.toFixed(2)}`,
  moneyWhole: (v) => `€${v}`,
  percentWhole: (r) => `${Math.round(r * 100)}%`,
  date: (iso) => iso,
};
const entry = (over: Partial<WealthEntry>): WealthEntry => ({
  side: 'ASSET',
  class: { standard: 'cash' },
  name: 'x',
  amount: '1.00',
  ...over,
});
const snapshots = [
  {
    snapshotDate: '2025-02-01',
    entries: [
      entry({ amount: '10.00' }),
      entry({ class: { standard: 'crypto' }, amount: '5.00' }),
      entry({ side: 'LIABILITY', class: { standard: 'mortgage' }, amount: '4.00' }),
    ],
  },
  { snapshotDate: '2025-01-01', entries: [entry({ amount: '1.00' })] },
];
const labelOf = classLabels(snapshots, (id) => `T:${id}`);
const labels = { net: 'Net', liabilities: 'Liab' };

type Series = {
  name: string;
  type: string;
  stack?: string;
  data: number[];
  itemStyle: Record<string, unknown>;
};
const build = (snaps = snapshots) =>
  wealthChartOption(snaps, labelOf, labels, format, wealthChartColors('light')) as unknown as {
    series: Series[];
    legend: { data: string[] };
    xAxis: { data: string[] };
  };

describe('wealthChartOption', () => {
  it('stacks one series per asset class, zero-filled and chronological', () => {
    const { series, xAxis } = build();
    expect(xAxis.data).toEqual(['2025-01-01', '2025-02-01']);
    const assets = series.filter((s) => s.stack === 'assets');
    expect(assets.map((s) => s.name)).toEqual(['T:cash', 'T:crypto']);
    expect(assets[0].data).toEqual([1, 10]);
    expect(assets[1].data).toEqual([0, 5]);
  });

  it('hangs liabilities below zero in their own hatched color', () => {
    const { series } = build();
    const liabilities = series.find((s) => s.stack === 'liabilities');
    expect(liabilities?.data).toEqual([-0, -4]);
    expect(liabilities?.itemStyle['color']).toBe(wealthChartColors('light').liabilities);
    expect(liabilities?.itemStyle['decal']).toBeDefined();
    expect(wealthChartColors('dark').liabilities).not.toBe(wealthChartColors('light').liabilities);
  });

  it('draws the net worth as a line with markers', () => {
    const net = build().series.find((s) => s.type === 'line');
    expect(net?.name).toBe('Net');
    expect(net?.data).toEqual([1, 11]);
  });

  it('adds the share of the total assets in brackets to every tooltip figure', () => {
    const { tooltip } = build() as unknown as {
      tooltip: { valueFormatter: (value: number, dataIndex: number) => string };
    };
    // 2025-02-01: assets 15.00, crypto 5.00 = 33 %, liabilities plotted as −4.00 = 27 %.
    expect(tooltip.valueFormatter(5, 1)).toBe('€5.00 (33%)');
    expect(tooltip.valueFormatter(-4, 1)).toBe('€-4.00 (27%)');
    expect(tooltip.valueFormatter(11, 1)).toBe('€11.00 (73%)');
  });

  it('omits the liabilities series when there are none and lists every series in the legend', () => {
    const only = build([snapshots[1]]);
    expect(only.series.some((s) => s.stack === 'liabilities')).toBe(false);
    expect(only.legend.data).toEqual(['T:cash', 'Net']);
    expect(build().legend.data).toEqual(['T:cash', 'T:crypto', 'Liab', 'Net']);
  });

  it('keeps custom labels as first typed and splits same text across sides', () => {
    const custom = [
      {
        snapshotDate: '2025-01-01',
        entries: [
          entry({ class: { custom: ' Whisky ' } }),
          entry({ side: 'LIABILITY', class: { custom: 'whisky' } }),
        ],
      },
    ];
    const names = classLabels(custom, (id) => id);
    expect([...names.values()]).toEqual(['Whisky', 'whisky']);
  });
});

describe('chartSummary', () => {
  it('describes the range and the first and last net worth', () => {
    const text = chartSummary(
      '{{from}}→{{to}}: {{start}}→{{end}} ({{count}})',
      [snapshots[1], snapshots[0]],
      format,
      (s) => (s === snapshots[0] ? '11.00' : '1.00'),
    );
    expect(text).toBe('2025-01-01→2025-02-01: €1.00→€11.00 (2)');
  });
});
