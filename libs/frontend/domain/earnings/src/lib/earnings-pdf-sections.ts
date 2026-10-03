import {
  SECTION_CELL_PADDING,
  SECTION_PAGE_MARGIN,
  type PdfSection,
  type PdfTableColumn,
  type PdfTableRow,
} from '@vaultfolio/export';
import type { CareerEntry, EarningsOverview, EarningsTables } from '@vaultfolio/api-contract';
import { monthName } from './earnings-format';
import { buildEarningsReport, type EarningsReport } from './earnings-report';

/**
 * Sections of the earnings PDF (035): the per-employer overview with its career-total row, the
 * gross month-by-month grid and the taxes/contributions per year. Everything is derived from the
 * same read models the on-screen views use, so the PDF matches the screen. Years and employers
 * are listed newest first; month columns keep calendar order.
 */
type Translate = (key: string) => string;

/** Landscape A4 (842 pt wide) content width at the export lib's section margins. */
export const PDF_CONTENT_WIDTH = 842 - 2 * SECTION_PAGE_MARGIN;

/**
 * Content width each shared-width (`*`) column gets: the page width minus the fixed columns and
 * the cell padding pdfmake adds on top of every column.
 */
export function starColumnWidth(columns: readonly PdfTableColumn[]): number {
  const fixed = columns.reduce((sum, c) => sum + (typeof c.width === 'number' ? c.width : 0), 0);
  const stars = columns.filter((c) => c.width === undefined && c.format !== 'text').length;
  const padding = columns.length * 2 * SECTION_CELL_PADDING;
  return (PDF_CONTENT_WIDTH - fixed - padding) / stars;
}
/**
 * Up to this many employers (plus the career-total row) fit on page 1 below the chart; more
 * employers get a page of their own.
 */
export const MAX_EMPLOYERS_ON_FIRST_PAGE = 6;

function employerRows(report: EarningsReport, totalLabel: string): PdfTableRow[] {
  const toRow = (entry: CareerEntry, label: string, emphasis?: 'total'): PdfTableRow => ({
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
  return [
    ...report.employers.map((e) => toRow(e, e.label)),
    ...(report.total ? [toRow(report.total, totalLabel, 'total')] : []),
  ];
}

function employerTable(
  report: EarningsReport,
  t: Translate,
): Extract<PdfSection, { kind: 'table' }> {
  const columns: PdfTableColumn[] = [
    { key: 'employer', label: t('earnings.tables.employer'), format: 'text', width: 220 },
    { key: 'gross', label: t('earnings.terms.gross'), format: 'currency' },
    { key: 'net', label: t('earnings.terms.net'), format: 'currency' },
    { key: 'netRatio', label: t('earnings.terms.netRatio'), format: 'percent' },
    { key: 'taxes', label: t('earnings.terms.taxes'), format: 'currency' },
    { key: 'social', label: t('earnings.terms.social'), format: 'currency' },
    { key: 'bonus', label: t('earnings.terms.bonus'), format: 'currency' },
  ];
  return {
    kind: 'table',
    title: t('earnings.export.sectionEmployers'),
    columns,
    rows: employerRows(report, t('earnings.export.careerTotal')),
    fontSize: 8,
    startOnNewPage: report.employers.length > MAX_EMPLOYERS_ON_FIRST_PAGE,
  };
}

function monthGridTable(
  report: EarningsReport,
  t: Translate,
  lang: string,
): Extract<PdfSection, { kind: 'table' }> {
  const columns: PdfTableColumn[] = [
    { key: 'year', label: t('earnings.tables.year'), format: 'text', width: 30 },
    ...Array.from({ length: 12 }, (_, i) => ({
      key: `m${i + 1}`,
      label: monthName(i + 1, lang),
      format: 'currencyWhole' as const,
      secondaryKey: `n${i + 1}`,
    })),
    {
      key: 'sum',
      label: t('earnings.tables.sum'),
      format: 'currencyWhole',
      secondaryKey: 'netSum',
    },
  ];
  // Gross on top, net below.
  const rows = report.monthGrid.map<PdfTableRow>((row) => ({
    cells: {
      year: String(row.year),
      ...Object.fromEntries(row.gross.map((value, i) => [`m${i + 1}`, value])),
      ...Object.fromEntries(row.net.map((value, i) => [`n${i + 1}`, value])),
      sum: row.grossSum,
      netSum: row.netSum,
    },
  }));
  return {
    kind: 'table',
    title: t('earnings.export.sectionMonthly'),
    subtitle: t('earnings.export.sectionMonthlySub'),
    columns,
    rows,
    fontSize: 7,
  };
}

function taxTable(report: EarningsReport, t: Translate): Extract<PdfSection, { kind: 'table' }> {
  const columns: PdfTableColumn[] = [
    { key: 'year', label: t('earnings.tables.year'), format: 'text', width: 28 },
    { key: 'employer', label: t('earnings.tables.employer'), format: 'text', width: 96 },
    { key: 'months', label: t('earnings.tables.months'), format: 'integer', width: 26 },
    { key: 'gross', label: t('earnings.terms.gross'), format: 'currency' },
    { key: 'bonus', label: t('earnings.tables.ofWhichBonus'), format: 'currency' },
    { key: 'taxGross', label: t('earnings.terms.taxGross'), format: 'currency' },
    { key: 'wageTax', label: t('earnings.terms.wageTax'), format: 'currency' },
    { key: 'soli', label: t('earnings.tables.soliShort'), format: 'currency' },
    { key: 'churchTax', label: t('earnings.terms.churchTax'), format: 'currency' },
    { key: 'health', label: t('earnings.tables.healthShort'), format: 'currency' },
    { key: 'care', label: t('earnings.tables.careShort'), format: 'currency' },
    { key: 'pension', label: t('earnings.tables.pensionShort'), format: 'currency' },
    { key: 'unemployment', label: t('earnings.tables.unemploymentShort'), format: 'currency' },
    { key: 'taxRatio', label: t('earnings.tables.taxesPct'), format: 'percent' },
    { key: 'socialRatio', label: t('earnings.tables.socialPct'), format: 'percent' },
  ];
  const rows = report.taxRows.map<PdfTableRow>((row) => ({
    cells: {
      year: String(row.year),
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
  }));
  return {
    kind: 'table',
    title: t('earnings.tables.taxTitle'),
    subtitle: t('earnings.tables.taxSub'),
    columns,
    rows,
    fontSize: 7,
  };
}

/** Section shown instead of empty tables when there is nothing to export (FR-011). */
export function emptyEarningsPdfSections(t: Translate): PdfSection[] {
  return [{ kind: 'text', text: t('earnings.export.empty') }];
}

export function buildEarningsPdfSections(
  overview: EarningsOverview,
  tables: EarningsTables,
  t: Translate,
  lang: string,
): PdfSection[] {
  if (!overview.hasData) return emptyEarningsPdfSections(t);
  const report = buildEarningsReport(overview, tables);
  return [employerTable(report, t), monthGridTable(report, t, lang), taxTable(report, t)];
}
