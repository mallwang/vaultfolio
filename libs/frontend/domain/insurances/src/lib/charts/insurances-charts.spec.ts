import { groupChartOption, insurancesChartColors, timelineChartOption } from './insurances-charts';

const format = { money: (v: number) => `€${v}`, moneyWhole: (v: number) => `€${v}` };
const colors = insurancesChartColors('light');

describe('insurances charts', () => {
  it('builds a donut with one slice per group in the group color', () => {
    const option = groupChartOption(
      [
        { group: 'MOBILITY', yearly: '300.00', share: 75 },
        { group: 'LIABILITY', yearly: '100.00', share: 25 },
      ],
      (g) => g,
      format,
      colors,
    );
    const series = (
      option.series as { data: { name: string; value: number; itemStyle: { color: string } }[] }[]
    )[0];
    expect(series.data.map((d) => [d.name, d.value, d.itemStyle.color])).toEqual([
      ['MOBILITY', 300, colors.groups.MOBILITY],
      ['LIABILITY', 100, colors.groups.LIABILITY],
    ]);
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
