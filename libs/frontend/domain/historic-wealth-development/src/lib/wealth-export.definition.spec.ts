import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { WealthStore } from './wealth-store';
import { createWealthExportDefinition } from './wealth-export.definition';

const snap = (id: string, date: string, assets: string): WealthSnapshot => ({
  id,
  snapshotDate: date,
  entries: [
    { side: 'ASSET', class: { standard: 'cash' }, name: 'Giro', amount: assets },
    { side: 'LIABILITY', class: { standard: 'loan' }, name: 'K', amount: '100.00' },
  ],
  createdAt: '',
  updatedAt: '',
});

describe('createWealthExportDefinition', () => {
  let http: HttpTestingController;
  let definition: FeatureExportDefinition;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    definition = TestBed.runInInjectionContext(() => createWealthExportDefinition());
  });

  function answer(snapshots: WealthSnapshot[] | number) {
    const list = http.expectOne('/api/wealth/snapshots');
    if (typeof snapshots === 'number') {
      list.flush({ error: 'X' }, { status: snapshots, statusText: 'x' });
      return;
    }
    list.flush(snapshots);
    http.expectOne('/api/wealth/settings').flush({ classGroups: [] });
  }

  it('identifies the feature and reads like a section report', () => {
    expect(definition.featureId).toBe('historic-wealth-development');
    expect(definition.titleKey).toBe('wealth.export.title');
    expect(definition.columns).toEqual([]);
    expect(definition.pdfChartSize).toEqual({ width: 1000, height: 230 });
  });

  it('builds sections, the chart and the data tables from one load each', async () => {
    const sections = definition.getPdfSections?.();
    answer([snap('a', '2024-01-31', '1000.00'), snap('b', '2025-01-31', '1500.00')]);
    expect((await sections)?.map((s) => s.kind)).toEqual([
      'text',
      'kpis',
      'table',
      'table',
      'table',
    ]);
    const charts = definition.getChartOptions?.() ?? [];
    expect(charts).toHaveLength(1);
    const series = (charts[0]['series'] as { type: string }[]).map((s) => s.type);
    expect(series).toContain('line');

    const tables = definition.getExportTables?.();
    answer([snap('a', '2024-01-31', '1000.00')]);
    expect((await tables)?.map((t) => t.id)).toEqual(['entries', 'totals', 'balance']);
  });

  it('follows the period filter in the PDF but not in the data tables', async () => {
    TestBed.inject(WealthStore).period.set('1y');
    const sections = definition.getPdfSections?.();
    answer([snap('a', '2020-01-31', '1.00'), snap('b', '2025-06-30', '2.00')]);
    const snapshotTable = (await sections)?.filter((s) => s.kind === 'table')[1] as {
      rows: unknown[];
    };
    expect(snapshotTable.rows).toHaveLength(1);
    const tables = definition.getExportTables?.();
    answer([snap('a', '2020-01-31', '1.00'), snap('b', '2025-06-30', '2.00')]);
    expect((await tables)?.[1].rows).toHaveLength(2);
  });

  it('yields an explanation and no chart without snapshots', async () => {
    const sections = definition.getPdfSections?.();
    answer([]);
    expect(await sections).toEqual([
      { kind: 'text', text: 'There are no snapshots to export yet.' },
    ]);
    expect(definition.getChartOptions?.()).toEqual([]);
  });

  it('yields empty output on 403 and 503', async () => {
    for (const status of [403, 503]) {
      const tables = definition.getExportTables?.();
      answer(status);
      const [entries, totals] = (await tables) ?? [];
      expect(entries.rows).toEqual([]);
      expect(totals.rows).toEqual([]);
    }
  });

  it('is enabled until the page has shown there is nothing to export', () => {
    expect(definition.isEnabled?.()).toBe(true);
    const store = TestBed.inject(WealthStore);
    store.refresh();
    answer([]);
    expect(definition.isEnabled?.()).toBe(false);
    expect(definition.disabledTooltipKey).toBe('wealth.export.unavailable');
    store.refresh();
    answer([snap('a', '2025-01-01', '1.00')]);
    expect(definition.isEnabled?.()).toBe(true);
  });
});
