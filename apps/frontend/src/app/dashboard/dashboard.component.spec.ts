import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SessionUser } from '@vaultfolio/api-contract';
import { DashboardComponent } from './dashboard.component';
import { CurrentUserStore } from '../auth/current-user.store';
import { FakeCurrentUserStore } from '../auth/testing/current-user-store.testing';

// The entitled-user path renders the holdings distribution widget, which
// renders <app-echart> and calls into real ECharts — jsdom has no canvas 2D
// context, so this test double keeps the render path fast and
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

const entitledUser: SessionUser = {
  id: 'user-1',
  email: 'entitled@example.com',
  displayName: 'Entitled',
  role: 'MEMBER',
  domainScopes: ['holdings'],
};

const unentitledUser: SessionUser = {
  id: 'user-2',
  email: 'unentitled@example.com',
  displayName: 'Unentitled',
  role: 'MEMBER',
  domainScopes: [],
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(async () => {
    // Guard against a leaked 'de' language choice from another spec file
    // sharing this jsdom environment (I18nService reads localStorage eagerly
    // at construction) — this test asserts against the English copy.
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    fakeCurrentUser = new FakeCurrentUserStore();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('shows the holdings distribution widget for a holdings-entitled user (Acceptance Scenario 1)', async () => {
    fakeCurrentUser.setAuthenticated(entitledUser);
    fixture.detectChanges();

    // The widget's own dynamic `import('@vaultfolio/frontend-domain-holdings')`
    // (DASHBOARD_WIDGET_CONTRIBUTIONS) is a real code-split chunk load, not a
    // single microtask — poll until the request it eventually makes shows up.
    // `match()` (not `expectOne()`) inside the loop, since a matching call
    // removes the request from the testing backend's open-request queue —
    // calling it repeatedly while polling would otherwise make every
    // iteration but the first find nothing.
    let requests: ReturnType<typeof httpMock.match> = [];
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        requests = httpMock.match('/api/holdings');
        expect(requests).toHaveLength(1);
      },
      { timeout: 5000 },
    );
    requests[0].flush([]);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-dynamic-outlet')).not.toBeNull();
  });

  it('hides the widget for a user not entitled to holdings (Acceptance Scenario 2)', async () => {
    fakeCurrentUser.setAuthenticated(unentitledUser);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-dynamic-outlet')).toBeNull();
  });

  it('renders the other Dashboard cards without error when no widget is visible (Acceptance Scenario 4)', () => {
    fakeCurrentUser.setAuthenticated(unentitledUser);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Total value');
    expect(text).toContain("Today's change");
    expect(text).toContain('Allocation');
  });
});
