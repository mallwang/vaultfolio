import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { RetirementAreaComponent } from './retirement-area.component';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

@Component({ selector: 'app-stub', template: `stub content` })
class StubComponent {}

const routes: Routes = [
  {
    path: 'retirement',
    component: RetirementAreaComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'statutory' },
      { path: 'statutory', component: StubComponent },
      { path: 'occupational', component: StubComponent },
      { path: 'private', component: StubComponent },
      { path: 'info', component: StubComponent },
    ],
  },
];

describe('RetirementAreaComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function open(
    url: string,
    records = [
      buildRecord({ id: 'a', contractType: 'STATUTORY_PENSION' }),
      buildRecord({ id: 'b', contractType: 'DIRECT_INSURANCE' }),
      buildRecord({ id: 'c', contractType: 'PENSIONSKASSE' }),
    ],
  ): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create(url);
    http.expectOne('/api/retirement/records').flush(records);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  const byTestId = (root: HTMLElement, id: string): HTMLElement | null =>
    root.querySelector(`[data-testid="${id}"]`);

  it('renders the toolbar actions and the pillar and information tabs', async () => {
    const harness = await open('/retirement/info');
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-privacy-link')?.getAttribute('href')).toContain('#privacy');
    expect(byTestId(el, 'retirement-manual-button')).not.toBeNull();
    expect(byTestId(el, 'retirement-upload-button')).not.toBeNull();
    for (const tab of ['statutory', 'occupational', 'private', 'info']) {
      expect(byTestId(el, `retirement-tab-${tab}`)).not.toBeNull();
    }
    expect(el.textContent).toContain('Further information');
  });

  it('shows the number of entries per pillar and hides empty counters', async () => {
    const harness = await open('/retirement/statutory');
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-tab-count-statutory')?.textContent).toContain('1');
    expect(byTestId(el, 'retirement-tab-count-occupational')?.textContent).toContain('2');
    expect(byTestId(el, 'retirement-tab-count-private')).toBeNull();
  });

  it('switches the route when a tab is clicked', async () => {
    const harness = await open('/retirement/statutory');
    const router = TestBed.inject(Router);
    const el = harness.routeNativeElement as HTMLElement;
    byTestId(el, 'retirement-tab-private')?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/retirement/private');
  });

  it('replaces the whole area by the unavailable state on 503 RETIREMENT_UNAVAILABLE', async () => {
    const harness = await RouterTestingHarness.create('/retirement/info');
    http
      .expectOne('/api/retirement/records')
      .flush({ error: 'RETIREMENT_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-unavailable')).not.toBeNull();
    expect(byTestId(el, 'retirement-tab-info')).toBeNull();
    expect(byTestId(el, 'retirement-upload-button')).toBeNull();
  });
});
