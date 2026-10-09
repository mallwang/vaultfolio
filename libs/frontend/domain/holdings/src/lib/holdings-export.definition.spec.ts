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
  'purchaseSum',
];

const holding: HoldingResponse = {
  id: 'etf-1',
  assetType: 'ETF',
  management: 'Roboadvisor',
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  quantity: '12.5',
  purchasePrice: '78.42',
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
      'purchaseSum',
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
        purchaseSum: '980.25',
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
      },
    ]);
    const rows = await rowsPromise;

    expect(rows[0]).toMatchObject({
      metal: 'XAU',
      coin: null,
      unit: 'OZT',
      quantity: '1.5',
      purchaseSum: null,
      note: 'Coin bars',
    });
    expect(rows[1]).toMatchObject({
      metal: null,
      coin: 'BTC',
      quantity: '0.12345678',
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

  it('getExportTables returns "all" plus one table per asset type', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = definition.getExportTables?.();
    httpMock.expectOne('/api/holdings').flush([holding]);
    const tables = await promise;

    expect(tables?.map((t) => t.id)).toEqual([
      'all',
      'ETF',
      'SHARE',
      'PRECIOUS_METAL',
      'CRYPTO',
      'DEPOSIT_MONEY',
    ]);
    // data row + total row; empty types get neither
    expect(tables?.[0].rows).toHaveLength(2);
    expect(tables?.[1].rows).toHaveLength(2);
    expect(tables?.[2].rows).toHaveLength(0);
    expect(tables?.[0].rows[1]).toMatchObject({
      emphasis: 'total',
      cells: { purchaseSum: '980.25' },
    });
    expect(tables?.[0].totalKey).toBe('allTotal');
    expect(tables?.[0].columns.map((c) => c.key)).toContain('note');
  });

  it('getPdfSections returns 6 cards and a full table without the note column', async () => {
    const definition = TestBed.runInInjectionContext(createHoldingsExportDefinition);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = definition.getPdfSections?.();
    httpMock.expectOne('/api/holdings').flush([holding]);
    const [cards, table] = (await promise) ?? [];

    expect(cards.kind === 'cards' && cards.cards).toHaveLength(6);
    const etfRows = cards.kind === 'cards' ? cards.cards[1].rows : [];
    expect(etfRows.at(-1)).toMatchObject({ emphasis: 'total', cells: { share: 1 } });
    expect(table.kind === 'table' && table.columns.map((c) => c.key)).not.toContain('note');
    expect(table.kind === 'table' && table.rows).toHaveLength(2);
    expect(table.kind === 'table' && table.rows[1].emphasis).toBe('total');
  });
});
