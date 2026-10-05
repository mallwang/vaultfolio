import {
  axisBreak,
  breakdownChartOption,
  insurancesChartColors,
  timelineChartOption,
} from './insurances-charts';

const format = { money: (v: number) => `€${v}`, moneyWhole: (v: number) => `€${v}` };
const colors = insurancesChartColors('light');

describe('insurances charts', () => {
  it('stacks one bar per group by contract in palette colors', () => {
    const option = breakdownChartOption(
      [
        {
          group: 'MOBILITY',
          yearly: '300.00',
          items: [
            { id: 'a', name: 'Kfz', yearly: '200.00' },
            { id: 'b', name: 'Fahrrad', yearly: '100.00' },
          ],
        },
        {
          group: 'LIABILITY',
          yearly: '100.00',
          items: [{ id: 'c', name: 'PHV', yearly: '100.00' }],
        },
      ],
      (g) => g,
      format,
      colors,
    );
    const series = option.series as {
      stack: string;
      itemStyle: { color: string };
      data: ({ value: number; name: string } | null)[];
    }[];
    expect((option.yAxis as { data: string[] }).data).toEqual(['MOBILITY', 'LIABILITY']);
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.itemStyle.color)).toEqual([colors.series[0], colors.series[1]]);
    expect(series[0].data).toEqual([
      { value: 200, name: 'Kfz' },
      { value: 100, name: 'PHV' },
    ]);
    expect(series[1].data).toEqual([{ value: 100, name: 'Fahrrad' }, null]);
  });

  it('uses teal and orange first', () => {
    expect(colors.series.slice(0, 2)).toEqual(['#0d9488', '#ea580c']);
  });

  it('highlights months with extra payments in the timeline', () => {
    const timeline = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      amount: i === 2 ? '106.00' : '10.00',
    }));
    const option = timelineChartOption(timeline, (m) => `M${m}`, 'Payments', format, colors);
    const series = (
      option.series as { data: { value: number; itemStyle: { color: string } }[] }[]
    )[0];
    expect(series.data[2]).toEqual({ value: 106, itemStyle: { color: colors.spike } });
    expect(series.data[0].itemStyle.color).toBe(colors.base);
    expect((option.xAxis as { data: string[] }).data[2]).toBe('M3');
  });

  it('uses theme-specific colors', () => {
    expect(insurancesChartColors('dark').base).not.toBe(insurancesChartColors('light').base);
  });
});

describe('axisBreak', () => {
  const g = (yearly: string) => ({ group: 'OTHER' as const, yearly, items: [] });

  it('breaks the axis only when one group dwarfs the others', () => {
    expect(axisBreak([g('1000000.00'), g('400.00'), g('100.00')])).toEqual({
      start: 441,
      end: 999880,
    });
    expect(axisBreak([g('800.00'), g('400.00')])).toBeUndefined();
    expect(axisBreak([g('900.00')])).toBeUndefined();
  });
});
