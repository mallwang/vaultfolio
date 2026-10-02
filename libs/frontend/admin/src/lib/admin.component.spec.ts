import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AdminComponent } from './admin.component';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

function buildFixture(firstChildPath: string | undefined): {
  fixture: ComponentFixture<AdminComponent>;
  events: Subject<unknown>;
  navigate: ReturnType<typeof vi.fn>;
  snapshot: { firstChild: { url: { path: string }[] } | undefined };
} {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  const events = new Subject<unknown>();
  const navigate = vi.fn();
  const snapshot: { firstChild: { url: { path: string }[] } | undefined } = {
    firstChild: firstChildPath ? { url: [{ path: firstChildPath }] } : undefined,
  };

  TestBed.configureTestingModule({
    imports: [AdminComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: Router,
        useValue: { events, navigate },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot },
      },
    ],
  }).compileComponents();

  return { fixture: TestBed.createComponent(AdminComponent), events, navigate, snapshot };
}

describe('AdminComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('defaults activeTab to "accounts" when there is no matching child route', () => {
    const { fixture } = buildFixture(undefined);

    fixture.detectChanges();

    expect(fixture.componentInstance['activeTab']()).toBe('accounts');
  });

  it('initializes activeTab from the current child route segment', () => {
    const { fixture } = buildFixture('invitations');

    fixture.detectChanges();

    expect(fixture.componentInstance['activeTab']()).toBe('invitations');
  });

  it('updates activeTab when navigation ends on a different child route', () => {
    const { fixture, events, snapshot } = buildFixture('accounts');
    fixture.detectChanges();

    snapshot.firstChild = { url: [{ path: 'signups' }] };
    events.next(new NavigationEnd(1, '/app/admin/signups', '/app/admin/signups'));

    expect(fixture.componentInstance['activeTab']()).toBe('signups');
  });

  it('ignores non-NavigationEnd router events', () => {
    const { fixture, events, snapshot } = buildFixture('accounts');
    fixture.detectChanges();

    snapshot.firstChild = { url: [{ path: 'signups' }] };
    events.next({ type: 'other' });

    expect(fixture.componentInstance['activeTab']()).toBe('accounts');
  });

  it('navigates relative to the current route when the tab changes', () => {
    const { fixture, navigate } = buildFixture('accounts');
    fixture.detectChanges();

    fixture.componentInstance['onTabChange']('invitations');

    expect(navigate).toHaveBeenCalledWith(['invitations'], {
      relativeTo: TestBed.inject(ActivatedRoute),
    });
  });

  it('does nothing when the tab value is undefined', () => {
    const { fixture, navigate } = buildFixture('accounts');
    fixture.detectChanges();

    fixture.componentInstance['onTabChange'](undefined);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the Requests tab with the open-request count, loaded on init', () => {
    const { fixture } = buildFixture('accounts');
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/requests')
      .flush({ openCount: 3, items: [] });
    fixture.detectChanges();

    const tab = fixture.nativeElement.querySelector('[data-testid="admin-tab-requests"]');
    expect(tab).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-tab-requests-count"]').textContent,
    ).toContain('3');
  });

  it('hides the count when nothing is open and treats "requests" as a tab', () => {
    const { fixture } = buildFixture('requests');
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/requests')
      .flush({ openCount: 0, items: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance['activeTab']()).toBe('requests');
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-tab-requests-count"]'),
    ).toBeNull();
  });
});
