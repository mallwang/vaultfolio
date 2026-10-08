import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsTotalValueComponent } from './holdings-total-value.component';

function holding(overrides: Partial<HoldingResponse>): HoldingResponse {
  return {
    id: 'id',
    assetType: 'SHARE',
    management: 'Broker',
    quantity: null,
    purchasePrice: null,
    purchaseDate: null,
    isin: null,
    name: null,
    note: null,
    metal: null,
    coinId: null,
    unit: null,
    currentValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HoldingsTotalValueComponent', () => {
  let fixture: ComponentFixture<HoldingsTotalValueComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const byId = (id: string) => el().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingsTotalValueComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HoldingsTotalValueComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function respond(body: HoldingResponse[]) {
    http.expectOne('/api/holdings').flush(body);
    fixture.detectChanges();
  }

  it('shows an empty tile linking to the holdings area when there are no holdings', () => {
    respond([]);
    const empty = byId('holdings-total-value-empty') as HTMLAnchorElement;
    expect(empty).not.toBeNull();
    expect(empty.getAttribute('href')).toBe('/app/holdings');
    expect(byId('holdings-total-value-amount')).toBeNull();
  });

  it('sums ETF/SHARE/CRYPTO purchase values exactly: 10 x 12.34 + 0.5 x 100.01 = 173.405', () => {
    respond([
      holding({ id: '1', quantity: '10', purchasePrice: '12.34' }),
      holding({ id: '2', assetType: 'CRYPTO', quantity: '0.5', purchasePrice: '100.01' }),
    ]);
    expect(fixture.componentInstance['total']().toString()).toBe('173.405');
    expect(byId('holdings-total-value-amount')?.textContent).toContain('173.41');
    expect(byId('holdings-total-value-label')?.textContent?.trim()).toBe('Purchase value');
    expect(byId('holdings-total-value-hint')).toBeNull();
  });

  it('excludes metal, deposit and priceless holdings and shows the exact excluded count', () => {
    respond([
      holding({ id: '1', quantity: '2', purchasePrice: '5' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', currentValue: '999' }),
      holding({ id: '3', assetType: 'DEPOSIT_MONEY', currentValue: '1000' }),
      holding({ id: '4', assetType: 'ETF', quantity: '3', purchasePrice: null }),
    ]);
    expect(fixture.componentInstance['total']().toString()).toBe('10');
    expect(byId('holdings-total-value-hint')?.textContent?.trim()).toBe(
      '3 without purchase value not counted',
    );
  });

  it('shows an error state, distinct from empty, when the load fails', () => {
    http.expectOne('/api/holdings').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(byId('holdings-total-value-error')?.textContent?.trim()).toBe(
      'Holdings could not be loaded.',
    );
    expect(byId('holdings-total-value-empty')).toBeNull();
  });

  it('shows the unavailable text on a 503', () => {
    http.expectOne('/api/holdings').flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(byId('holdings-total-value-error')?.textContent?.trim()).toBe(
      'Holdings are temporarily unavailable.',
    );
  });
});
