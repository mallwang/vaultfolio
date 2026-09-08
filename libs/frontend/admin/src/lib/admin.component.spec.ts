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
      relativeTo: fixture.componentInstance['route'],
    });
  });

  it('does nothing when the tab value is undefined', () => {
    const { fixture, navigate } = buildFixture('accounts');
    fixture.detectChanges();

    fixture.componentInstance['onTabChange'](undefined);

    expect(navigate).not.toHaveBeenCalled();
  });
});
