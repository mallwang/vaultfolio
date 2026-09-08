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
});
