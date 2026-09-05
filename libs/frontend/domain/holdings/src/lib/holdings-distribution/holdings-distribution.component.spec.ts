import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsDistributionComponent } from './holdings-distribution.component';
import { ASSET_TYPE_COLORS } from '@vaultfolio/frontend-shared-ui';

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

  afterEach(async () => {
    // Flushes past EchartComponent's dynamic `import('echarts')` inside
    // ngAfterViewInit (020) before unstubbing ResizeObserver — see
    // echart.component.spec.ts's identical note.
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
  });

  const holdings: HoldingResponse[] = [
    holding({ id: '1', assetType: 'SHARE', quantity: '10', purchasePrice: '5' }), // 50
    holding({ id: '2', assetType: 'SHARE', quantity: '2', purchasePrice: '5' }), // 10 -> 60 total SHARE
    holding({ id: '3', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }), // 25
    holding({ id: '4', assetType: 'ETF', quantity: null, purchasePrice: null }), // excluded
  ];

  it('builds the pie series data as {name, value} entries grouped by assetType only, labeled by type', () => {
    fixture.componentRef.setInput('holdings', holdings);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Share', value: 60, itemStyle: { color: ASSET_TYPE_COLORS.SHARE } },
      { name: 'Precious metal', value: 25, itemStyle: { color: ASSET_TYPE_COLORS.PRECIOUS_METAL } },
    ]);
    expect(fixture.componentInstance['excludedCount']()).toBe(1);
  });

  it('sums two differently-named Crypto holdings into exactly one type-level slice (research.md #6a)', () => {
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
        name: 'Ethereum',
        quantity: '2',
        purchasePrice: '2500',
      }), // 5000 -> 9000
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Crypto', value: 9000, itemStyle: { color: ASSET_TYPE_COLORS.CRYPTO } },
    ]);
  });

  it('sums two differently-named Deposit money holdings into one type-level slice', () => {
    fixture.componentRef.setInput('holdings', [
      holding({ id: '1', assetType: 'DEPOSIT_MONEY', name: 'Bargeld', currentValue: '1250' }),
      holding({
        id: '2',
        assetType: 'DEPOSIT_MONEY',
        name: 'Savings account',
        currentValue: '500',
      }),
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Deposit money', value: 1750, itemStyle: { color: ASSET_TYPE_COLORS.DEPOSIT_MONEY } },
    ]);
  });

  it('labels a single-holding type by the type, never the holding name (spec.md Acceptance Scenario 4)', () => {
    fixture.componentRef.setInput('holdings', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Precious metal', value: 25, itemStyle: { color: ASSET_TYPE_COLORS.PRECIOUS_METAL } },
    ]);
  });

  it('resolves every slice name through ASSET_TYPE_LABEL_KEYS/TranslatePipe, never a raw holding name, across all five asset types (research.md #6b, spec.md SC-003)', () => {
    fixture.componentRef.setInput('holdings', [
      holding({
        id: '1',
        assetType: 'ETF',
        name: 'Vanguard FTSE',
        quantity: '1',
        purchasePrice: '100',
      }),
      holding({ id: '2', assetType: 'SHARE', name: 'Apple', quantity: '1', purchasePrice: '100' }),
      holding({ id: '3', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '100' }),
      holding({
        id: '4',
        assetType: 'CRYPTO',
        name: 'Bitcoin',
        quantity: '1',
        purchasePrice: '100',
      }),
      holding({ id: '5', assetType: 'DEPOSIT_MONEY', name: 'Bargeld', currentValue: '100' }),
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data.map((d) => d.name)).toEqual([
      'ETF',
      'Share',
      'Precious metal',
      'Crypto',
      'Deposit money',
    ]);
  });

  it('omits a type entirely when none of its holdings have a computable value, while excludedCount still reflects them (research.md #6c, FR-004/FR-007)', () => {
    fixture.componentRef.setInput('holdings', [
      holding({ id: '1', assetType: 'SHARE', quantity: '10', purchasePrice: '5' }), // 50
      holding({ id: '2', assetType: 'ETF', quantity: null, purchasePrice: null }), // excluded
      holding({ id: '3', assetType: 'ETF', quantity: '1', purchasePrice: null }), // excluded
    ]);
    fixture.detectChanges();

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Share', value: 50, itemStyle: { color: ASSET_TYPE_COLORS.SHARE } },
    ]);
    expect(fixture.componentInstance['excludedCount']()).toBe(2);
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
