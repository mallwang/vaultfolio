import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { DashboardComponent } from './dashboard.component';

// The dashboard renders the holdings distribution chart (<app-echart>), which
// calls into real ECharts — jsdom has no canvas 2D context (no `canvas`
// package installed), so this test double keeps the render path fast and
// environment-independent, same as echart.component.spec.ts.
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

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    // Guard against a leaked 'de' language choice from another spec file
    // sharing this jsdom environment (I18nService reads localStorage eagerly
    // at construction) — this test asserts against the English copy.
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('renders the holdings distribution view in the allocation card', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/holdings').flush([etf]);
    fixture.detectChanges();
    // Flushes past the @defer block's dynamic import of
    // HoldingsDistributionComponent, and that component's own EchartComponent
    // awaiting its dynamic `import('echarts')` (020) — see
    // echart.component.spec.ts's identical note.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Add a holding with a known value');
  });

  it('falls back to the distribution empty state when holdings fail to load', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/holdings').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Add a holding with a known value');
  });
});
