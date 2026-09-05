import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsComponent } from './holdings.component';

// The Holdings page now also renders the holdings distribution chart
// (<app-echart>, FR-013), which calls into real ECharts — jsdom has no
// canvas 2D context (no `canvas` package installed), so this test double
// keeps the render path fast and environment-independent, same as
// dashboard.component.spec.ts.
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const etf: HoldingResponse = {
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

const goldNoValue: HoldingResponse = {
  id: 'gold-1',
  assetType: 'PRECIOUS_METAL',
  management: 'Private',
  isin: null,
  name: 'Gold',
  quantity: null,
  purchasePrice: null,
  purchaseDate: null,
  weightGrams: '31.1',
  currentValue: null,
  createdAt: '2026-08-10T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
};

const silverNoValue: HoldingResponse = {
  id: 'silver-1',
  assetType: 'PRECIOUS_METAL',
  management: 'Private',
  isin: null,
  name: 'Silver',
  quantity: null,
  purchasePrice: null,
  purchaseDate: null,
  weightGrams: '500',
  currentValue: null,
  createdAt: '2026-08-11T09:00:00.000Z',
  updatedAt: '2026-08-11T09:00:00.000Z',
};

describe('HoldingsComponent', () => {
  let fixture: ComponentFixture<HoldingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    await TestBed.configureTestingModule({
      imports: [HoldingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsComponent);
  });

  afterEach(async () => {
    httpMock.verify();
    // Flushes past EchartComponent's dynamic `import('echarts')` inside
    // ngAfterViewInit (020) before unstubbing ResizeObserver — see
    // echart.component.spec.ts's identical note.
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
  });

  function flushList(holdings: HoldingResponse[]): void {
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/holdings').flush(holdings);
    fixture.detectChanges();
  }

  it('renders the fetched holdings with mixed asset types', () => {
    flushList([etf, goldNoValue]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('iShares Core MSCI World');
    expect(text).toContain('Roboadvisor');
    expect(text).toContain('Gold');
  });

  it('displays each Precious metal holding by its entered name, distinguishing Gold from Silver (FR-010)', () => {
    flushList([goldNoValue, silverNoValue]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Gold');
    expect(text).toContain('Silver');
  });

  it('displays Crypto holdings by their entered name, with two same-named lots as two separate rows (FR-006, FR-010)', () => {
    const bitcoinLotOne: HoldingResponse = {
      id: 'btc-1',
      assetType: 'CRYPTO',
      management: 'Private',
      isin: null,
      name: 'Bitcoin',
      quantity: '0.1',
      purchasePrice: '40000',
      purchaseDate: null,
      weightGrams: null,
      currentValue: null,
      createdAt: '2026-08-12T09:00:00.000Z',
      updatedAt: '2026-08-12T09:00:00.000Z',
    };
    const bitcoinLotTwo: HoldingResponse = {
      ...bitcoinLotOne,
      id: 'btc-2',
      quantity: '0.2',
      purchasePrice: '45000',
      createdAt: '2026-08-13T09:00:00.000Z',
      updatedAt: '2026-08-13T09:00:00.000Z',
    };
    flushList([bitcoinLotOne, bitcoinLotTwo]);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Bitcoin');
  });

  it('shows a "—" indicator for a holding missing price/date', () => {
    flushList([goldNoValue]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('—');
  });

  it('renders the empty state when there are no holdings', () => {
    flushList([]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No holdings yet');
  });

  describe('delete flow', () => {
    beforeEach(() => {
      flushList([etf]);
    });

    it('removes the holding from the list after a confirmed delete', () => {
      const component = fixture.componentInstance;
      component['deleteHolding'](etf);

      const req = httpMock.expectOne('/api/holdings/etf-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();

      expect(component['holdings']()).toEqual([]);
    });

    it('leaves the list unchanged when the delete is declined (no request issued)', () => {
      const component = fixture.componentInstance;
      const before = component['holdings']();

      // Declining never calls deleteHolding — no HTTP interaction happens.
      httpMock.expectNone(() => true);
      expect(component['holdings']()).toEqual(before);
    });

    it('treats a 404 on delete as a non-error success, removing the row and refreshing', () => {
      const component = fixture.componentInstance;
      component['deleteHolding'](etf);

      const deleteReq = httpMock.expectOne('/api/holdings/etf-1');
      deleteReq.flush(
        { error: 'HOLDING_NOT_FOUND', message: 'gone' },
        { status: 404, statusText: 'Not Found' },
      );

      // The already-deleted-elsewhere path triggers a refresh.
      const refreshReq = httpMock.expectOne('/api/holdings');
      refreshReq.flush([]);
      fixture.detectChanges();

      expect(component['holdings']()).toEqual([]);
    });
  });
});
