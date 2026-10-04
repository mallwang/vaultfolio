import type { ExportTable, PdfSection, PdfTableColumn, PdfTableRow } from '@vaultfolio/export';
import { SECTION_CELL_PADDING, SECTION_PAGE_MARGIN } from '@vaultfolio/export';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import {
  type BalanceGroup,
  type ClassRef,
  type Period,
  balanceSheetOf,
  changesOf,
  effectiveGroup,
  latestOf,
  seriesOf,
  sortedByDate,
  totalsOf,
} from '@vaultfolio/wealth';
import { classLabels, labelOfClass } from './charts/wealth-charts';
import { fill, formatDate, formatMoney, formatPct } from './wealth-format';

type Translate = (key: string) => string;

/** Landscape A4 (842 pt wide) content width at the export lib's section margins. */
const PDF_CONTENT_WIDTH = 842 - 2 * SECTION_PAGE_MARGIN;

function periodLabel(period: Period, t: Translate): string {
  return t(`wealth.period.${period}`);
}

/** Share of `part` in `total` as a fraction (display only); `null` without a positive total. */
function shareOf(part: string, total: string): number | null {
  const whole = Number(total);
  return whole > 0 ? Number(part) / whole : null;
}

function kpiSection(
  snapshots: readonly WealthSnapshot[],
  t: Translate,
  lang: string,
): PdfSection | null {
  const latest = latestOf(snapshots);
  if (!latest) return null;
  const sorted = sortedByDate(snapshots);
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const na = t('wealth.kpi.notAvailable');
  const none = t('wealth.kpi.none');
  const { delta, pct } = latest.change;
  return {
    kind: 'kpis',
    tiles: [
      {
        label: t('wealth.kpi.net'),
        value: formatMoney(latest.totals.net, lang),
        hints: [
          fill(t('wealth.kpi.asOf'), { date: formatDate(latest.snapshot.snapshotDate, lang) }),
        ],
        highlight: true,
      },
      {
        label: t('wealth.kpi.change'),
        value: delta === null ? none : formatMoney(delta, lang, { signed: true }),
        hints:
          previous && delta !== null
            ? [
                `${formatPct(pct, lang, na)} · ${fill(t('wealth.kpi.sincePrevious'), { date: formatDate(previous.snapshotDate, lang) })}`,
              ]
            : [],
      },
      { label: t('wealth.kpi.assets'), value: formatMoney(latest.totals.assets, lang) },
      { label: t('wealth.kpi.liabilities'), value: formatMoney(latest.totals.liabilities, lang) },
    ],
  };
}

function sideRank(side: 'ASSET' | 'LIABILITY'): number {
  return side === 'ASSET' ? 0 : 1;
}

/** Latest snapshot by class (assets, then liabilities) with the change since the previous one. */
function classTable(
  snapshots: readonly WealthSnapshot[],
  t: Translate,
): Extract<PdfSection, { kind: 'table' }> | null {
  const sorted = sortedByDate(snapshots);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const labelOf = classLabels(sorted, (id) => t(`wealth.classes.${id}`));
  const pair = previous ? [previous, latest] : [latest];
  const series = seriesOf(pair);
  const totals = totalsOf(latest);
  const last = pair.length - 1;
  const rows: PdfTableRow[] = Object.keys(series.byClass)
    .map((key) => ({
      key,
      side: key.startsWith('ASSET:') ? ('ASSET' as const) : ('LIABILITY' as const),
      amount: series.byClass[key][last],
      before: previous ? series.byClass[key][0] : null,
    }))
    .filter((row) => Number(row.amount) > 0 || (row.before !== null && Number(row.before) > 0))
    .sort((a, b) => sideRank(a.side) - sideRank(b.side) || Number(b.amount) - Number(a.amount))
    .map((row) => ({
      cells: {
        class: labelOf.get(row.key) ?? row.key,
        side: t(`wealth.export.side.${row.side}`),
        amount: row.amount,
        share: shareOf(row.amount, row.side === 'ASSET' ? totals.assets : totals.liabilities),
        change: row.before === null ? null : (Number(row.amount) - Number(row.before)).toFixed(2),
      },
    }));
  const columns: PdfTableColumn[] = [
    { key: 'class', label: t('wealth.export.classColumn'), format: 'text', width: 220 },
    { key: 'side', label: t('wealth.export.sideColumn'), format: 'text', width: 100 },
    { key: 'amount', label: t('wealth.export.amountColumn'), format: 'currency' },
    { key: 'share', label: t('wealth.export.shareColumn'), format: 'percent' },
    { key: 'change', label: t('wealth.kpi.change'), format: 'currency' },
  ];
  return {
    kind: 'table',
    title: t('wealth.export.classTable'),
    columns,
    rows,
    fontSize: 8,
    startOnNewPage: false,
  };
}

function snapshotTable(
  snapshots: readonly WealthSnapshot[],
  t: Translate,
  lang: string,
): Extract<PdfSection, { kind: 'table' }> {
  const changes = new Map(changesOf(snapshots).map((c) => [c.id, c]));
  const rows = [...sortedByDate(snapshots)].reverse().map<PdfTableRow>((snapshot) => {
    const totals = totalsOf(snapshot);
    const change = changes.get(snapshot.id);
    return {
      cells: {
        date: formatDate(snapshot.snapshotDate, lang),
        assets: totals.assets,
        liabilities: totals.liabilities,
        net: totals.net,
        delta: change?.delta ?? null,
        pct: change?.ratio === null || change === undefined ? null : Number(change.ratio),
        pctPerYear:
          change?.ratioPerYear === null || change === undefined
            ? null
            : Number(change.ratioPerYear),
      },
    };
  });
  return {
    kind: 'table',
    title: t('wealth.export.snapshotTable'),
    columns: [
      { key: 'date', label: t('wealth.table.date'), format: 'text', width: 120 },
      { key: 'assets', label: t('wealth.table.assets'), format: 'currency' },
      { key: 'liabilities', label: t('wealth.table.liabilities'), format: 'currency' },
      { key: 'net', label: t('wealth.table.net'), format: 'currency' },
      { key: 'delta', label: t('wealth.table.change'), format: 'currency' },
      { key: 'pct', label: t('wealth.table.percent'), format: 'percent', footnote: 1 },
      { key: 'pctPerYear', label: t('wealth.table.perYear'), format: 'percent', footnote: 2 },
    ],
    rows,
    footnotes: [t('wealth.table.percentHint'), t('wealth.table.perYearHint')],
    fontSize: 8,
    startOnNewPage: true,
  };
}

/**
 * Aktiva left, Passiva right; group headers flagged `emphasis: 'total'`, one identical "Summe" row
 * at the end. Shared by the PDF table and the balance sheet of the data exports.
 */
function balanceRows(
  snapshot: WealthSnapshot,
  settings: WealthSettings,
  t: Translate,
): PdfTableRow[] {
  const sheet = balanceSheetOf(snapshot, settings.classGroups);
  type Line = { label: string; amount: string; header: boolean };
  const classText = (ref: ClassRef) => labelOfClass(ref, (id) => t(`wealth.classes.${id}`));
  const groupLines = (
    groups: readonly {
      group: BalanceGroup;
      subtotal: string;
      entries: WealthSnapshot['entries'];
    }[],
  ): Line[] =>
    groups.flatMap((group) => [
      { label: t(`wealth.groups.${group.group}`), amount: group.subtotal, header: true },
      ...group.entries.map((entry) => ({
        label: `${entry.name} (${classText(entry.class)})`,
        amount: entry.amount,
        header: false,
      })),
      ...(group.entries.length === 0
        ? [{ label: t('wealth.balance.noPositions'), amount: '', header: false }]
        : []),
    ]);
  const order: BalanceGroup[] = ['LONG_TERM', 'SHORT_TERM', 'OTHER_LIABILITY'];
  const left = groupLines(sheet.assets);
  const right: Line[] = [
    { label: t('wealth.balance.equity'), amount: sheet.equity, header: true },
    ...groupLines(order.flatMap((g) => sheet.liabilities.filter((x) => x.group === g))),
  ];
  const height = Math.max(left.length, right.length);
  const empty: Line = { label: '', amount: '', header: false };
  const rows: PdfTableRow[] = Array.from({ length: height }, (_, i) => {
    const l = left[i] ?? empty;
    const r = right[i] ?? empty;
    return {
      cells: {
        assetLabel: l.label,
        assetAmount: l.amount === '' ? null : l.amount,
        passivaLabel: r.label,
        passivaAmount: r.amount === '' ? null : r.amount,
      },
      ...(l.header || r.header ? { emphasis: 'total' as const } : {}),
    };
  });
  rows.push({
    cells: {
      assetLabel: t('wealth.export.balanceTotal'),
      assetAmount: sheet.sumAssets,
      passivaLabel: t('wealth.export.balanceTotal'),
      passivaAmount: sheet.sumPassiva,
    },
    emphasis: 'total',
  });
  return rows;
}

function balanceTable(
  snapshot: WealthSnapshot,
  settings: WealthSettings,
  t: Translate,
  lang: string,
): Extract<PdfSection, { kind: 'table' }> {
  const money = 90;
  const text = (PDF_CONTENT_WIDTH - 2 * money - 4 * 2 * SECTION_CELL_PADDING) / 2;
  // Rows that are shorter on one side leave that side blank rather than showing dashes.
  return {
    kind: 'table',
    title: fill(t('wealth.export.balanceTitle'), {
      date: formatDate(snapshot.snapshotDate, lang),
    }),
    columns: [
      { key: 'assetLabel', label: t('wealth.export.balanceAssets'), format: 'text', width: text },
      {
        key: 'assetAmount',
        label: '',
        format: 'currency',
        width: money,
        blankWhenMissing: true,
      },
      {
        key: 'passivaLabel',
        label: t('wealth.export.balancePassiva'),
        format: 'text',
        width: text,
      },
      {
        key: 'passivaAmount',
        label: '',
        format: 'currency',
        width: money,
        blankWhenMissing: true,
      },
    ],
    rows: balanceRows(snapshot, settings, t),
    fontSize: 8,
    startOnNewPage: true,
  };
}

/**
 * Sections of the wealth PDF (design.md "PDF report"): period line, KPI tiles (the chart follows
 * from `getChartOptions`), the class table of the latest snapshot, the snapshot table and — on a
 * page of its own — the balance sheet of the latest snapshot in the period. Everything comes from
 * the same lib functions as the screen, so the figures match (SC-005).
 */
export function buildWealthPdfSections(
  snapshotsInPeriod: readonly WealthSnapshot[],
  settings: WealthSettings,
  period: Period,
  t: Translate,
  lang: string,
): PdfSection[] {
  const sorted = sortedByDate(snapshotsInPeriod);
  const latest = sorted[sorted.length - 1];
  if (!latest) return emptyWealthPdfSections(t);
  const sections: (PdfSection | null)[] = [
    {
      kind: 'text',
      text: fill(t('wealth.export.period'), { period: periodLabel(period, t) }),
    },
    kpiSection(sorted, t, lang),
    classTable(sorted, t),
    snapshotTable(sorted, t, lang),
    balanceTable(latest, settings, t, lang),
  ];
  return sections.filter((s): s is PdfSection => s !== null);
}

export function emptyWealthPdfSections(t: Translate): PdfSection[] {
  return [{ kind: 'text', text: t('wealth.export.unavailable') }];
}

/** `2026-09-30` → `30.09.2026` in German, the ISO date otherwise; safe in a sheet name. */
function shortDate(iso: string, lang: string): string {
  return lang.startsWith('de') ? iso.split('-').reverse().join('.') : iso;
}

/**
 * Entry table, totals table and the current balance sheet (latest snapshot) for JSON, CSV and
 * Excel. In Excel the totals' change, percent and p. a. columns are formulas over the net worths
 * and dates, and dates are real date cells.
 */
export function buildWealthExportTables(
  snapshots: readonly WealthSnapshot[],
  settings: WealthSettings,
  t: Translate,
  lang: string,
): ExportTable[] {
  const sorted = sortedByDate(snapshots);
  const changes = new Map(changesOf(sorted).map((c) => [c.id, c]));
  const entries: ExportTable = {
    id: 'entries',
    title: t('wealth.export.entriesTable'),
    columns: [
      { key: 'date', label: t('wealth.table.date'), format: 'date' },
      { key: 'side', label: t('wealth.export.sideColumn'), format: 'text' },
      { key: 'class', label: t('wealth.export.classColumn'), format: 'text' },
      { key: 'name', label: t('wealth.export.entryName'), format: 'text' },
      { key: 'amount', label: t('wealth.export.amountColumn'), format: 'money' },
      { key: 'balanceGroup', label: t('wealth.export.balanceGroup'), format: 'text' },
    ],
    rows: sorted.flatMap((snapshot) =>
      snapshot.entries.map((entry) => ({
        cells: {
          date: snapshot.snapshotDate,
          side: t(`wealth.export.side.${entry.side}`),
          class: labelOfClass(entry.class, (id) => t(`wealth.classes.${id}`)),
          name: entry.name,
          amount: entry.amount,
          balanceGroup: t(
            `wealth.groups.${effectiveGroup(entry.side, entry.class, settings.classGroups)}`,
          ),
        },
      })),
    ),
  };
  const totals: ExportTable = {
    id: 'totals',
    title: t('wealth.export.totalsTable'),
    columns: [
      { key: 'date', label: t('wealth.table.date'), format: 'date' },
      { key: 'assets', label: t('wealth.table.assets'), format: 'money' },
      { key: 'liabilities', label: t('wealth.table.liabilities'), format: 'money' },
      { key: 'net', label: t('wealth.table.net'), format: 'money' },
      {
        key: 'change',
        label: t('wealth.table.change'),
        format: 'money',
        formula: '{net}-{prev:net}',
      },
      {
        key: 'changeRatio',
        label: t('wealth.table.percent'),
        format: 'ratio',
        formula: 'IF({prev:net}>0,({net}-{prev:net})/{prev:net},"")',
      },
      {
        key: 'changeRatioPerYear',
        label: t('wealth.table.perYear'),
        format: 'ratio',
        formula:
          'IF(AND({prev:net}>0,{net}>0,{date}>{prev:date}),({net}/{prev:net})^(365/({date}-{prev:date}))-1,"")',
      },
    ],
    rows: sorted.map((snapshot) => {
      const sums = totalsOf(snapshot);
      const change = changes.get(snapshot.id);
      return {
        cells: {
          date: snapshot.snapshotDate,
          assets: sums.assets,
          liabilities: sums.liabilities,
          net: sums.net,
          change: change?.delta ?? null,
          changeRatio: change?.ratio ?? null,
          changeRatioPerYear: change?.ratioPerYear ?? null,
        },
      };
    }),
  };
  const latest = sorted[sorted.length - 1];
  const balance: ExportTable = {
    id: 'balance',
    title: latest
      ? fill(t('wealth.export.balanceSheetAt'), { date: shortDate(latest.snapshotDate, lang) })
      : t('wealth.export.balanceSheet'),
    columns: [
      { key: 'assetLabel', label: t('wealth.export.balanceAssets'), format: 'text' },
      { key: 'assetAmount', label: t('wealth.export.amountColumn'), format: 'money' },
      { key: 'passivaLabel', label: t('wealth.export.balancePassiva'), format: 'text' },
      { key: 'passivaAmount', label: t('wealth.export.amountColumn'), format: 'money' },
    ],
    rows: latest ? balanceRows(latest, settings, t) : [],
  };
  return [entries, totals, balance];
}
