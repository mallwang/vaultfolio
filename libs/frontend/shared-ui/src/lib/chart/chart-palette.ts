import type { AssetType } from '@vaultfolio/api-contract';
import type { Theme } from '../theme/theme.service';

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

/**
 * One fixed color per asset type, used wherever a chart or badge needs to
 * identify a holding's type at a glance (e.g. the holdings-distribution
 * pie, where every Precious metal slice — Gold, Silver, ... — shares one
 * color rather than being cycled through `seriesColors`). Same set in both
 * themes. ETF/Share/Crypto are darker/more saturated Tailwind-600/700
 * steps, chosen (and validated with the dataviz skill's palette validator
 * — CVD-safe, >=3:1 contrast on both the light and dark chart surface)
 * over the lighter `SERIES_COLORS` tones, which fail contrast against the
 * card background. PRECIOUS_METAL is a deliberate exception — true gold
 * (`#ffd700`) fails that same contrast check (~1.4:1 on the light
 * surface) but was chosen anyway for the literal metal association;
 * legend/tooltip text (not slice fill) carries the label, so low fill
 * contrast doesn't block reading the value.
 */
export const ASSET_TYPE_COLORS: Readonly<Record<AssetType, string>> = {
  ETF: '#16a34a', // green
  SHARE: '#2563eb', // blue
  PRECIOUS_METAL: '#ffd700', // gold
  CRYPTO: '#7c3aed', // purple
  DEPOSIT_MONEY: '#0d9488', // teal
};

/** The five named series roles of the Earnings domain (032-earnings-domain design.md). */
export type EarningsSeriesRole = 'net' | 'taxes' | 'social' | 'regular' | 'bonus';

/**
 * Fixed Earnings series colors per theme. Validated with the dataviz skill's palette validator
 * (lightness band, chroma, CVD and normal-vision separation, >= 3:1 against the chart surface)
 * for the groups that share a chart — net/taxes/social (month-by-month stack, deduction ratios)
 * and regular/bonus (gross per year) — against `#ffffff` (light) and `#1e293b` (dark). Net
 * (blue) and regular (indigo = app primary) never share a chart. Dark mode uses its own steps
 * for net and bonus to stay inside the dark lightness band.
 */
const EARNINGS_SERIES_COLORS: Readonly<
  Record<Theme, Readonly<Record<EarningsSeriesRole, string>>>
> = {
  light: {
    net: '#2563eb',
    taxes: '#ea580c',
    social: '#0d9488',
    regular: '#6366f1',
    bonus: '#dc2626',
  },
  dark: {
    net: '#3b82f6',
    taxes: '#ea580c',
    social: '#0d9488',
    regular: '#6366f1',
    bonus: '#ef4444',
  },
};

export function resolveEarningsSeriesColors(
  theme: Theme,
): Readonly<Record<EarningsSeriesRole, string>> {
  return EARNINGS_SERIES_COLORS[theme];
}
