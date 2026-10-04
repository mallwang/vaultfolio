import type { PdfSection } from '@vaultfolio/export';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';
import {
  buildWealthExportTables,
  buildWealthPdfSections,
  emptyWealthPdfSections,
} from './wealth-report';

const tr = (dict: TranslationDictionary) => (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as TranslationDictionary)?.[part], dict) as string;

const t = tr(en);
const none: WealthSettings = { classGroups: [] };

const snap = (id: string, date: string, extra: WealthSnapshot['entries'] = []): WealthSnapshot => ({
  id,
  snapshotDate: date,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'Giro', amount: '1000.00' },
    { side: 'LIABILITY', class: { standard: 'mortgage' }, name: 'Haus', amount: '400.00' },
    ...extra,
  ],
  createdAt: '',
  updatedAt: '',
});

const older = snap('a', '2025-01-31');
const newer = snap('b', '2025-06-30', [
  { side: 'ASSET', class: { custom: 'Whisky' }, name: 'Fass', amount: '500.00' },
]);

const tables = (sections: PdfSection[]) =>
  sections.filter((s): s is Extract<PdfSection, { kind: 'table' }> => s.kind === 'table');

describe('buildWealthPdfSections', () => {
  const sections = buildWealthPdfSections([newer, older], none, '3y', t, 'en');

  it('orders period, KPIs, class table, snapshot table and the balance sheet', () => {
    expect(sections.map((s) => s.kind)).toEqual(['text', 'kpis', 'table', 'table', 'table']);
    expect((sections[0] as { text: string }).text).toBe('Period: 3 years');
    expect(tables(sections).map((s) => s.title)).toEqual([
      'Latest snapshot by class',
      'Snapshots',
      'Balance sheet as of June 30, 2025',
    ]);
  });

  it('shows the same KPI figures as the screen derivations', () => {
    const kpis = sections[1] as Extract<PdfSection, { kind: 'kpis' }>;
    expect(kpis.tiles[0]).toMatchObject({
      label: 'Net worth',
      value: '€1,100.00',
      highlight: true,
    });
    expect(kpis.tiles[1].value).toBe('+€500.00');
    expect(kpis.tiles[1].hints?.[0]).toContain('+83.3%');
    expect(kpis.tiles[2].value).toBe('€1,500.00');
    expect(kpis.tiles[3].value).toBe('€400.00');
  });

  it('lists the latest snapshot by class with share and change, assets before liabilities', () => {
    const rows = tables(sections)[0].rows;
    expect(rows.map((r) => r.cells['class'])).toEqual(['Cash', 'Whisky', 'Mortgage']);
    expect(rows[0].cells).toMatchObject({ amount: '1000.00', share: 1000 / 1500, change: '0.00' });
    expect(rows[1].cells['change']).toBe('500.00');
    expect(rows[2].cells['side']).toBe('Liability');
  });

  it('lists snapshots newest first with the oldest change empty', () => {
    const rows = tables(sections)[1].rows;
    expect(rows.map((r) => r.cells['date'])).toEqual(['June 30, 2025', 'January 31, 2025']);
    expect(rows[0].cells).toMatchObject({ net: '1100.00', delta: '500.00' });
    expect(rows[1].cells['delta']).toBeNull();
  });

  it('builds a balance table whose last row sums equal on both sides', () => {
    const balance = tables(sections)[2];
    expect(balance.startOnNewPage).toBe(true);
    const last = balance.rows[balance.rows.length - 1];
    expect(last.emphasis).toBe('total');
    expect(last.cells['assetAmount']).toBe('1500.00');
    expect(last.cells['passivaAmount']).toBe('1500.00');
    const headers = balance.rows.filter((r) => r.emphasis === 'total').length;
    expect(headers).toBeGreaterThan(2);
    const labels = balance.rows.map((r) => `${r.cells['assetLabel']}|${r.cells['passivaLabel']}`);
    expect(labels[0]).toBe('Liquid assets|Equity (net worth)');
    expect(balance.rows[0].cells['passivaAmount']).toBe('1100.00');
  });

  it('is language-aware and falls back to a text section without snapshots', () => {
    const german = buildWealthPdfSections([newer], none, 'all', tr(de), 'de');
    expect(tables(german)[0].title).toBe('Letzter Stichtag nach Klasse');
    expect(buildWealthPdfSections([], none, 'all', t, 'en')).toEqual(emptyWealthPdfSections(t));
    expect(emptyWealthPdfSections(t)[0]).toEqual({
      kind: 'text',
      text: 'There are no snapshots to export yet.',
    });
  });

  it('omits the change columns for a single snapshot', () => {
    const single = buildWealthPdfSections([older], none, 'all', t, 'en');
    const kpis = single[1] as Extract<PdfSection, { kind: 'kpis' }>;
    expect(kpis.tiles[1].value).toBe('–');
    expect(tables(single)[0].rows[0].cells['change']).toBeNull();
  });
});

describe('buildWealthExportTables', () => {
  const settings: WealthSettings = {
    classGroups: [{ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' }],
  };
  const [entries, totals] = buildWealthExportTables([newer, older], settings, t);

  it('flattens every entry with side, class, amount and balance group in date order', () => {
    expect(entries.id).toBe('entries');
    expect(entries.rows).toHaveLength(5);
    expect(entries.rows[0].cells).toEqual({
      date: '2025-01-31',
      side: 'Asset',
      class: 'Cash',
      name: 'Giro',
      amount: '1000.00',
      balanceGroup: 'Liquid assets',
    });
    expect(entries.rows[4].cells).toMatchObject({
      class: 'Whisky',
      balanceGroup: 'Tangible assets',
    });
  });

  it('gives the totals per snapshot with exact change and ratio', () => {
    expect(totals.id).toBe('totals');
    expect(totals.rows.map((r) => r.cells)).toEqual([
      {
        date: '2025-01-31',
        assets: '1000.00',
        liabilities: '400.00',
        net: '600.00',
        change: null,
        changeRatio: null,
      },
      {
        date: '2025-06-30',
        assets: '1500.00',
        liabilities: '400.00',
        net: '1100.00',
        change: '500.00',
        changeRatio: '0.8333',
      },
    ]);
    expect(totals.columns.find((c) => c.key === 'changeRatio')?.format).toBe('ratio');
  });

  it('is empty without snapshots', () => {
    const [e, tt] = buildWealthExportTables([], none, t);
    expect(e.rows).toEqual([]);
    expect(tt.rows).toEqual([]);
  });
});
