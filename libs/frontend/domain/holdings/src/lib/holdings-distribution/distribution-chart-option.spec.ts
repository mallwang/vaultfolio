import {
  buildDistributionChartOption,
  buildTypeBreakdownChartOption,
  contrastTextColor,
} from './distribution-chart-option';
import { ASSET_TYPE_COLORS } from '@vaultfolio/frontend-shared-ui';

describe('contrastTextColor', () => {
  it('returns dark text for light fill colors (PRECIOUS_METAL gold)', () => {
    // #ffd700: brightness ≈ 202 → above 150 threshold
    expect(contrastTextColor(ASSET_TYPE_COLORS.PRECIOUS_METAL)).toBe('#1f2937');
  });

  it('returns white text for dark fill colors (SHARE blue)', () => {
    // #2563eb: brightness ≈ 96 → below 150 threshold
    expect(contrastTextColor(ASSET_TYPE_COLORS.SHARE)).toBe('#ffffff');
  });

  it('returns white text for all non-gold asset type colors', () => {
    for (const [type, color] of Object.entries(ASSET_TYPE_COLORS)) {
      if (type === 'PRECIOUS_METAL') continue;
      expect(contrastTextColor(color)).toBe('#ffffff');
    }
  });
});

describe('buildDistributionChartOption', () => {
  const entries = [
    { assetType: 'SHARE' as const, value: 100 },
    { assetType: 'PRECIOUS_METAL' as const, value: 50 },
  ];
  const resolveName = (e: { assetType: string }) => e.assetType;

  it('maps entries to pie series data with asset-type colors and contrast labels', () => {
    const option = buildDistributionChartOption(entries, 'en', resolveName);
    const series = option.series as Array<{ data: unknown[] }>;

    expect(series[0].data).toEqual([
      {
        name: 'SHARE',
        value: 100,
        itemStyle: { color: ASSET_TYPE_COLORS.SHARE },
        label: { color: contrastTextColor(ASSET_TYPE_COLORS.SHARE) },
      },
      {
        name: 'PRECIOUS_METAL',
        value: 50,
        itemStyle: { color: ASSET_TYPE_COLORS.PRECIOUS_METAL },
        label: { color: contrastTextColor(ASSET_TYPE_COLORS.PRECIOUS_METAL) },
      },
    ]);
  });

  it('hides the legend (show: false survives EchartComponent theme merge)', () => {
    const option = buildDistributionChartOption(entries, 'en', resolveName);
    expect((option.legend as { show: boolean }).show).toBe(false);
  });

  it('includes a title when provided and centers pie lower', () => {
    const option = buildDistributionChartOption(entries, 'en', resolveName, 'My Chart');
    expect(option.title).toBeDefined();
    const series = option.series as Array<{ center: string[] }>;
    expect(series[0].center).toEqual(['50%', '55%']);
  });

  it('omits the title key and centers pie higher when no title provided', () => {
    const option = buildDistributionChartOption(entries, 'en', resolveName);
    expect(option.title).toBeUndefined();
    const series = option.series as Array<{ center: string[] }>;
    expect(series[0].center).toEqual(['50%', '42%']);
  });

  it('produces an empty data array for empty entries', () => {
    const option = buildDistributionChartOption([], 'en', resolveName);
    const series = option.series as Array<{ data: unknown[] }>;
    expect(series[0].data).toEqual([]);
  });
});

describe('buildTypeBreakdownChartOption', () => {
  it('maps entries to pie series data by name/value', () => {
    const entries = [
      { name: 'Apple', value: 200 },
      { name: 'Tesla', value: 100 },
    ];
    const option = buildTypeBreakdownChartOption(entries, 'SHARE breakdown', 'en');
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;
    expect(series[0].data).toEqual([
      { name: 'Apple', value: 200 },
      { name: 'Tesla', value: 100 },
    ]);
  });

  it('sets the title text', () => {
    const option = buildTypeBreakdownChartOption([], 'My Title', 'en');
    expect((option.title as { text: string }).text).toBe('My Title');
  });

  it('hides the legend', () => {
    const option = buildTypeBreakdownChartOption([], 'x', 'en');
    expect((option.legend as { show: boolean }).show).toBe(false);
  });
});
