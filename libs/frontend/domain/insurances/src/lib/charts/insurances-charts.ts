import type { EChartsOption } from 'echarts';
import type { InsuranceGroup } from '@vaultfolio/insurances';

export interface InsurancesChartFormat {
  money(value: number): string;
  moneyWhole(value: number): string;
}

export interface InsurancesChartColors {
  groups: Record<InsuranceGroup, string>;
  /** Light bars for the regular monthly base, strong bars for the spikes. */
  base: string;
  spike: string;
  text: string;
}

/** Light/dark chart colors; categorical hues are Tailwind-600 steps readable on both surfaces. */
export function insurancesChartColors(theme: 'light' | 'dark'): InsurancesChartColors {
  return {
    groups: {
      PERSONS: '#2563eb',
      LIABILITY: '#d97706',
      PROPERTY: '#0d9488',
      MOBILITY: '#7c3aed',
      LEGAL: '#db2777',
      OTHER: '#64748b',
    },
    base: theme === 'dark' ? '#475569' : '#cbd5e1',
    spike: theme === 'dark' ? '#34d399' : '#059669',
    text: theme === 'dark' ? '#e2e8f0' : '#1e293b',
  };
}

export interface GroupSlice {
  group: InsuranceGroup;
  yearly: string;
  share: number;
}

/** Donut of the yearly cost by insurance group. */
export function groupChartOption(
  slices: readonly GroupSlice[],
  labelOf: (group: InsuranceGroup) => string,
  format: InsurancesChartFormat,
  colors: InsurancesChartColors,
): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => format.money(Number(value)),
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['55%', '85%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        data: slices.map((s) => ({
          name: labelOf(s.group),
          value: Number(s.yearly),
          itemStyle: { color: colors.groups[s.group] },
        })),
      },
    ],
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
