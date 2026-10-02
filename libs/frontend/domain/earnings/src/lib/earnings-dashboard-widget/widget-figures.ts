import type { EarningsOverview } from '@vaultfolio/api-contract';

export const MAX_BARS = 10;

export interface WidgetBar {
  year: number;
  /** Display value only (never used for stored arithmetic). */
  gross: number;
  /** The latest year, when it does not cover all twelve months yet. */
  partial: boolean;
}

export interface WidgetFigures {
  bars: WidgetBar[];
  /** Gross growth between the last two complete years; `null` without two of them. */
  growth: { from: number; to: number; ratio: number } | null;
  /** Latest year's gross divided by its months with data. */
  perMonth: string | null;
}

/**
 * Derives the dashboard widget's history from the overview: up to ten yearly gross bars, the
 * growth between the last two complete years (so January's single month never reads as a drop)
 * and the latest year's average gross per month.
 */
export function widgetFigures(overview: EarningsOverview): WidgetFigures {
  const latest = overview.latestYear;
  const years = [...overview.yearly].sort((a, b) => a.year - b.year);
  const isPartial = (year: number) => !!latest && year === latest.year && latest.months < 12;

  const bars = years.slice(-MAX_BARS).map((y) => ({
    year: y.year,
    gross: Number(y.gross),
    partial: isPartial(y.year),
  }));

  const complete = bars.filter((b) => !b.partial);
  const [before, last] = complete.slice(-2);
  const growth =
    before && last && before.gross > 0 && last.year === before.year + 1
      ? { from: before.year, to: last.year, ratio: last.gross / before.gross - 1 }
      : null;

  const perMonth =
    latest && latest.months > 0 ? (Number(latest.current.gross) / latest.months).toFixed(2) : null;

  return { bars, growth, perMonth };
}
