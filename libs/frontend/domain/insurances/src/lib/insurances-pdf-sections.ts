import type { InsurancesData } from '@vaultfolio/api-contract';
import type { PdfSection } from '@vaultfolio/export';
import {
  checkGaps,
  effectiveSocialLines,
  INSURANCE_TYPES,
  isSocialType,
  REQUIREMENTS,
  summarize,
  type GapItem,
  type GapResult,
  type InsuranceTypeDef,
  type Summary,
} from '@vaultfolio/insurances';
import { axisBreak } from './charts/insurances-charts';
import { formatDateShort, formatMoney } from './insurances-format';
import {
  buildRows,
  daysLeftLabel,
  groupBreakdown,
  type ContractRow,
  type GroupBreakdown,
  type Translate,
} from './insurances-view';

const DEFAULT_WARN_DAYS = 30;

/** Everything the PDF shows, derived once from the same lib functions as the screen. */
export interface InsurancesReport {
  summary: Summary;
  gaps: GapResult;
  breakdown: GroupBreakdown[];
  contractRows: ReturnType<typeof buildRows>;
}

export function buildInsurancesReport(data: InsurancesData, t: Translate): InsurancesReport {
  const { settings, today } = data;
  const linked = effectiveSocialLines(data.contracts, data.linkedSocial);
  const warnDays = settings.reminders.enabled ? settings.reminders.leadDays : DEFAULT_WARN_DAYS;
  const gaps = checkGaps({
    contracts: data.contracts,
    profile: settings.profile,
    dismissedRequirements: settings.dismissedRequirements,
    linkedKinds: linked.map((line) => line.kind),
    today,
  });
  const summary = summarize({
    contracts: data.contracts,
    linkedSocial: data.linkedSocial,
    includeSocial: settings.includeSocial,
    year: Number(today.slice(0, 4)),
    today,
    warnDays,
  });
  const rows = buildRows({
    contracts: data.contracts,
    linked: settings.includeSocial ? linked : [],
    gaps,
    today,
    warnDays,
    t,
  });
  const contractRows = rows.filter((row) => settings.includeSocial || !isSocialType(row.typeId));
  return {
    summary,
    gaps,
    breakdown: groupBreakdown(contractRows, settings.includeSocial),
    contractRows,
  };
}

export interface GroupRows {
  group: ContractRow['group'];
  monthly: string;
  yearly: string;
  rows: ContractRow[];
}

/** Rows per group, groups and contracts largest yearly premium first; totals count active rows only. */
export function rowsByGroup(rows: readonly ContractRow[]): GroupRows[] {
  const byGroup = new Map<ContractRow['group'], ContractRow[]>();
  for (const row of rows) byGroup.set(row.group, [...(byGroup.get(row.group) ?? []), row]);
  const sum = (list: ContractRow[], key: 'monthly' | 'yearly') =>
    list.filter((r) => r.active).reduce((acc, r) => acc + Number(r[key]), 0);
  return [...byGroup.entries()]
    .map(([group, list]) => ({
      group,
      monthly: sum(list, 'monthly').toFixed(2),
      yearly: sum(list, 'yearly').toFixed(2),
      rows: [...list].sort((a, b) => Number(b.yearly) - Number(a.yearly)),
    }))
    .sort((a, b) => Number(b.yearly) - Number(a.yearly));
}

/**
 * Sections of the insurances PDF (after the chart): the main tiles, one table with every contract
 * and the cost totals, and — on its own page — the insurances the gap check still recommends.
 */
export function buildInsurancesPdfSections(
  report: InsurancesReport,
  t: Translate,
  lang: string,
): PdfSection[] {
  const { summary, contractRows, breakdown } = report;
  const groups = rowsByGroup(contractRows);
  const money = (value: string) => formatMoney(value, lang);
  const next = summary.upcoming[0];
  const inactiveCount = contractRows.filter(
    (r) => r.kind === 'CONTRACT' && !r.active && !isSocialType(r.typeId),
  ).length;

  const sections: PdfSection[] = [
    {
      kind: 'kpis',
      beforeChart: true,
      tiles: [
        {
          label: t('insurances.kpi.monthly'),
          value: money(summary.monthlyTotal),
          highlight: true,
          hints:
            summary.statutoryCount > 0
              ? [
                  t('insurances.kpi.monthlyStatutory', {
                    amount: money(summary.monthlyStatutory),
                  }),
                ]
              : undefined,
        },
        { label: t('insurances.kpi.yearly'), value: money(summary.yearlyTotal) },
        {
          label: t('insurances.kpi.active'),
          value: String(summary.activeCount),
          hints:
            inactiveCount > 0
              ? [t('insurances.kpi.inactive', { count: inactiveCount })]
              : undefined,
        },
        next
          ? {
              label: t('insurances.kpi.next'),
              value: formatDateShort(next.date, lang),
              hints: [`${next.name} · ${daysLeftLabel(next.daysLeft, t)}`],
              warnBorder: next.withinWindow,
            }
          : { label: t('insurances.kpi.next'), value: t('insurances.kpi.none') },
      ],
    },
  ];

  if (axisBreak(breakdown)) {
    sections.push({ kind: 'text', text: t('insurances.chart.broken'), tone: 'warning' });
  }

  if (groups.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.export.pdf.summaryTitle'),
      startOnNewPage: false,
      columns: [
        { key: 'group', label: t('insurances.export.pdf.group'), format: 'text', width: '*' },
        {
          key: 'monthly',
          label: t('insurances.export.columns.monthly'),
          format: 'currency',
          width: 110,
        },
        {
          key: 'yearly',
          label: t('insurances.export.columns.yearly'),
          format: 'currency',
          width: 110,
        },
      ],
      rows: [
        ...groups.map((g) => ({
          cells: { group: t(`insurances.groups.${g.group}`), monthly: g.monthly, yearly: g.yearly },
        })),
        {
          cells: {
            group: t('insurances.export.pdf.totalLabel'),
            monthly: summary.monthlyTotal,
            yearly: summary.yearlyTotal,
          },
          emphasis: 'total' as const,
        },
      ],
    });
  }

  if (contractRows.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.export.pdf.contractsTitle'),
      columns: [
        { key: 'name', label: t('insurances.export.columns.name'), format: 'text', width: '*' },
        {
          key: 'type',
          label: t('insurances.export.columns.type'),
          format: 'text',
          width: '*',
          blankWhenMissing: true,
        },
        {
          key: 'status',
          label: t('insurances.export.columns.status'),
          format: 'text',
          width: 62,
          blankWhenMissing: true,
        },
        {
          key: 'interval',
          label: t('insurances.export.columns.interval'),
          format: 'text',
          width: 78,
          blankWhenMissing: true,
        },
        {
          key: 'premium',
          label: t('insurances.export.columns.premium'),
          format: 'currency',
          width: 64,
          blankWhenMissing: true,
        },
        {
          key: 'monthly',
          label: t('insurances.export.columns.monthly'),
          format: 'currency',
          width: 64,
        },
        {
          key: 'yearly',
          label: t('insurances.export.columns.yearly'),
          format: 'currency',
          width: 64,
        },
      ],
      rows: [
        ...groups.flatMap((g) => [
          {
            cells: {
              name: t(`insurances.groups.${g.group}`),
              type: null,
              status: null,
              interval: null,
              premium: null,
              monthly: g.monthly,
              yearly: g.yearly,
            },
            emphasis: 'total' as const,
          },
          ...g.rows.map((row) => ({
            cells: {
              name: row.name,
              type: t(`insurances.types.${row.typeId}`),
              status: t(row.active ? 'insurances.status.ACTIVE' : 'insurances.status.inactive'),
              interval: t(`insurances.intervals.${row.interval}`),
              premium: row.premium,
              monthly: row.active ? row.monthly : null,
              yearly: row.active ? row.yearly : null,
            },
            indentKeys: ['name'],
          })),
        ]),
        {
          cells: {
            name: t('insurances.export.pdf.totalLabel'),
            type: null,
            status: null,
            interval: null,
            premium: null,
            monthly: summary.monthlyTotal,
            yearly: summary.yearlyTotal,
          },
          emphasis: 'total' as const,
        },
      ],
    });
  }

  sections.push(...gapSections(report, t));
  const others = otherTypes(report);
  if (others.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.export.pdf.otherTitle'),
      subtitle: t('insurances.export.pdf.otherSubtitle'),
      startOnNewPage: false,
      columns: [
        { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text', width: '*' },
        { key: 'group', label: t('insurances.export.pdf.group'), format: 'text', width: 120 },
        { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text', width: 80 },
      ],
      rows: others.map((def) => ({
        cells: {
          name: t(`insurances.types.${def.id}`),
          group: t(`insurances.groups.${def.group}`),
          class: t(`insurances.classes.${def.classification}`),
        },
      })),
    });
  }
  return sections;
}

/** Types that are neither held as an active contract nor part of the gap check (so possibly overlooked). */
export function otherTypes(report: InsurancesReport): InsuranceTypeDef[] {
  const { gaps, contractRows } = report;
  const excluded = new Set<string>(contractRows.filter((r) => r.active).map((r) => r.typeId));
  const listed = new Set<string>(
    [...gaps.missing, ...gaps.covered, ...gaps.dismissed].map((g) => g.requirement),
  );
  for (const req of REQUIREMENTS) {
    if (listed.has(req.id)) for (const type of req.satisfiedBy) excluded.add(type);
  }
  return INSURANCE_TYPES.filter((def) => !def.social && !excluded.has(def.id));
}

/** The gap check as on screen: recommendations, covered, possible overlaps and hidden ones. */
function gapSections(report: InsurancesReport, t: Translate): PdfSection[] {
  const { gaps, contractRows } = report;
  const nameOf = (id: string) => contractRows.find((r) => r.id === id)?.name ?? '';
  const requirement = (item: GapItem) => t(`insurances.requirements.${item.requirement}.name`);
  const sections: PdfSection[] = [];

  if (gaps.missing.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.export.pdf.missingTitle'),
      subtitle: t('insurances.export.pdf.missingSubtitle'),
      columns: [
        { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text', width: 150 },
        { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text', width: 80 },
        { key: 'why', label: t('insurances.export.pdf.missingWhy'), format: 'text', width: '*' },
      ],
      rows: gaps.missing.map((m) => ({
        cells: {
          name: requirement(m),
          class: t(`insurances.classes.${m.classification}`),
          why: t(`insurances.requirements.${m.requirement}.why`),
        },
      })),
    });
  } else {
    sections.push({
      kind: 'text',
      title: t('insurances.export.pdf.missingTitle'),
      text: t('insurances.export.pdf.missingNone'),
    });
  }

  if (gaps.covered.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.gap.coveredTitle'),
      startOnNewPage: false,
      columns: [
        { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text', width: 200 },
        { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text', width: 80 },
        { key: 'by', label: t('insurances.export.pdf.coveredBy'), format: 'text', width: '*' },
      ],
      rows: gaps.covered.map((c) => ({
        cells: {
          name: requirement(c),
          class: t(`insurances.classes.${c.classification}`),
          by: c.linked ? t('insurances.gap.fromEarnings') : c.contractIds.map(nameOf).join(', '),
        },
      })),
    });
  } else {
    sections.push({
      kind: 'text',
      title: t('insurances.gap.coveredTitle'),
      text: t('insurances.gap.coveredEmpty'),
    });
  }

  if (gaps.redundant.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.gap.redundantTitle'),
      startOnNewPage: false,
      columns: [
        { key: 'text', label: t('insurances.export.pdf.overlap'), format: 'text', width: '*' },
      ],
      rows: gaps.redundant.map((r) => ({
        cells: {
          text: t(
            r.reason === 'COMBINATION'
              ? 'insurances.gap.redundantCombination'
              : 'insurances.gap.redundantIncluded',
            { name: nameOf(r.contractId), other: nameOf(r.otherContractId) },
          ),
        },
      })),
    });
  } else {
    sections.push({
      kind: 'text',
      title: t('insurances.gap.redundantTitle'),
      text: t('insurances.gap.redundantEmpty'),
    });
  }

  if (gaps.dismissed.length > 0) {
    sections.push({
      kind: 'table',
      title: t('insurances.gap.dismissedTitle'),
      startOnNewPage: false,
      columns: [
        { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text', width: '*' },
      ],
      rows: gaps.dismissed.map((d) => ({ cells: { name: requirement(d) } })),
    });
  }
  return sections;
}
