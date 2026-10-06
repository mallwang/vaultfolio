import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { createAccountOverviewExportDefinition } from './account-overview-export.definition';

/** Every field `AccountOverviewPageComponent`'s own row template binds, minus the status (one table per status). */
const ROW_FIELDS = [
  'name',
  'category',
  'provider',
  'website',
  'purpose',
  'cardUsage',
  'requiredMinimum',
  'cardNumber',
  'validUntil',
  'notes',
];

const account: AccountOverviewEntry = {
  id: 'acc-1',
  name: 'N26 Checking',
  category: 'SAVINGS',
  status: 'ACTIVE',
  provider: 'N26',
  website: null,
  purpose: null,
  cardUsage: null,
  requiredMinimum: null,
  notes: null,
  cardNumber: null,
  validUntil: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('createAccountOverviewExportDefinition', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function setup() {
    const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);
    return { definition, httpMock: TestBed.inject(HttpTestingController) };
  }

  const decommissioned: AccountOverviewEntry = {
    ...account,
    id: 'acc-2',
    name: 'Old depot',
    category: 'DEPOT',
    status: 'DECOMMISSIONED',
  };

  it('has no getChartOptions (no charts on Account Overview)', () => {
    expect(setup().definition.getChartOptions).toBeUndefined();
  });

  it('serves the data formats from getExportTables, so the generic row table is empty', async () => {
    const { definition } = setup();
    expect(definition.columns).toEqual([]);
    expect(await definition.fetchData()).toEqual([]);
  });

  describe('getExportTables', () => {
    async function tablesFor(entries: AccountOverviewEntry[]) {
      const { definition, httpMock } = setup();
      const promise = definition.getExportTables?.();
      httpMock.expectOne('/api/account-overview/accounts').flush(entries);
      return promise;
    }

    it('returns one table for active and one for decommissioned accounts with every field', async () => {
      const tables = await tablesFor([account, decommissioned]);

      expect(tables?.map((t) => t.id)).toEqual(['active', 'decommissioned']);
      expect(tables?.[0].columns.map((c) => c.key)).toEqual(ROW_FIELDS);
      expect(tables?.[0].rows).toHaveLength(1);
      expect(tables?.[0].rows[0].cells['name']).toBe('N26 Checking');
      // Category is a resolved display text column, not a separate table.
      expect(tables?.[0].rows[0].cells['category']).not.toBe('SAVINGS');
      expect(tables?.[1].rows[0].cells['name']).toBe('Old depot');
    });

    it('keeps an empty table when a status has no accounts', async () => {
      const tables = await tablesFor([account]);
      expect(tables?.[1].rows).toEqual([]);
      expect(tables?.[1].emptyText).toBeTruthy();
    });

    it('orders accounts by category within a status', async () => {
      const general = { ...account, id: 'g', name: 'Giro', category: 'GENERAL' as const };
      const tables = await tablesFor([account, general]);
      expect(tables?.[0].rows.map((r) => r.cells['name'])).toEqual(['Giro', 'N26 Checking']);
    });
  });

  describe('getPdfSections', () => {
    async function sectionsFor(entries: AccountOverviewEntry[]) {
      const { definition, httpMock } = setup();
      const promise = definition.getPdfSections?.();
      httpMock.expectOne('/api/account-overview/accounts').flush(entries);
      return promise;
    }

    it('uses the default landscape page and returns no sections for an empty overview', async () => {
      expect(setup().definition.pdfOrientation).toBeUndefined();
      expect(await sectionsFor([])).toEqual([]);
    });

    it('returns a table per non-empty status with one column per field', async () => {
      const sections = await sectionsFor([account, decommissioned]);
      expect(sections).toHaveLength(2);
      for (const section of sections ?? []) {
        if (section.kind !== 'table') throw new Error('expected a table section');
        expect(section.columns.map((c) => c.key).sort()).toEqual([...ROW_FIELDS].sort());
        expect(section.rows).toHaveLength(1);
      }
    });

    it('omits the decommissioned table when there are none', async () => {
      const sections = await sectionsFor([account]);
      expect(sections).toHaveLength(1);
    });
  });
});
