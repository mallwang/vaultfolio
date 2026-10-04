import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { createAccountOverviewExportDefinition } from './account-overview-export.definition';

/** Every field `AccountOverviewPageComponent`'s own row template binds (account-overview-page.component.ts). */
const ROW_FIELDS = [
  'name',
  'category',
  'status',
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

  it('covers every field visible in the Account Overview row (FR-007, SC-002)', () => {
    const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);

    const keys = definition.columns.map((column) => column.key);
    for (const field of ROW_FIELDS) {
      expect(keys).toContain(field);
    }
  });

  it('fetchData maps AccountOverviewEntry rows via GET /api/account-overview/accounts, resolving category/status to display text', async () => {
    const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);
    // toSignal() subscribes immediately on factory init — flush that background request first.
    httpMock.expectOne('/api/account-overview/accounts').flush([]);

    const rowsPromise = definition.fetchData();
    httpMock.expectOne('/api/account-overview/accounts').flush([account]);
    const rows = await rowsPromise;

    expect(rows).toHaveLength(1);
    expect(rows[0]['name']).toBe('N26 Checking');
    expect(rows[0]['provider']).toBe('N26');
    // Resolved via I18nService, not the raw enum value.
    expect(rows[0]['category']).not.toBe('SAVINGS');
    expect(rows[0]['status']).not.toBe('ACTIVE');
  });

  it('has no getChartOptions (no charts on Account Overview)', () => {
    const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);
    expect(definition.getChartOptions).toBeUndefined();
  });

  describe('getPdfSections', () => {
    async function sectionsFor(entries: AccountOverviewEntry[]) {
      const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);
      return pdfSectionsOf(definition, entries);
    }

    async function pdfSectionsOf(
      definition: ReturnType<typeof createAccountOverviewExportDefinition>,
      entries: AccountOverviewEntry[],
    ) {
      const httpMock = TestBed.inject(HttpTestingController);
      httpMock.expectOne('/api/account-overview/accounts').flush([]);
      const promise = definition.getPdfSections?.();
      httpMock.expectOne('/api/account-overview/accounts').flush(entries);
      return promise;
    }

    it('is portrait and returns no sections for an empty overview', async () => {
      const definition = TestBed.runInInjectionContext(createAccountOverviewExportDefinition);
      expect(definition.pdfOrientation).toBe('portrait');
      expect(await pdfSectionsOf(definition, [])).toEqual([]);
    });

    it('stacks the secondary fields into one details cell, skipping empty ones', async () => {
      const full: AccountOverviewEntry = {
        ...account,
        website: 'https://n26.com',
        cardUsage: 'Daily',
        cardNumber: '1234',
        validUntil: '12/30',
        notes: 'Main',
        requiredMinimum: '100.00',
      };
      const sections = await sectionsFor([full, account]);

      expect(sections).toHaveLength(1);
      const table = sections?.[0];
      if (table?.kind !== 'table') throw new Error('expected a table section');
      expect(table.columns.map((c) => c.key)).toContain('details');
      const [first, second] = table.rows;
      const lines = String(first.cells['details']).split('\n');
      expect(lines).toHaveLength(5);
      expect(lines[0]).toBe('https://n26.com');
      expect(lines[1]).toContain('Daily');
      expect(lines[4]).toContain('Main');
      expect(first.cells['requiredMinimum']).toBe('100.00');
      expect(second.cells['details']).toBe('');
    });
  });
});
