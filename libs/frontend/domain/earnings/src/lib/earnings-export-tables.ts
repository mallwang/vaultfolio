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
  extra: Partial<ExportTableColumn> = {},
): ExportTableColumn => ({ key, label, format, ...extra });

/** Excel formula template for a share of the gross, `0` without gross (as the report's ratios). */
const shareOfGross = (...parts: string[]) =>
  'IF({gross}=0,0,(' + parts.map((p) => '{' + p + '}').join('+') + ')/{gross})';

/** Canonical `0.0000` ratio of two money strings, rounded half up like the report's ratios. */
function ratio(numerator: string, denominator: string): string {
  const cents = (value: string) => {
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return BigInt(whole + fraction.padEnd(2, '0').slice(0, 2)) * (value.startsWith('-') ? -1n : 1n);
  };
  const n = cents(numerator);
  const d = cents(denominator);
  if (d === 0n) return '0.0000';
  const negative = n < 0n !== d < 0n;
  const abs = (v: bigint) => (v < 0n ? -v : v);
  const scaled = (abs(n) * 20000n + abs(d)) / (2n * abs(d));
  const text = scaled.toString().padStart(5, '0');
  return `${negative && scaled !== 0n ? '-' : ''}${text.slice(0, -4)}.${text.slice(-4)}`;
}

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
      col('taxRatio', t('earnings.tables.taxesPct'), 'ratio', { formula: shareOfGross('taxes') }),
      col('socialRatio', t('earnings.tables.socialPct'), 'ratio', {
        formula: shareOfGross('social'),
      }),
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
      taxRatio: ratio(entry.totals.taxes, entry.totals.gross),
      social: entry.totals.social,
      socialRatio: ratio(entry.totals.social, entry.totals.gross),
      bonus: entry.totals.bonus,
      bonusRatio: ratio(entry.totals.bonus, entry.totals.gross),
    },
    ...(emphasis ? { emphasis } : {}),
  });
  return {
    id: 'employers',
    title: t('earnings.export.tableEmployers'),
    totalKey: 'careerTotal',
    columns: [
      col('employer', t('earnings.tables.employer'), 'text'),
      col('gross', t('earnings.terms.gross'), 'money', { sumInTotal: true }),
      col('net', t('earnings.terms.net'), 'money', { sumInTotal: true }),
      col('netRatio', t('earnings.terms.netRatio'), 'ratio', {
        formula: 'IF({gross}=0,0,{net}/{gross})',
      }),
      col('taxes', t('earnings.terms.taxes'), 'money', { sumInTotal: true }),
      col('taxRatio', t('earnings.tables.taxesPct'), 'ratio', { formula: shareOfGross('taxes') }),
      col('social', t('earnings.terms.social'), 'money', { sumInTotal: true }),
      col('socialRatio', t('earnings.tables.socialPct'), 'ratio', {
        formula: shareOfGross('social'),
      }),
      col('bonus', t('earnings.terms.bonus'), 'money', { sumInTotal: true }),
      col('bonusRatio', t('earnings.tables.bonusPct'), 'ratio', { formula: shareOfGross('bonus') }),
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
  // CSV/JSON keep one flat column per figure ("Brutto Januar", "Netto Januar", ...); Excel shows
  // gross and net side by side under a merged month header. No year sums in any format.
  return {
    id: 'monthlyOverview',
    title: t('earnings.export.tableMonthly'),
    columns: [
      col('year', t('earnings.tables.year'), 'integer'),
      ...months.flatMap((m) => {
        const month = longMonth(m, lang);
        return [
          col(`gross${pad(m)}`, `${gross} ${month}`, 'money', {
            excel: { group: month, label: gross },
          }),
          col(`net${pad(m)}`, `${net} ${month}`, 'money', { excel: { group: month, label: net } }),
        ];
      }),
    ],
    rows: report.monthGrid.map((row) => ({
      cells: {
        year: row.year,
        ...Object.fromEntries(
          months.flatMap((m) => [
            [`gross${pad(m)}`, row.gross[m - 1]],
            [`net${pad(m)}`, row.net[m - 1]],
          ]),
        ),
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
      col('taxRatio', t('earnings.tables.taxesPct'), 'ratio', {
        formula: shareOfGross('wageTax', 'soli', 'churchTax'),
      }),
      col('socialRatio', t('earnings.tables.socialPct'), 'ratio', {
        formula: shareOfGross('health', 'care', 'pension', 'unemployment'),
      }),
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
