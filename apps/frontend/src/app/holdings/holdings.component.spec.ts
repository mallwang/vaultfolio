import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from 'api-contract';
import { HoldingsComponent } from './holdings.component';

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
  assetType: 'GOLD',
  management: 'Private',
  isin: null,
  name: null,
  quantity: null,
  purchasePrice: null,
  purchaseDate: null,
  weightGrams: '31.1',
  currentValue: null,
  createdAt: '2026-08-10T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
};

describe('HoldingsComponent', () => {
  let fixture: ComponentFixture<HoldingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsComponent);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushList(holdings: HoldingResponse[]): void {
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('http://localhost:3000/holdings').flush(holdings);
    fixture.detectChanges();
  }

  it('renders the fetched holdings with mixed asset types', () => {
    flushList([etf, goldNoValue]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('iShares Core MSCI World');
    expect(text).toContain('Roboadvisor');
    expect(text).toContain('Gold');
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

  it('excludes a valueless Gold holding from the distribution view', () => {
    flushList([goldNoValue]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Add a holding with a known value');
  });

  describe('delete flow', () => {
    beforeEach(() => {
      flushList([etf]);
    });

    it('removes the holding from the list after a confirmed delete', () => {
      const component = fixture.componentInstance;
      component['deleteHolding'](etf);

      const req = httpMock.expectOne('http://localhost:3000/holdings/etf-1');
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

      const deleteReq = httpMock.expectOne('http://localhost:3000/holdings/etf-1');
      deleteReq.flush(
        { error: 'HOLDING_NOT_FOUND', message: 'gone' },
        { status: 404, statusText: 'Not Found' },
      );

      // The already-deleted-elsewhere path triggers a refresh.
      const refreshReq = httpMock.expectOne('http://localhost:3000/holdings');
      refreshReq.flush([]);
      fixture.detectChanges();

      expect(component['holdings']()).toEqual([]);
    });
  });
});
