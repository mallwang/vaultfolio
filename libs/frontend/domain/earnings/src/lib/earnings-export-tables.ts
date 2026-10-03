import type {
  ExportTable,
  ExportTableColumn,
  ExportTableColumnFormat,
  ExportTableRow,
} from '@vaultfolio/export';
import type { CareerEntry } from '@vaultfolio/api-contract';
import type { EarningsReport } from './earnings-report';

type Translate = (key: string) => string;

const col = (
  key: string,
  label: string,
  format: ExportTableColumnFormat = 'money',
): ExportTableColumn => ({ key, label, format });

const pad = (month: number) => String(month).padStart(2, '0');

/** Full month name ("January" / "Januar") for the monthly-overview column labels. */
function longMonth(month: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' }).format(
    Date.UTC(2000, month - 1, 1),
  );
}

function grossPerYear(report: EarningsReport, t: Translate): ExportTable {
  return {
    id: 'grossPerYear',
    title: t('earnings.overview.grossPerYear'),
    columns: [
      col('year', t('earnings.tables.year'), 'integer'),
      col('monthsEmployed', t('earnings.tables.months'), 'integer'),
      col('gross', t('earnings.terms.gross')),
      col('regular', t('earnings.terms.regular')),
      col('bonus', t('earnings.terms.bonus')),
      col('net', t('earnings.terms.net')),
      col('taxes', t('earnings.terms.taxes')),
      col('social', t('earnings.terms.social')),
      col('taxRatio', t('earnings.tables.taxesPct'), 'ratio'),
      col('socialRatio', t('earnings.tables.socialPct'), 'ratio'),
    ],
    rows: report.yearly.map((p) => ({
      cells: {
        year: p.year,
        monthsEmployed: p.monthsEmployed,
        gross: p.gross,
        regular: p.regular,
        bonus: p.bonus,
        net: p.net,
        taxes: p.taxes,
        social: p.social,
        taxRatio: p.taxRatio,
        socialRatio: p.socialRatio,
      },
    })),
  };
}

function employers(report: EarningsReport, t: Translate): ExportTable {
  const toRow = (entry: CareerEntry, label: string, emphasis?: 'total'): ExportTableRow => ({
    cells: {
      employer: label,
      gross: entry.totals.gross,
      net: entry.totals.net,
      netRatio: entry.netRatio,
      taxes: entry.totals.taxes,
      social: entry.totals.social,
      bonus: entry.totals.bonus,
    },
    ...(emphasis ? { emphasis } : {}),
  });
  return {
    id: 'employers',
    title: t('earnings.export.tableEmployers'),
    totalKey: 'careerTotal',
    columns: [
      col('employer', t('earnings.tables.employer'), 'text'),
      col('gross', t('earnings.terms.gross')),
      col('net', t('earnings.terms.net')),
      col('netRatio', t('earnings.terms.netRatio'), 'ratio'),
      col('taxes', t('earnings.terms.taxes')),
      col('social', t('earnings.terms.social')),
      col('bonus', t('earnings.terms.bonus')),
    ],
    rows: [
      ...report.employers.map((e) => toRow(e, e.label)),
      ...(report.total ? [toRow(report.total, t('earnings.export.careerTotal'), 'total')] : []),
    ],
  };
}

function monthlyOverview(report: EarningsReport, t: Translate, lang: string): ExportTable {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const gross = t('earnings.terms.gross');
  const net = t('earnings.terms.net');
  const sum = t('earnings.tables.sum');
  return {
    id: 'monthlyOverview',
    title: t('earnings.export.tableMonthly'),
    columns: [
      col('year', t('earnings.tables.year'), 'integer'),
      ...months.map((m) => col(`gross${pad(m)}`, `${gross} ${longMonth(m, lang)}`)),
      col('grossTotal', `${gross} ${sum}`),
      ...months.map((m) => col(`net${pad(m)}`, `${net} ${longMonth(m, lang)}`)),
      col('netTotal', `${net} ${sum}`),
    ],
    rows: report.monthGrid.map((row) => ({
      cells: {
        year: row.year,
        ...Object.fromEntries(months.map((m) => [`gross${pad(m)}`, row.gross[m - 1]])),
        grossTotal: row.grossSum,
        ...Object.fromEntries(months.map((m) => [`net${pad(m)}`, row.net[m - 1]])),
        netTotal: row.netSum,
      },
    })),
  };
}

function taxesPerYear(report: EarningsReport, t: Translate): ExportTable {
  return {
    id: 'taxesPerYear',
    title: t('earnings.tables.taxTitle'),
    columns: [
      col('year', t('earnings.tables.year'), 'integer'),
      col('employer', t('earnings.tables.employer'), 'text'),
      col('months', t('earnings.tables.months'), 'integer'),
      col('gross', t('earnings.terms.gross')),
      col('bonus', t('earnings.tables.ofWhichBonus')),
      col('taxGross', t('earnings.terms.taxGross')),
      col('wageTax', t('earnings.terms.wageTax')),
      col('soli', t('earnings.tables.soliShort')),
      col('churchTax', t('earnings.terms.churchTax')),
      col('health', t('earnings.tables.healthShort')),
      col('care', t('earnings.tables.careShort')),
      col('pension', t('earnings.tables.pensionShort')),
      col('unemployment', t('earnings.tables.unemploymentShort')),
      col('taxRatio', t('earnings.tables.taxesPct'), 'ratio'),
      col('socialRatio', t('earnings.tables.socialPct'), 'ratio'),
    ],
    rows: report.taxRows.map((row) => ({
      cells: {
        year: row.year,
        employer: row.employerLabel,
        months: row.monthsEmployed,
        gross: row.gross,
        bonus: row.bonus,
        taxGross: row.taxGross,
        wageTax: row.wageTax,
        soli: row.soli,
        churchTax: row.churchTax,
        health: row.health,
        care: row.care,
        pension: row.pension,
        unemployment: row.unemployment,
        taxRatio: row.taxRatio,
        socialRatio: row.socialRatio,
      },
    })),
  };
}

/**
 * Projects the earnings report onto the four format-neutral tables of the CSV, Excel and JSON
 * export (035, FR-016–FR-020). Keys and ids are stable in every language; labels and titles are
 * translated. Gross and net are separate columns. An empty report yields the four tables with
 * their columns and no rows.
 */
export function toExportTables(report: EarningsReport, t: Translate, lang: string): ExportTable[] {
  return [
    grossPerYear(report, t),
    employers(report, t),
    monthlyOverview(report, t, lang),
    taxesPerYear(report, t),
  ];
}
