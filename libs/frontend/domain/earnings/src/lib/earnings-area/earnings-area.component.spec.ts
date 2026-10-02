import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Routes } from '@angular/router';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { EarningsOverview } from '@vaultfolio/api-contract';
import { EarningsAreaComponent } from './earnings-area.component';
import { EarningsFilterStore } from './earnings-filter.store';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

@Component({ selector: 'app-stub-overview', template: `overview content` })
class StubOverviewComponent {}

@Component({ selector: 'app-stub-check', template: `check content` })
class StubCheckComponent {}

const routes: Routes = [
  {
    path: 'earnings',
    component: EarningsAreaComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: StubOverviewComponent },
      { path: 'tables', component: StubOverviewComponent },
      { path: 'check', component: StubCheckComponent },
      { path: 'imports', component: StubOverviewComponent },
    ],
  },
];

function overview(partial: Partial<EarningsOverview> = {}): EarningsOverview {
  return {
    hasData: true,
    career: [],
    latestYear: null,
    yearly: [],
    monthly: [],
    employerChanges: [],
    dataCheckIssues: 0,
    ...partial,
  };
}

describe('EarningsAreaComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function open(
    url: string,
    data: EarningsOverview = overview(),
  ): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create(url);
    http.expectOne('/api/earnings/employers').flush([
      { id: 'e1', detectedName: 'Alpha GmbH', displayName: null },
      { id: 'e2', detectedName: 'Beta AG', displayName: 'Beta' },
    ]);
    http.expectOne('/api/earnings/overview').flush(data);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('defaults to the Overview tab and renders toolbar and tabs', async () => {
    const harness = await open('/earnings');
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('[data-p-active="true"]')?.textContent?.trim()).toBe('Overview');
    expect(root.textContent).toContain('overview content');
    expect(root.querySelector('[data-testid="earnings-employer-filter"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="earnings-import-button"]')?.getAttribute('href')).toBe(
      '/earnings/import',
    );
    expect(root.querySelector('[data-testid="earnings-privacy-link"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="earnings-check-badge"]')).toBeNull();
  });

  it('shows the data-check issue count as a badge on the Data check tab', async () => {
    const harness = await open('/earnings/check', overview({ dataCheckIssues: 2 }));
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="earnings-check-badge"]')?.textContent?.trim()).toBe(
      '2',
    );
    expect(root.textContent).toContain('check content');
  });

  it('shows only the Overview content without data — no toolbar, export or other tabs', async () => {
    const harness = await open('/earnings', overview({ hasData: false }));
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.textContent).toContain('overview content');
    expect(root.querySelector('[data-testid="earnings-employer-filter"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-import-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-privacy-link"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-tab-tables"]')).toBeNull();
    expect(root.querySelector('[data-testid="earnings-tab-imports"]')).toBeNull();
  });

  it('leaves a hidden tab for the Overview when the data is gone', async () => {
    const harness = await open('/earnings/imports', overview({ hasData: false }));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/earnings/overview');
  });

  it('passes the selected employer to the overview request', async () => {
    const harness = await open('/earnings');
    const store = harness.routeDebugElement?.injector.get(
      EarningsFilterStore,
    ) as EarningsFilterStore;

    store.select('e2');
    harness.detectChanges();
    await harness.fixture.whenStable();

    http.expectOne('/api/earnings/overview?employer=e2').flush(overview());
    expect(store.employerId()).toBe('e2');
    store.select(null);
    harness.detectChanges();
    await harness.fixture.whenStable();
    http.expectOne('/api/earnings/overview').flush(overview());
    expect(store.employerId()).toBeNull();
  });

  it('shows only the unavailable state on 503 EARNINGS_UNAVAILABLE — no toolbar, tabs or figures', async () => {
    const harness = await RouterTestingHarness.create('/earnings');
    http
      .expectOne('/api/earnings/employers')
      .flush({ error: 'EARNINGS_UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    http
      .expectOne('/api/earnings/overview')
      .flush({ error: 'EARNINGS_UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="earnings-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="earnings-import-button"]')).toBeNull();
    expect(root.querySelector('p-tabs')).toBeNull();
    expect(root.textContent).not.toContain('overview content');
  });
});
