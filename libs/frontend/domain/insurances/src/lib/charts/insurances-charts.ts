import type { EChartsOption } from 'echarts';
import type { InsuranceGroup } from '@vaultfolio/insurances';
import type { GroupBreakdown } from '../insurances-view';

export interface InsurancesChartFormat {
  money(value: number): string;
  moneyWhole(value: number): string;
}

export interface InsurancesChartColors {
  groups: Record<InsuranceGroup, string>;
  /** Cycled over the contracts within a group, teal and orange first (the app palette). */
  series: readonly string[];
  /** Light bars for the regular monthly base, strong bars for the spikes. */
  base: string;
  spike: string;
  text: string;
  /** Separator between stacked segments. */
  surface: string;
}

/** Light/dark chart colors; categorical hues are Tailwind-600 steps readable on both surfaces. */
export function insurancesChartColors(theme: 'light' | 'dark'): InsurancesChartColors {
  return {
    groups: {
      PERSONS: '#0d9488',
      LIABILITY: '#ea580c',
      PROPERTY: '#7c3aed',
      MOBILITY: '#2563eb',
      LEGAL: '#16a34a',
      OTHER: '#64748b',
    },
    series: [
      '#0d9488',
      '#ea580c',
      '#7c3aed',
      '#2563eb',
      '#16a34a',
      '#db2777',
      '#0891b2',
      '#ca8a04',
      '#4f46e5',
      '#64748b',
    ],
    base: theme === 'dark' ? '#475569' : '#cbd5e1',
    spike: theme === 'dark' ? '#2dd4bf' : '#0d9488',
    text: theme === 'dark' ? '#e2e8f0' : '#1e293b',
    surface: theme === 'dark' ? '#1e293b' : '#ffffff',
  };
}

/** Color of a contract by its position within the group (shared by the chart and its legend). */
export function seriesColor(colors: InsurancesChartColors, index: number): string {
  return colors.series[index % colors.series.length];
}

/** Axis break when one group dwarfs the rest, so the others stay readable and the long bar shows a break. */
export function axisBreak(
  groups: readonly GroupBreakdown[],
): { start: number; end: number } | undefined {
  const totals = groups.map((g) => Number(g.yearly)).sort((a, b) => b - a);
  if (totals.length < 2 || totals[0] <= totals[1] * 2) return undefined;
  return { start: Math.ceil(totals[1] * 1.1), end: Math.floor(totals[0] - totals[1] * 0.3) };
}

/**
 * One horizontal bar per group, stacked by contract: series `k` holds the k-th contract of every
 * group, so each group shows its own contracts in distinct colors. Tooltips name the contract.
 */
export function breakdownChartOption(
  groups: readonly GroupBreakdown[],
  labelOf: (group: InsuranceGroup) => string,
  format: InsurancesChartFormat,
  colors: InsurancesChartColors,
): EChartsOption {
  const depth = Math.max(0, ...groups.map((g) => g.items.length));
  const breakOf = axisBreak(groups);
  return {
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => format.money(Number(value)),
    },
    xAxis: {
      type: 'value',
      max: 'dataMax',
      splitLine: { show: true, showMaxLine: false },
      breaks: breakOf ? [{ start: breakOf.start, end: breakOf.end, gap: '2%' }] : undefined,
      axisLabel: {
        formatter: (v: number, _i: number, extra?: { break?: unknown } | null) =>
          extra?.break ? '' : format.moneyWhole(v),
      },
    },
    yAxis: { type: 'category', inverse: true, data: groups.map((g) => labelOf(g.group)) },
    series: Array.from({ length: depth }, (_, k) => ({
      type: 'bar' as const,
      stack: 'yearly',
      barMaxWidth: 36,
      itemStyle: { color: seriesColor(colors, k), borderColor: colors.surface, borderWidth: 1 },
      data: groups.map((g) => {
        const item = g.items[k];
        return item ? { value: Number(item.yearly), name: item.name } : null;
      }),
    })),
  };
}

/** Payments per month: the regular base lighter, months with extra payments (spikes) stronger. */
export function timelineChartOption(
  timeline: readonly { month: number; amount: string }[],
  monthLabel: (month: number) => string,
  seriesName: string,
  format: InsurancesChartFormat,
  colors: InsurancesChartColors,
): EChartsOption {
  const amounts = timeline.map((t) => Number(t.amount));
  const base = Math.min(...amounts);
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => format.money(Number(value)),
    },
    xAxis: { type: 'category', data: timeline.map((t) => monthLabel(t.month)) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => format.moneyWhole(v) } },
    series: [
      {
        name: seriesName,
        type: 'bar',
        barMaxWidth: 36,
        data: amounts.map((value) => ({
          value,
          itemStyle: { color: value > base ? colors.spike : colors.base },
        })),
      },
    ],
  };
}

/** Plain-text equivalent of a chart for assistive technology. */
export function chartParts(parts: readonly { label: string; value: string }[]): string {
  return parts.map((p) => `${p.label} ${p.value}`).join(', ');
}
