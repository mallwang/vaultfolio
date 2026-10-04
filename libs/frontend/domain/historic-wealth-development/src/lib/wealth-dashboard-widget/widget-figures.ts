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
  /** Asset classes of the latest snapshot in the overview's order, for the composition bar. */
  composition: { key: string; weight: number }[];
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
  composition: [],
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
    composition: compositionOf(latest.snapshot),
  };
}

/** Asset classes with their amounts, in the same order the overview's composition bar uses. */
function compositionOf(
  snapshot: Parameters<typeof seriesOf>[0][number],
): WidgetFigures['composition'] {
  const byClass = seriesOf([snapshot]).byClass;
  return Object.keys(byClass)
    .filter((key) => key.startsWith('ASSET:'))
    .map((key) => ({ key, weight: Number(byClass[key][0]) }));
}
