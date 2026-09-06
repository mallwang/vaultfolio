import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingsTypeBreakdownComponent } from './holdings-type-breakdown.component';

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

describe('HoldingsTypeBreakdownComponent', () => {
  let fixture: ComponentFixture<HoldingsTypeBreakdownComponent>;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    await TestBed.configureTestingModule({
      imports: [HoldingsTypeBreakdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsTypeBreakdownComponent);
  });

  afterEach(async () => {
    // Flushes past EchartComponent's dynamic `import('echarts')` inside
    // ngAfterViewInit before unstubbing ResizeObserver — see
    // holdings-distribution.component.spec.ts's identical note.
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
  });

  function setInputs(assetType: HoldingResponse['assetType'], holdings: HoldingResponse[]): void {
    fixture.componentRef.setInput('assetType', assetType);
    fixture.componentRef.setInput('holdings', holdings);
    fixture.detectChanges();
  }

  it('produces two segments for two same-type holdings with distinct names (Acceptance Scenario 1)', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Silver', currentValue: '10' }),
    ]);

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([
      { name: 'Gold', value: 25 },
      { name: 'Silver', value: 10 },
    ]);
  });

  it('sums two same-type, same-name holdings into one segment (Acceptance Scenario 2)', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '17.5' }),
    ]);

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([{ name: 'Gold', value: 42.5 }]);
  });

  it('excludes a holding of a different assetType than this instance', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({
        id: '2',
        assetType: 'CRYPTO',
        name: 'Bitcoin',
        quantity: '1',
        purchasePrice: '100',
      }),
    ]);

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([{ name: 'Gold', value: 25 }]);
  });

  it('excludes a holding with no computable value (FR-005)', () => {
    setInputs('ETF', [
      holding({ id: '1', assetType: 'ETF', name: 'Vanguard', quantity: '1', purchasePrice: '100' }),
      holding({ id: '2', assetType: 'ETF', name: 'iShares', quantity: null, purchasePrice: null }),
    ]);

    const option = fixture.componentInstance['chartOption']();
    const series = option.series as Array<{ data: Array<{ name: string; value: number }> }>;

    expect(series[0].data).toEqual([{ name: 'Vanguard', value: 100 }]);
  });

  it('renders the empty-state message and no chart when the type has no computable-value holdings (FR-006)', () => {
    setInputs('ETF', []);

    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance['hasData']()).toBe(false);
    expect(el.querySelector('app-echart')).toBeNull();
    expect(el.textContent).toContain(
      'Add a holding with a known value to see the distribution by value.',
    );
  });

  it('explicitly disables the legend in the chartOption (FR-007)', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
    ]);

    // Explicit `{ show: false }`, not merely absent — `EchartComponent`'s
    // shared theming fragment merges in its own `legend` object on every
    // theme change, which would otherwise resurrect a default-visible
    // legend (see the component's own `legend` doc comment).
    const option = fixture.componentInstance['chartOption']();
    expect(option.legend).toEqual({ show: false });
  });

  it('renders a center-label element with the segment total, matching the main chart (FR-008)', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Silver', currentValue: '10' }),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    const label = el.querySelector('.type-breakdown__center-label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain('35');
  });

  it('formats the tooltip with the segment name, currency-formatted value, and percentage (SC-004)', () => {
    setInputs('PRECIOUS_METAL', [
      holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
      holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Silver', currentValue: '75' }),
    ]);

    const option = fixture.componentInstance['chartOption']();
    const tooltip = option.tooltip as { formatter: (params: unknown) => string };
    const formatted = tooltip.formatter({ name: 'Gold', value: 25, percent: 25 });

    expect(formatted).toContain('Gold');
    expect(formatted).toContain('25');
    expect(formatted).toMatch(/25\s*%|%\s*25/);
  });
});
