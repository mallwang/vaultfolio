import Decimal from 'decimal.js';
import { classKey } from './classes';
import type { Period, WealthEntry, WealthSnapshot } from './model';

export interface Totals {
  assets: string;
  liabilities: string;
  net: string;
}

export interface Change {
  id: string;
  /** `net − previous net`; `null` for the first snapshot. */
  delta: string | null;
  /** Percent of the previous net worth with two decimals (`"12.50"` = 12.5 %); `null` unless that net worth is > 0. */
  pct: string | null;
  /** The same change as a fraction with four decimals (`"0.1250"` = 12.5 %), for exports; `null` like `pct`. */
  ratio: string | null;
}

export interface Series {
  dates: string[];
  net: string[];
  assets: string[];
  liabilities: string[];
  /** Per class identity (see `classKey`); a class absent in a snapshot counts as `0.00`. */
  byClass: Record<string, string[]>;
}

const PERIOD_YEARS: Record<Exclude<Period, 'all'>, number> = { '1y': 1, '3y': 3 };

function money(value: Decimal): string {
  return value.toFixed(2);
}

/** Ascending by snapshot date, independent of creation order. Does not mutate the input. */
export function sortedByDate<T extends Pick<WealthSnapshot, 'snapshotDate'>>(
  snapshots: readonly T[],
): T[] {
  return [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

function sumOf(entries: readonly WealthEntry[], side: WealthEntry['side']): Decimal {
  return entries
    .filter((e) => e.side === side)
    .reduce((acc, e) => acc.plus(e.amount), new Decimal(0));
}

export function totalsOf(snapshot: Pick<WealthSnapshot, 'entries'>): Totals {
  const assets = sumOf(snapshot.entries, 'ASSET');
  const liabilities = sumOf(snapshot.entries, 'LIABILITY');
  return {
    assets: money(assets),
    liabilities: money(liabilities),
    net: money(assets.minus(liabilities)),
  };
}

function yearsBefore(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y - years, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y - years}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
}

/** Snapshots within the period, measured back from the latest snapshot's date (ascending). */
export function filterPeriod<T extends Pick<WealthSnapshot, 'snapshotDate'>>(
  snapshots: readonly T[],
  period: Period,
): T[] {
  const sorted = sortedByDate(snapshots);
  if (period === 'all' || sorted.length === 0) return sorted;
  const cutoff = yearsBefore(sorted[sorted.length - 1].snapshotDate, PERIOD_YEARS[period]);
  return sorted.filter((s) => s.snapshotDate >= cutoff);
}

export function seriesOf(snapshots: readonly WealthSnapshot[]): Series {
  const sorted = sortedByDate(snapshots);
  const keys = new Set<string>();
  const perSnapshot = sorted.map((snapshot) => {
    const sums = new Map<string, Decimal>();
    for (const entry of snapshot.entries) {
      const key = classKey(entry.side, entry.class);
      keys.add(key);
      sums.set(key, (sums.get(key) ?? new Decimal(0)).plus(entry.amount));
    }
    return sums;
  });
  const byClass: Record<string, string[]> = {};
  for (const key of keys) {
    byClass[key] = perSnapshot.map((sums) => money(sums.get(key) ?? new Decimal(0)));
  }
  const totals = sorted.map(totalsOf);
  return {
    dates: sorted.map((s) => s.snapshotDate),
    net: totals.map((t) => t.net),
    assets: totals.map((t) => t.assets),
    liabilities: totals.map((t) => t.liabilities),
    byClass,
  };
}

function changeBetween(id: string, previous: Totals | null, current: Totals): Change {
  if (!previous) return { id, delta: null, pct: null, ratio: null };
  const prevNet = new Decimal(previous.net);
  const delta = new Decimal(current.net).minus(prevNet);
  return {
    id,
    delta: money(delta),
    pct: prevNet.gt(0) ? delta.div(prevNet).times(100).toFixed(2) : null,
    ratio: prevNet.gt(0) ? delta.div(prevNet).toFixed(4) : null,
  };
}

/** One change per snapshot, ascending by date; the first has no `delta`. */
export function changesOf(snapshots: readonly WealthSnapshot[]): Change[] {
  const sorted = sortedByDate(snapshots);
  return sorted.map((snapshot, index) =>
    changeBetween(snapshot.id, index > 0 ? totalsOf(sorted[index - 1]) : null, totalsOf(snapshot)),
  );
}

export interface Latest {
  snapshot: WealthSnapshot;
  totals: Totals;
  change: Change;
}

export function latestOf(snapshots: readonly WealthSnapshot[]): Latest | null {
  const changes = changesOf(snapshots);
  if (changes.length === 0) return null;
  const sorted = sortedByDate(snapshots);
  const snapshot = sorted[sorted.length - 1];
  return { snapshot, totals: totalsOf(snapshot), change: changes[changes.length - 1] };
}

/** Names, sides and classes of a snapshot with blank amounts, for backfilling (FR-007). */
export function copyTemplateOf(snapshot: Pick<WealthSnapshot, 'entries'>): WealthEntry[] {
  return snapshot.entries.map((entry) => ({
    side: entry.side,
    class:
      'standard' in entry.class
        ? { standard: entry.class.standard }
        : { custom: entry.class.custom },
    name: entry.name,
    amount: '',
  }));
}
