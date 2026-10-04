import type { RetirementSummary, RetirementSummaryItem } from '@vaultfolio/api-contract';
import { buildRetirementPdfSections } from './retirement-pdf-sections';

const t = (key: string) => key;

function item(over: Partial<RetirementSummaryItem> = {}): RetirementSummaryItem {
  return {
    id: 'a',
    pillar: 'PRIVATE',
    contractType: 'RIESTER',
    origin: 'MANUAL',
    providerLabel: 'Acme',
    guaranteedMonthly: '100.00',
    expectedMonthly: '150.00',
    capital: null,
    payoutStart: '2045-01-01',
    startRelation: 'SAME',
    outdated: false,
    incomplete: false,
    ...over,
  };
}

const pillar = (items: RetirementSummaryItem[]) => ({
  count: items.length,
  guaranteedMonthly: '100.00',
  expectedMonthly: '150.00',
  items,
});

function summary(over: Partial<RetirementSummary> = {}): RetirementSummary {
  const a = item();
  return {
    expectedMonthly: '200.00',
    guaranteedMonthly: '50.00',
    differenceMonthly: '150.00',
    monthlySavings: '60.00',
    pensionStart: { date: '2045-01-01', source: 'STATUTORY' },
    capital: { total: '0.00', items: [] },
    pillars: { statutory: pillar([]), occupational: pillar([]), private: pillar([a]) },
    flags: { outdatedCount: 0, incompleteCount: 0 },
    items: [a],
    ...over,
  };
}

describe('buildRetirementPdfSections', () => {
  it('leads with the four KPI tiles and the guaranteed share bar', () => {
    const [kpis, bar] = buildRetirementPdfSections(summary(), t, 'de');
    expect(kpis).toMatchObject({ kind: 'kpis' });
    expect((kpis as { tiles: unknown[] }).tiles).toHaveLength(4);
    expect(bar).toMatchObject({ kind: 'bar' });
    expect((bar as { segments: { share: number }[] }).segments.map((s) => s.share)).toEqual([
      0.25, 0.75,
    ]);
  });

  it('omits the bar without a projection', () => {
    const sections = buildRetirementPdfSections(summary({ expectedMonthly: '0.00' }), t, 'de');
    expect(sections.some((s) => s.kind === 'bar')).toBe(false);
  });

  it('lists a table for a filled pillar and a text for an empty one', () => {
    const sections = buildRetirementPdfSections(summary(), t, 'de');
    const tables = sections.filter((s) => s.kind === 'table');
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ title: 'retirement.pillars.private' });
    const empty = sections.find(
      (s) => s.kind === 'text' && s.title === 'retirement.pillars.statutory',
    );
    expect(empty).toMatchObject({ text: 'retirement.overview.pillar.emptyStatutory' });
  });

  it('marks outdated/incomplete entries and appends a total row', () => {
    const sections = buildRetirementPdfSections(
      summary({
        pillars: {
          statutory: pillar([]),
          occupational: pillar([]),
          private: pillar([item({ outdated: true, incomplete: true })]),
        },
        flags: { outdatedCount: 1, incompleteCount: 1 },
      }),
      t,
      'en',
    );
    const table = sections.find((s) => s.kind === 'table');
    if (table?.kind !== 'table') throw new Error('table expected');
    expect(table.rows[0].cells['hints']).toBe(
      'retirement.badges.manual · retirement.badges.outdated · retirement.badges.incomplete',
    );
    expect(table.rows.at(-1)?.emphasis).toBe('total');
    const notes = sections.at(-1);
    expect(notes).toMatchObject({ kind: 'text' });
    expect((notes as { text: string }).text.split('\n')).toHaveLength(3);
  });

  it('shows the capital figure for an item without a monthly amount', () => {
    const sections = buildRetirementPdfSections(
      summary({
        pillars: {
          statutory: pillar([]),
          occupational: pillar([]),
          private: pillar([item({ expectedMonthly: '0.00', capital: '5000.00' })]),
        },
      }),
      t,
      'en',
    );
    const table = sections.find((s) => s.kind === 'table');
    if (table?.kind !== 'table') throw new Error('table expected');
    expect(table.rows[0].cells['expected']).toContain('5,000.00');
  });

  it('is a single hint for an empty summary', () => {
    const sections = buildRetirementPdfSections(summary({ items: [] }), t, 'de');
    expect(sections).toEqual([{ kind: 'text', text: 'retirement.overview.empty.body' }]);
  });
});
