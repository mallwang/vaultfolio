import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { latestOf, seriesOf, sortedByDate } from '@vaultfolio/wealth';

export interface WidgetFigures {
  /** `empty` (no snapshot), `single` (one snapshot) or `trend` (two or more). */
  kind: 'empty' | 'single' | 'trend';
  net: string;
  assets: string;
  liabilities: string;
  date: string;
  delta: string | null;
  pct: string | null;
  previousDate: string | null;
  /** Net worth per snapshot, ascending, for the sparkline. */
  trend: number[];
}

const EMPTY: WidgetFigures = {
  kind: 'empty',
  net: '0.00',
  assets: '0.00',
  liabilities: '0.00',
  date: '',
  delta: null,
  pct: null,
  previousDate: null,
  trend: [],
};

/** Everything the dashboard tile shows, from the same lib functions as the overview (SC-005). */
export function widgetFiguresOf(snapshots: readonly WealthSnapshot[]): WidgetFigures {
  const latest = latestOf(snapshots);
  if (!latest) return EMPTY;
  const sorted = sortedByDate(snapshots);
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  return {
    kind: previous ? 'trend' : 'single',
    net: latest.totals.net,
    assets: latest.totals.assets,
    liabilities: latest.totals.liabilities,
    date: latest.snapshot.snapshotDate,
    delta: latest.change.delta,
    pct: latest.change.pct,
    previousDate: previous?.snapshotDate ?? null,
    trend: seriesOf(sorted).net.map(Number),
  };
}

/** SVG polyline points (`x,y …`) scaling the trend into a `width` × `height` box. */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pad = 2;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
