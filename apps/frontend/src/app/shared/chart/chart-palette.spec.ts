import { ASSET_TYPE_COLORS, resolveChartPalette } from './chart-palette';

describe('resolveChartPalette', () => {
  it.each(['light', 'dark'] as const)('returns a defined palette for theme "%s"', (theme) => {
    const palette = resolveChartPalette(theme);

    expect(palette.seriesColors.length).toBeGreaterThan(0);
    expect(palette.textColor).toBeTruthy();
    expect(palette.backgroundColor).toBeTruthy();
  });

  it('resolves distinct text/background colors between light and dark', () => {
    const light = resolveChartPalette('light');
    const dark = resolveChartPalette('dark');

    expect(light.textColor).not.toBe(dark.textColor);
    expect(light.backgroundColor).not.toBe(dark.backgroundColor);
  });
});

describe('ASSET_TYPE_COLORS', () => {
  it('has a distinct DEPOSIT_MONEY entry, different from every other asset type', () => {
    expect(ASSET_TYPE_COLORS.DEPOSIT_MONEY).toBeTruthy();
    const otherColors = [
      ASSET_TYPE_COLORS.ETF,
      ASSET_TYPE_COLORS.SHARE,
      ASSET_TYPE_COLORS.PRECIOUS_METAL,
      ASSET_TYPE_COLORS.CRYPTO,
    ];
    expect(otherColors).not.toContain(ASSET_TYPE_COLORS.DEPOSIT_MONEY);
  });
});
