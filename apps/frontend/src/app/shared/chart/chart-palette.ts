import type { Theme } from '../../core/theme/theme.service';

/**
 * Theme-aware visual configuration `EchartComponent` applies on top of
 * whatever `option` its caller supplies (data-model.md "Chart
 * Configuration"). Resolved from a fixed palette object — not by reading
 * `--p-*` CSS custom properties at runtime (research.md #3) — so it stays
 * decoupled from PrimeNG internals and works the same in a test environment
 * without a DOM.
 */
export interface ChartPalette {
  /** Cycled by index to color chart data points (replaces `SLICE_COLORS`). */
  seriesColors: string[];
  /** Applied to legend/tooltip/axis label text so it stays legible in both themes. */
  textColor: string;
  /** Tooltip background; the chart canvas itself stays transparent to inherit the card background. */
  backgroundColor: string;
}

const SERIES_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#8b5cf6', '#ec4899'];

const LIGHT_PALETTE: ChartPalette = {
  seriesColors: SERIES_COLORS,
  textColor: '#1e293b',
  backgroundColor: '#ffffff',
};

const DARK_PALETTE: ChartPalette = {
  seriesColors: SERIES_COLORS,
  textColor: '#e2e8f0',
  backgroundColor: '#1e293b',
};

/** Resolves the fixed light/dark chart palette for the given app theme. */
export function resolveChartPalette(theme: Theme): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
