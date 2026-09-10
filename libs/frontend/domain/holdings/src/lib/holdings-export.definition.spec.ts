import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { createHoldingsExportDefinition } from './holdings-export.definition';

/** Every field `HoldingsComponent`'s own table binds per row (holdings.component.ts). */
const TABLE_FIELDS = [
  'assetType',
  'name',
  'management',
  'quantity',
  'weightGrams',
  'purchasePrice',
  'currentValue',
  'purchaseDate',
];

const holding: HoldingResponse = {
  id: 'etf-1',
  assetType: 'ETF',
  management: 'Roboadvisor',
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  quantity: '12.5',
  purchasePrice: '78.42',
  purchaseDate: null,
  weightGrams: null,
  currentValue: null,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

describe('createHoldingsExportDefinition', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('covers every field visible in the Holdings table (FR-007, SC-002)', () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);

    const keys = definition.columns.map((column) => column.key);
    for (const field of TABLE_FIELDS) {
      expect(keys).toContain(field);
    }
  });

  it('fetchData maps HoldingResponse rows to ExportRow via GET /api/holdings', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const rowsPromise = definition.fetchData();
    httpMock.expectOne('/api/holdings').flush([holding]);
    const rows = await rowsPromise;

    expect(rows).toEqual([
      {
        assetType: 'ETF',
        name: 'iShares Core MSCI World',
        isin: 'IE00B4L5Y983',
        management: 'Roboadvisor',
        quantity: '12.5',
        weightGrams: null,
        purchasePrice: '78.42',
        currentValue: null,
        purchaseDate: null,
      },
    ]);
  });

  it('getChartOptions returns exactly 1 distribution chart after fetchData', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const rowsPromise = definition.fetchData();
    httpMock.expectOne('/api/holdings').flush([holding]);
    await rowsPromise;

    const options = definition.getChartOptions?.() ?? [];
    expect(options).toHaveLength(1);
  });

  it('getChartSideTable returns sectionTitle and one row per distinct assetType', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const rowsPromise = definition.fetchData();
    httpMock.expectOne('/api/holdings').flush([holding]);
    await rowsPromise;

    const sideTable = definition.getChartSideTable?.();
    expect(sideTable?.sectionTitle).toBeTruthy();
    expect(sideTable?.rows).toHaveLength(1);
    expect(sideTable?.rows[0].percentage).toBeCloseTo(100, 1);
  });
});
