import type { PdfSection, PdfTableColumn, PdfTableRow } from '@vaultfolio/export';
import type {
  RetirementPillarSummary,
  RetirementSummary,
  RetirementSummaryItem,
} from '@vaultfolio/api-contract';
import { fill, formatDate, formatMoney } from './retirement-format';

type Translate = (key: string) => string;

/** The app's teal (teal-700) and orange (orange-400). */
const GUARANTEED_COLOR = '#0f766e';
const ADDITIONAL_COLOR = '#fb923c';

const PILLARS = ['statutory', 'occupational', 'private'] as const;
const EMPTY_KEYS = { statutory: 'Statutory', occupational: 'Occupational', private: 'Private' };

/**
 * Sections of the retirement PDF: the overview as a printable report — the four KPI tiles, the
 * guaranteed-vs-expected bar, one table per pillar and the hints — all taken from the same
 * summary the overview screen shows, so both always agree. Projections carry the "≈" prefix as on
 * screen.
 */
export function buildRetirementPdfSections(
  summary: RetirementSummary,
  t: Translate,
  lang: string,
): PdfSection[] {
  const money = (value: string) => formatMoney(value, lang);
  if (summary.items.length === 0) {
    return [{ kind: 'text', text: t('retirement.overview.empty.body') }];
  }

  const expected = Number(summary.expectedMonthly);
  const guaranteedShare =
    expected > 0 ? Math.min(1, Math.max(0, Number(summary.guaranteedMonthly) / expected)) : 0;
  const earlier = summary.items.filter((i) => i.startRelation === 'EARLIER').length;
  const later = summary.items.filter((i) => i.startRelation === 'LATER').length;

  const startHints = summary.pensionStart
    ? [
        t(
          summary.pensionStart.source === 'STATUTORY'
            ? 'retirement.overview.kpi.startStatutory'
            : 'retirement.overview.kpi.startEarliest',
        ),
      ]
    : [];
  if (earlier > 0) {
    startHints.push(fill(t('retirement.overview.kpi.startEarlier'), { n: earlier }));
  }
  if (later > 0) startHints.push(fill(t('retirement.overview.kpi.startLater'), { n: later }));

  const sections: PdfSection[] = [
    {
      kind: 'kpis',
      tiles: [
        {
          label: t('retirement.overview.kpi.expected'),
          value: `≈ ${money(summary.expectedMonthly)}`,
          hints: [
            `${t('retirement.labels.projection')} · ${t('retirement.overview.kpi.expectedHint')}`,
          ],
          highlight: true,
          italic: true,
        },
        {
          label: t('retirement.overview.kpi.guaranteed'),
          value: money(summary.guaranteedMonthly),
          hints: [t('retirement.overview.kpi.guaranteedHint')],
        },
        {
          label: t('retirement.overview.kpi.savings'),
          value: money(summary.monthlySavings),
          hints: [t('retirement.overview.kpi.savingsHint')],
        },
        {
          label: t('retirement.overview.kpi.start'),
          value: summary.pensionStart ? formatDate(summary.pensionStart.date, lang) : '–',
          hints: startHints,
        },
      ],
    },
  ];

  if (expected > 0) {
    sections.push({
      kind: 'bar',
      title: t('retirement.overview.bar.title'),
      caption: fill(t('retirement.overview.bar.difference'), {
        amount: money(summary.differenceMonthly),
      }),
      segments: [
        {
          label: `${t('retirement.overview.bar.guaranteed')} (${money(summary.guaranteedMonthly)})`,
          share: guaranteedShare,
          color: GUARANTEED_COLOR,
        },
        {
          label: t('retirement.overview.bar.additional'),
          share: 1 - guaranteedShare,
          color: ADDITIONAL_COLOR,
        },
      ],
    });
  }

  for (const key of PILLARS) {
    sections.push(...pillarSections(key, summary.pillars[key], t, lang));
  }

  const notes: string[] = [];
  if (summary.flags.outdatedCount > 0) {
    notes.push(fill(t('retirement.overview.notes.outdated'), { n: summary.flags.outdatedCount }));
  }
  if (summary.flags.incompleteCount > 0) {
    notes.push(
      fill(t('retirement.overview.notes.incomplete'), { n: summary.flags.incompleteCount }),
    );
  }
  notes.push(t('retirement.overview.notes.capital'));
  sections.push({ kind: 'text', text: notes.join('\n') });
  return sections;
}

function pillarSections(
  key: (typeof PILLARS)[number],
  pillar: RetirementPillarSummary,
  t: Translate,
  lang: string,
): PdfSection[] {
  const title = t(`retirement.pillars.${key}`);
  if (pillar.count === 0) {
    return [
      {
        kind: 'text',
        title,
        text: t(`retirement.overview.pillar.empty${EMPTY_KEYS[key]}`),
      },
    ];
  }
  const money = (value: string) => formatMoney(value, lang);
  const columns: PdfTableColumn[] = [
    { key: 'contract', label: t('retirementExport.columnType'), format: 'text', width: '*' },
    { key: 'hints', label: t('retirementExport.columnOrigin'), format: 'text', width: 80 },
    {
      key: 'guaranteed',
      label: t('retirement.overview.pillar.guaranteed'),
      format: 'text',
      width: 70,
      align: 'right',
    },
    {
      key: 'expected',
      label: t('retirement.overview.pillar.expected'),
      format: 'text',
      width: 70,
      align: 'right',
    },
    {
      key: 'start',
      label: t('retirementExport.columnPayoutStart'),
      format: 'text',
      width: 78,
      align: 'right',
    },
  ];
  const itemRow = (item: RetirementSummaryItem): PdfTableRow => ({
    cells: {
      contract: item.providerLabel ?? t(`retirement.types.${item.contractType}`),
      hints: badges(item, t),
      guaranteed: Number(item.guaranteedMonthly) > 0 ? money(item.guaranteedMonthly) : '–',
      expected: expectedCell(item, t, lang),
      start: formatDate(item.payoutStart, lang),
    },
  });
  return [
    {
      kind: 'table',
      title,
      subtitle: fill(t('retirement.overview.pillar.entries'), { n: pillar.count }),
      columns,
      rows: [
        ...pillar.items.map(itemRow),
        {
          cells: {
            contract:
              t('retirement.overview.pillar.guaranteed') +
              ' / ' +
              t('retirement.overview.pillar.expected'),
            hints: '',
            guaranteed: money(pillar.guaranteedMonthly),
            expected: `≈ ${money(pillar.expectedMonthly)}`,
            start: '',
          },
          emphasis: 'total',
        },
      ],
      fontSize: 8,
      startOnNewPage: false,
    },
  ];
}

/** Projection when there is one, else the capital figure, else a dash. */
function expectedCell(item: RetirementSummaryItem, t: Translate, lang: string): string {
  if (Number(item.expectedMonthly) > 0) return `≈ ${formatMoney(item.expectedMonthly, lang)}`;
  if (item.capital === null) return '–';
  return `${t('retirement.overview.pillar.capital')} ${formatMoney(item.capital, lang)}`;
}

function badges(item: RetirementSummaryItem, t: Translate): string {
  return [
    t(item.origin === 'IMPORTED' ? 'retirement.badges.imported' : 'retirement.badges.manual'),
    ...(item.outdated ? [t('retirement.badges.outdated')] : []),
    ...(item.incomplete ? [t('retirement.badges.incomplete')] : []),
  ].join(' · ');
}
