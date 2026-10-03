import type {
  CareerEntry,
  EarningsOverview,
  EarningsTables,
  TaxYearRow,
  YearlyPoint,
} from '@vaultfolio/api-contract';
import { gridRows } from './tables/earnings-tables.component';

/**
 * The earnings export report (035): the one place that orders, sums and picks the career total.
 * The PDF sections and the CSV/Excel/JSON tables are projections of it, so every format shows the
 * same figures as the screen. Years and employers are newest first; months keep calendar order.
 */

const ALL = 'ALL';

export interface ReportMonthYear {
  year: number;
  /** Twelve cells January–December; `null` for a month without data (never `0`). */
  gross: (string | null)[];
  net: (string | null)[];
  /** Exact sums of the months in integer cents. */
  grossSum: string;
  netSum: string;
}

export interface EarningsReport {
  yearly: YearlyPoint[];
  employers: CareerEntry[];
  /** The `ALL` entry, or the single employer; `null` without data. */
  total: CareerEntry | null;
  monthGrid: ReportMonthYear[];
  taxRows: TaxYearRow[];
}

/** Most recent employer first: last period, then first period (both descending), then label. */
export function byRecency(a: CareerEntry, b: CareerEntry): number {
  return (
    b.lastPeriod.localeCompare(a.lastPeriod) ||
    b.firstPeriod.localeCompare(a.firstPeriod) ||
    a.label.localeCompare(b.label)
  );
}

export function emptyEarningsReport(): EarningsReport {
  return { yearly: [], employers: [], total: null, monthGrid: [], taxRows: [] };
}

export function buildEarningsReport(
  overview: EarningsOverview,
  tables: EarningsTables,
): EarningsReport {
  if (!overview.hasData) return emptyEarningsReport();

  const employers = overview.career.filter((e) => e.key !== ALL).sort(byRecency);
  // The API only returns the `ALL` entry for more than one employer; with a single employer the
  // career total is that employer's row.
  const total =
    overview.career.find((e) => e.key === ALL) ?? (employers.length === 1 ? employers[0] : null);

  const net = new Map(gridRows(tables, 'net').map((row) => [row.year, row]));
  const monthGrid = gridRows(tables, 'gross')
    .sort((a, b) => b.year - a.year)
    .map<ReportMonthYear>((row) => {
      const netRow = net.get(row.year);
      return {
        year: row.year,
        gross: row.cells.map((cell) => cell.value),
        net: row.cells.map((_, i) => netRow?.cells[i].value ?? null),
        grossSum: row.sum,
        netSum: netRow?.sum ?? '0.00',
      };
    });

  const rank = new Map(employers.map((e, i) => [e.key, i]));
  const order = (row: TaxYearRow) => rank.get(row.employerId) ?? Number.MAX_SAFE_INTEGER;
  const taxRows = [...tables.taxesPerYear].sort(
    (a, b) =>
      b.year - a.year || order(a) - order(b) || a.employerLabel.localeCompare(b.employerLabel),
  );

  return {
    yearly: [...overview.yearly].sort((a, b) => b.year - a.year),
    employers,
    total,
    monthGrid,
    taxRows,
  };
}
