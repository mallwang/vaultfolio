import { resolveChartPalette } from './chart-palette';

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
