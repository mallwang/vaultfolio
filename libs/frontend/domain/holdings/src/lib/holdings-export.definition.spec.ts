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
  note: null,
  metal: null,
  coinId: null,
  unit: null,
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

  it('has exactly the T058 columns in order, without weightGrams', () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);

    expect(definition.columns.map((column) => column.key)).toEqual([
      'assetType',
      'isin',
      'name',
      'metal',
      'coin',
      'quantity',
      'unit',
      'purchasePrice',
      'purchaseDate',
      'currentValue',
      'management',
      'note',
    ]);
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
        isin: 'IE00B4L5Y983',
        name: 'iShares Core MSCI World',
        metal: null,
        coin: null,
        quantity: '12.5',
        unit: null,
        purchasePrice: '78.42',
        purchaseDate: null,
        currentValue: null,
        management: 'Roboadvisor',
        note: null,
      },
    ]);
  });

  it('exports metal code, unit, coin symbol and note exactly', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const rowsPromise = definition.fetchData();
    httpMock.expectOne('/api/holdings').flush([
      {
        ...holding,
        id: 'm-1',
        assetType: 'PRECIOUS_METAL',
        isin: null,
        name: null,
        metal: 'XAU',
        unit: 'OZT',
        quantity: '1.5',
        purchasePrice: null,
        currentValue: '3000.50',
        note: 'Coin bars',
      },
      {
        ...holding,
        id: 'c-1',
        assetType: 'CRYPTO',
        isin: null,
        name: null,
        coinId: 'bitcoin',
        quantity: '0.12345678',
        purchaseDate: '2026-01-02',
      },
    ]);
    const rows = await rowsPromise;

    expect(rows[0]).toMatchObject({
      metal: 'XAU',
      coin: null,
      unit: 'OZT',
      quantity: '1.5',
      currentValue: '3000.50',
      note: 'Coin bars',
    });
    expect(rows[1]).toMatchObject({
      metal: null,
      coin: 'BTC',
      quantity: '0.12345678',
      purchaseDate: '2026-01-02',
    });
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
