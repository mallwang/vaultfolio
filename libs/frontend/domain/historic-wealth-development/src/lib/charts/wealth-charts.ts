import type { EChartsOption } from 'echarts';
import { type ClassRef, type WealthEntry, classKey, seriesOf } from '@vaultfolio/wealth';

/** Minimal snapshot shape the chart needs (the API type satisfies it). */
export interface ChartSnapshot {
  snapshotDate: string;
  entries: WealthEntry[];
}

export interface WealthChartLabels {
  net: string;
  liabilities: string;
}

export interface WealthChartFormat {
  money(value: number): string;
  moneyWhole(value: number): string;
  /** A ratio (`0.384`) as a whole-number percentage (`38 %`). */
  percentWhole(ratio: number): string;
  date(iso: string): string;
}

export interface WealthChartColors {
  /** Categorical colors cycled over the asset classes. */
  classes: readonly string[];
  liabilities: string;
  net: string;
  text: string;
}

/** Light/dark chart colors; categorical hues are Tailwind-600 steps readable on both surfaces. */
export function wealthChartColors(theme: 'light' | 'dark'): WealthChartColors {
  return {
    classes: [
      '#2563eb',
      '#0d9488',
      '#d97706',
      '#7c3aed',
      '#16a34a',
      '#db2777',
      '#0891b2',
      '#ea580c',
      '#4f46e5',
      '#65a30d',
      '#9333ea',
      '#64748b',
    ],
    liabilities: theme === 'dark' ? '#f87171' : '#dc2626',
    net: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    text: theme === 'dark' ? '#e2e8f0' : '#1e293b',
  };
}

/** First-seen display label per class identity (translated for standard classes). */
export function classLabels(
  snapshots: readonly ChartSnapshot[],
  translateStandard: (id: string) => string,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.entries) {
      const key = classKey(entry.side, entry.class);
      if (!labels.has(key)) labels.set(key, labelOfClass(entry.class, translateStandard));
    }
  }
  return labels;
}

export function labelOfClass(ref: ClassRef, translateStandard: (id: string) => string): string {
  return 'standard' in ref ? translateStandard(ref.standard) : ref.custom.trim();
}

const HATCH = {
  symbol: 'rect',
  symbolSize: 1,
  dashArrayX: [1, 0],
  dashArrayY: [3, 4],
  rotation: Math.PI / 4,
  color: 'rgba(255, 255, 255, 0.55)',
} as const;

const toNumber = (value: string): number => Number(value);

/**
 * One stacked column per snapshot: asset classes stack upward, liabilities hang below the zero
 * line (hatched and in their own color so they read without color), and a line with markers shows
 * the net worth. The same builder serves the screen and the PDF raster (SC-005).
 */
export function wealthChartOption(
  snapshots: readonly ChartSnapshot[],
  labelOf: ReadonlyMap<string, string>,
  labels: WealthChartLabels,
  format: WealthChartFormat,
  colors: WealthChartColors,
): EChartsOption {
  const series = seriesOf(snapshots.map((s, index) => ({ id: String(index), ...s })));
  const assetKeys = Object.keys(series.byClass).filter((key) => key.startsWith('ASSET:'));
  const categories = series.dates.map((d) => format.date(d));
  const GAP = { borderColor: 'transparent', borderWidth: 1 };

  const assetSeries = assetKeys.map((key, index) => ({
    name: labelOf.get(key) ?? key,
    type: 'bar' as const,
    stack: 'assets',
    barMaxWidth: 44,
    data: series.byClass[key].map(toNumber),
    itemStyle: { color: colors.classes[index % colors.classes.length], ...GAP },
  }));

  const hasLiabilities = series.liabilities.some((v) => Number(v) > 0);
  const liabilitySeries = hasLiabilities
    ? [
        {
          name: labels.liabilities,
          type: 'bar' as const,
          stack: 'liabilities',
          barMaxWidth: 44,
          data: series.liabilities.map((v) => -Number(v)),
          itemStyle: { color: colors.liabilities, decal: HATCH, ...GAP },
        },
      ]
    : [];

  const netSeries = {
    name: labels.net,
    type: 'line' as const,
    data: series.net.map(toNumber),
    symbol: 'circle',
    symbolSize: 8,
    z: 10,
    lineStyle: { color: colors.net, width: 2 },
    itemStyle: { color: colors.net, borderColor: '#ffffff', borderWidth: 1 },
  };

  return {
    grid: { left: 8, right: 8, top: 56, bottom: 8, containLabel: true },
    legend: {
      type: 'scroll',
      top: 0,
      left: 0,
      data: [...assetSeries.map((s) => s.name), ...liabilitySeries.map((s) => s.name), labels.net],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      // Every figure carries its share of the snapshot's total assets in brackets; the liability
      // series is plotted negative, so the share uses the absolute value.
      valueFormatter: (value, dataIndex) => {
        const amount = format.money(Number(value));
        const assets = Number(series.assets[dataIndex]);
        return assets > 0
          ? `${amount} (${format.percentWhole(Math.abs(Number(value)) / assets)})`
          : amount;
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: categories.length > 12 ? 45 : 0, interval: 'auto' },
    },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => format.moneyWhole(v) } },
    series: [...assetSeries, ...liabilitySeries, netSeries],
  };
}

/** Plain-text equivalent of the chart for assistive technology. */
export function chartSummary(
  template: string,
  snapshots: readonly ChartSnapshot[],
  format: WealthChartFormat,
  netOf: (snapshot: ChartSnapshot) => string,
): string {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const params: Record<string, string | number> = {
    from: format.date(first.snapshotDate),
    to: format.date(last.snapshotDate),
    start: format.money(Number(netOf(first))),
    end: format.money(Number(netOf(last))),
    count: snapshots.length,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(params[key] ?? ''));
}
