import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { EarningsOverview } from '@vaultfolio/api-contract';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { fakeFilterStore } from '../../testing/fake-filter-store';
import { EarningsOverviewComponent } from './earnings-overview.component';

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
  })),
}));

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const OVERVIEW: EarningsOverview = {
  hasData: true,
  career: [],
  latestYear: null,
  yearly: [],
  monthly: [],
  employerChanges: [],
  dataCheckIssues: 1,
};

describe('EarningsOverviewComponent', () => {
  let http: HttpTestingController;

  function setup(overview: EarningsOverview | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'overview', component: EarningsOverviewComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EarningsFilterStore, useValue: fakeFilterStore(overview) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  // The chart initializes asynchronously, even after the file's last test — never unstub (each
  // spec file runs in its own environment).
  beforeAll(() => vi.stubGlobal('ResizeObserver', FakeResizeObserver));

  it('shows the empty state without data', async () => {
    setup({ ...OVERVIEW, hasData: false, dataCheckIssues: 0 });
    const harness = await RouterTestingHarness.create('/overview');

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="earnings-empty-state"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('No earnings yet');
  });

  it('shows the data-check strip and loads the month selected via ?month=', async () => {
    setup(OVERVIEW);
    const harness = await RouterTestingHarness.create('/overview?month=2026-08');
    http.expectOne('/api/earnings/records?period=2026-08').flush([]);
    harness.detectChanges();
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="earnings-check-strip"]')?.textContent).toContain(
      'Data check found 1 issue.',
    );
    expect(root.querySelector('[data-testid="earnings-month-detail"]')?.textContent).toContain(
      'August 2026',
    );
    const range = root.querySelector('[data-testid="earnings-month-range"]')?.textContent ?? '';
    expect(range).toContain('1Y');
    expect(range).toContain('All');
    expect(range).not.toContain('earnings.');
  });

  it('ignores an invalid ?month= value', async () => {
    setup(OVERVIEW);
    const harness = await RouterTestingHarness.create('/overview?month=2026-13');
    http.expectNone('/api/earnings/records?period=2026-13');
    expect(harness.routeNativeElement?.textContent).toContain('Click a month');
  });
});
