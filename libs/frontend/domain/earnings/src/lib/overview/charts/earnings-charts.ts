import type { EChartsOption } from 'echarts';
import type { MonthlyPoint, YearlyPoint } from '@vaultfolio/api-contract';

export type EarningsColors = Readonly<
  Record<'net' | 'taxes' | 'social' | 'regular' | 'bonus', string>
>;

/** Translated series names. */
export interface ChartLabels {
  regular: string;
  bonus: string;
  net: string;
  taxes: string;
  social: string;
  bonusMonth: string;
  employerChange: string;
}

/** Locale formatters (FR-048). */
export interface ChartFormat {
  money(value: number): string;
  moneyShort(value: number): string;
  percent(value: number): string;
  month(period: string): string;
}

export type GrossMode = 'total' | 'perMonth';
export type MonthRange = '1y' | '3y' | 'all';

const MONTHS_IN_RANGE: Record<MonthRange, number> = {
  '1y': 12,
  '3y': 36,
  all: Number.POSITIVE_INFINITY,
};
/** Rounded data ends (dataviz mark spec), anchored to the baseline. */
const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
const GAP = { borderColor: 'transparent', borderWidth: 1 };

const n = (value: string) => Number(value);

/** `YYYY-MM` that lies `count` months before `period`; '' (sorts first) for an unbounded range. */
function monthsBefore(period: string, count: number): string {
  if (!Number.isFinite(count)) return '';
  const index = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 - count;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Gross per year (FR-026): stacked regular pay + bonus, total label on top; Total or Per month employed. */
export function grossPerYearOption(
  yearly: readonly YearlyPoint[],
  mode: GrossMode,
  colors: EarningsColors,
  labels: ChartLabels,
  format: ChartFormat,
): EChartsOption {
  const divide = (value: string, point: YearlyPoint) => {
    if (mode === 'total') return n(value);
    return point.monthsEmployed > 0 ? n(value) / point.monthsEmployed : 0;
  };
  const regular = yearly.map((p) => round2(divide(p.regular, p)));
  const bonus = yearly.map((p) => round2(divide(p.bonus, p)));
  return {
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    legend: { data: [labels.regular, labels.bonus], top: 0, left: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => format.money(Number(v)),
    },
    xAxis: { type: 'category', data: yearly.map((p) => String(p.year)) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => format.moneyShort(v) } },
    series: [
      {
        name: labels.regular,
        type: 'bar',
        stack: 'gross',
        data: regular,
        itemStyle: { color: colors.regular, ...GAP },
        barMaxWidth: 36,
      },
      {
        name: labels.bonus,
        type: 'bar',
        stack: 'gross',
        data: bonus,
        itemStyle: { color: colors.bonus, borderRadius: TOP_RADIUS, ...GAP },
        barMaxWidth: 36,
        label: {
          show: true,
          position: 'top',
          formatter: (p) => format.moneyShort(regular[p.dataIndex] + bonus[p.dataIndex]),
        },
      },
    ],
  };
}

export interface MonthlyChart {
  option: EChartsOption;
  /** Period of each category index, for mapping a click to its month. */
  periods: string[];
}

/** Sums the points of one period (two employers in one month, or all employers). */
export function monthlyTotals(points: readonly MonthlyPoint[]): MonthlyPoint[] {
  const byPeriod = new Map<string, MonthlyPoint>();
  for (const p of points) {
    const current = byPeriod.get(p.period);
    if (!current) {
      byPeriod.set(p.period, { ...p });
      continue;
    }
    for (const key of ['gross', 'regular', 'bonus', 'net', 'taxes', 'social', 'payout'] as const) {
      current[key] = (n(current[key]) + n(p[key])).toFixed(2);
    }
    current.hasCorrection ||= p.hasCorrection;
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Where the gross goes, month by month (FR-027): net + taxes + social stacked (= gross), a dot
 * above bonus months, dashed lines at employer changes, the selected month outlined.
 */
export function monthlyOption(
  monthly: readonly MonthlyPoint[],
  range: MonthRange,
  selected: string | null,
  employerChanges: readonly string[],
  colors: EarningsColors,
  labels: ChartLabels,
  format: ChartFormat,
): MonthlyChart {
  const all = monthlyTotals(monthly);
  // The range counts calendar months back from the latest one, not data points — gaps stay gaps.
  const from =
    all.length > 0 ? monthsBefore(all[all.length - 1].period, MONTHS_IN_RANGE[range] - 1) : '';
  const points = all.filter((p) => p.period >= from);
  const periods = points.map((p) => p.period);
  const outline = (index: number, color: string, top = false) => ({
    color,
    ...(top ? { borderRadius: TOP_RADIUS } : {}),
    ...(periods[index] === selected ? { borderColor: '#0f172a', borderWidth: 2 } : GAP),
  });
  const bar = (key: 'net' | 'taxes' | 'social', name: string, color: string, top = false) => ({
    name,
    type: 'bar' as const,
    stack: 'month',
    barMaxWidth: 18,
    // Series-level colour too, so the legend swatch matches the per-item bars.
    itemStyle: { color },
    data: points.map((p, i) => ({ value: n(p[key]), itemStyle: outline(i, color, top) })),
  });
  const changes = employerChanges.filter((c) => periods.includes(c));

  return {
    periods,
    option: {
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      legend: {
        data: [labels.net, labels.taxes, labels.social, labels.bonusMonth],
        top: 0,
        left: 0,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => format.money(Number(v)),
      },
      xAxis: {
        type: 'category',
        data: periods.map((p) => format.month(p)),
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => format.moneyShort(v) } },
      series: [
        {
          ...bar('net', labels.net, colors.net),
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: labels.employerChange, position: 'insideEndTop' },
            lineStyle: { type: 'dashed', color: '#64748b' },
            data: changes.map((c) => ({ xAxis: format.month(c) })),
          },
        },
        bar('taxes', labels.taxes, colors.taxes),
        bar('social', labels.social, colors.social, true),
        {
          name: labels.bonusMonth,
          type: 'scatter',
          symbolSize: 8,
          itemStyle: { color: colors.bonus, borderColor: '#ffffff', borderWidth: 2 },
          tooltip: { valueFormatter: () => '' },
          data: points.map((p) => (n(p.bonus) !== 0 ? n(p.gross) * 1.04 + 50 : null)),
        },
      ],
    },
  };
}

/** Deductions as a share of gross per calendar year (FR-028), last value labeled. */
export function ratiosOption(
  yearly: readonly YearlyPoint[],
  colors: EarningsColors,
  labels: ChartLabels,
  format: ChartFormat,
): EChartsOption {
  const line = (key: 'taxRatio' | 'socialRatio', name: string, color: string) => ({
    name,
    type: 'line' as const,
    data: yearly.map((p) => n(p[key])),
    lineStyle: { width: 2, color },
    itemStyle: { color },
    symbolSize: 8,
    endLabel: {
      show: true,
      formatter: (p: { value: unknown }) => format.percent(Number(p.value)),
      color: 'inherit',
    },
  });
  return {
    grid: { left: 8, right: 56, top: 28, bottom: 8, containLabel: true },
    legend: { data: [labels.taxes, labels.social], top: 0, left: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => format.percent(Number(v)) },
    xAxis: { type: 'category', data: yearly.map((p) => String(p.year)), boundaryGap: false },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => format.percent(v) } },
    series: [
      line('taxRatio', labels.taxes, colors.taxes),
      line('socialRatio', labels.social, colors.social),
    ],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
