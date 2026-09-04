import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsDistributionComponent } from './holdings-distribution.component';

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
    weightGrams: null,
    currentValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HoldingsDistributionComponent', () => {
  let fixture: ComponentFixture<HoldingsDistributionComponent>;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    await TestBed.configureTestingModule({
      imports: [HoldingsDistributionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsDistributionComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const holdings: HoldingResponse[] = [
    holding({ id: '1', assetType: 'SHARE', quantity: '10', purchasePrice: '5' }), // 50
    holding({ id: '2', assetType: 'SHARE', quantity: '2', purchasePrice: '5' }), // 10 -> 60 total SHARE
    holding({ id: '3', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }), // 25
    holding({ id: '4', assetType: 'ETF', quantity: null, purchasePrice: null }), // excluded
  ];

  it('builds the pie series data as {name, value} entries grouped by assetType, matching the prior Chart.js parity', () => {
    fixture.componentRef.setInput('holdings', holdings);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Share', value: 60 },
      { name: 'Gold', value: 25 },
    ]);
    expect(fixture.componentInstance['excludedCount']()).toBe(1);
  });

  it('groups Precious metal/Crypto holdings by name, not just type — Gold and Silver as separate slices (research.md #3, FR-010)', () => {
    fixture.componentRef.setInput('holdings', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Silver', currentValue: '10' }),
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Gold', value: 25 },
      { name: 'Silver', value: 10 },
    ]);
  });

  it('sums two same-named Crypto lots into one slice', () => {
    fixture.componentRef.setInput('holdings', [
      holding({
        id: '1',
        assetType: 'CRYPTO',
        name: 'Bitcoin',
        quantity: '0.1',
        purchasePrice: '40000',
      }), // 4000
      holding({
        id: '2',
        assetType: 'CRYPTO',
        name: 'Bitcoin',
        quantity: '0.2',
        purchasePrice: '45000',
      }), // 9000 -> 13000
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([{ name: 'Bitcoin', value: 13000 }]);
  });

  it('renders no <app-echart> and shows the localized empty-state message when nothing is computable', () => {
    fixture.componentRef.setInput('holdings', [
      holding({ id: '1', assetType: 'ETF', quantity: null, purchasePrice: null }),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance['hasData']()).toBe(false);
    expect(el.querySelector('app-echart')).toBeNull();
    expect(el.textContent).toContain(
      'Add a holding with a known value to see the distribution by value.',
    );
  });
});
