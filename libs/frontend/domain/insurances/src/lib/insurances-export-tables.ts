import type { ExportTable } from '@vaultfolio/export';
import { isSocialType, paymentsPerYear } from '@vaultfolio/insurances';
import { otherTypes, rowsByGroup, type InsurancesReport } from './insurances-pdf-sections';
import type { Translate } from './insurances-view';

/**
 * Tables for JSON, CSV and Excel with the same content as the PDF: key figures, cost per group,
 * every contract, and the gap check (recommendations, covered, overlaps, hidden, other types).
 * In Excel the yearly and monthly cost of a contract are formulas over premium and payments per
 * year; the group and contract tables close with a SUM row.
 */
export function buildInsurancesExportTables(report: InsurancesReport, t: Translate): ExportTable[] {
  const { summary, gaps, contractRows } = report;
  const groups = rowsByGroup(contractRows);
  const nameOf = (id: string) => contractRows.find((r) => r.id === id)?.name ?? '';
  const requirement = (item: { requirement: string }) =>
    t(`insurances.requirements.${item.requirement}.name`);
  const activeLabel = t('insurances.status.ACTIVE');
  const next = summary.upcoming[0];
  const inactiveCount = contractRows.filter(
    (r) => r.kind === 'CONTRACT' && !r.active && !isSocialType(r.typeId),
  ).length;

  const figures: ExportTable = {
    id: 'figures',
    title: t('insurances.export.tables.figures'),
    columns: [
      { key: 'monthly', label: t('insurances.kpi.monthly'), format: 'money' },
      {
        key: 'monthlyStatutory',
        label: t('insurances.export.columns.monthlyStatutory'),
        format: 'money',
      },
      { key: 'yearly', label: t('insurances.kpi.yearly'), format: 'money' },
      { key: 'active', label: t('insurances.kpi.active'), format: 'integer' },
      {
        key: 'inactive',
        label: t('insurances.export.columns.inactive'),
        format: 'integer',
      },
      { key: 'nextDate', label: t('insurances.kpi.next'), format: 'date' },
      { key: 'nextName', label: t('insurances.export.columns.nextName'), format: 'text' },
    ],
    rows: [
      {
        cells: {
          monthly: summary.monthlyTotal,
          monthlyStatutory: summary.monthlyStatutory,
          yearly: summary.yearlyTotal,
          active: summary.activeCount,
          inactive: inactiveCount,
          nextDate: next?.date ?? null,
          nextName: next?.name ?? null,
        },
      },
    ],
  };

  const byGroup: ExportTable = {
    id: 'groups',
    title: t('insurances.export.pdf.summaryTitle'),
    emptyText: t('insurances.export.empty.contracts'),
    totalKey: 'groupsTotal',
    columns: [
      { key: 'group', label: t('insurances.export.pdf.group'), format: 'text' },
      {
        key: 'monthly',
        label: t('insurances.export.columns.monthly'),
        format: 'money',
        sumInTotal: true,
      },
      {
        key: 'yearly',
        label: t('insurances.export.columns.yearly'),
        format: 'money',
        sumInTotal: true,
      },
    ],
    rows: [
      ...groups.map((g) => ({
        cells: { group: t(`insurances.groups.${g.group}`), monthly: g.monthly, yearly: g.yearly },
      })),
      ...(groups.length > 0
        ? [
            {
              cells: {
                group: t('insurances.export.pdf.totalLabel'),
                monthly: summary.monthlyTotal,
                yearly: summary.yearlyTotal,
              },
              emphasis: 'total' as const,
            },
          ]
        : []),
    ],
  };

  const contracts: ExportTable = {
    id: 'contracts',
    title: t('insurances.export.pdf.contractsTitle'),
    emptyText: t('insurances.export.empty.contracts'),
    totalKey: 'contractsTotal',
    columns: [
      { key: 'group', label: t('insurances.export.pdf.group'), format: 'text' },
      { key: 'type', label: t('insurances.export.columns.type'), format: 'text' },
      { key: 'name', label: t('insurances.export.columns.name'), format: 'text' },
      { key: 'insurer', label: t('insurances.export.columns.insurer'), format: 'text' },
      { key: 'status', label: t('insurances.export.columns.status'), format: 'text' },
      { key: 'interval', label: t('insurances.export.columns.interval'), format: 'text' },
      {
        key: 'paymentsPerYear',
        label: t('insurances.export.columns.paymentsPerYear'),
        format: 'integer',
      },
      { key: 'premium', label: t('insurances.export.columns.premium'), format: 'money' },
      {
        key: 'monthly',
        label: t('insurances.export.columns.monthly'),
        format: 'money',
        formula: 'IF({yearly}="","",ROUND({yearly}/12,2))',
        sumInTotal: true,
      },
      {
        key: 'yearly',
        label: t('insurances.export.columns.yearly'),
        format: 'money',
        formula: `IF({status}="${activeLabel.replaceAll('"', '""')}",{premium}*{paymentsPerYear},"")`,
        sumInTotal: true,
      },
      { key: 'next', label: t('insurances.export.columns.next'), format: 'date' },
      { key: 'source', label: t('insurances.export.columns.source'), format: 'text' },
    ],
    rows: [
      ...groups.flatMap((g) =>
        g.rows.map((row) => ({
          cells: {
            group: t(`insurances.groups.${g.group}`),
            type: t(`insurances.types.${row.typeId}`),
            name: row.name,
            insurer: row.insurer ?? null,
            status: t(row.active ? 'insurances.status.ACTIVE' : 'insurances.status.inactive'),
            interval: t(`insurances.intervals.${row.interval}`),
            paymentsPerYear: paymentsPerYear(row.interval),
            premium: row.premium,
            // Costs count active contracts only, as in the PDF.
            monthly: row.active ? row.monthly : null,
            yearly: row.active ? row.yearly : null,
            next: row.info.kind === 'DEADLINE' || row.info.kind === 'ENDS' ? row.info.date : null,
            source: t(
              row.kind === 'LINKED'
                ? 'insurances.export.source.earnings'
                : 'insurances.export.source.manual',
            ),
          },
        })),
      ),
      ...(contractRows.length > 0
        ? [
            {
              cells: {
                name: t('insurances.export.pdf.totalLabel'),
                monthly: summary.monthlyTotal,
                yearly: summary.yearlyTotal,
              },
              emphasis: 'total' as const,
            },
          ]
        : []),
    ],
  };

  const recommendations: ExportTable = {
    id: 'recommendations',
    title: t('insurances.export.pdf.missingTitle'),
    emptyText: t('insurances.export.pdf.missingNone'),
    columns: [
      { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text' },
      { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text' },
      { key: 'why', label: t('insurances.export.pdf.missingWhy'), format: 'text' },
    ],
    rows: gaps.missing.map((m) => ({
      cells: {
        name: requirement(m),
        class: t(`insurances.classes.${m.classification}`),
        why: t(`insurances.requirements.${m.requirement}.why`),
      },
    })),
  };

  const covered: ExportTable = {
    id: 'covered',
    title: t('insurances.gap.coveredTitle'),
    emptyText: t('insurances.gap.coveredEmpty'),
    columns: [
      { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text' },
      { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text' },
      { key: 'by', label: t('insurances.export.pdf.coveredBy'), format: 'text' },
    ],
    rows: gaps.covered.map((c) => ({
      cells: {
        name: requirement(c),
        class: t(`insurances.classes.${c.classification}`),
        by: c.linked ? t('insurances.gap.fromEarnings') : c.contractIds.map(nameOf).join(', '),
      },
    })),
  };

  const overlaps: ExportTable = {
    id: 'overlaps',
    title: t('insurances.gap.redundantTitle'),
    emptyText: t('insurances.gap.redundantEmpty'),
    columns: [
      { key: 'name', label: t('insurances.export.columns.name'), format: 'text' },
      { key: 'other', label: t('insurances.export.columns.overlapWith'), format: 'text' },
      { key: 'text', label: t('insurances.export.pdf.overlap'), format: 'text' },
    ],
    rows: gaps.redundant.map((r) => ({
      cells: {
        name: nameOf(r.contractId),
        other: nameOf(r.otherContractId),
        text: t(
          r.reason === 'COMBINATION'
            ? 'insurances.gap.redundantCombination'
            : 'insurances.gap.redundantIncluded',
          { name: nameOf(r.contractId), other: nameOf(r.otherContractId) },
        ),
      },
    })),
  };

  const other: ExportTable = {
    id: 'other',
    title: t('insurances.export.pdf.otherTitle'),
    emptyText: t('insurances.export.empty.other'),
    columns: [
      { key: 'name', label: t('insurances.export.pdf.missingName'), format: 'text' },
      { key: 'group', label: t('insurances.export.pdf.group'), format: 'text' },
      { key: 'class', label: t('insurances.export.pdf.missingClass'), format: 'text' },
    ],
    rows: otherTypes(report).map((def) => ({
      cells: {
        name: t(`insurances.types.${def.id}`),
        group: t(`insurances.groups.${def.group}`),
        class: t(`insurances.classes.${def.classification}`),
      },
    })),
  };

  return [figures, byGroup, contracts, recommendations, covered, overlaps, other];
}
