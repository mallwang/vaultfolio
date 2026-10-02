import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { routeTabs } from './route-tabs';

describe('routeTabs', () => {
  const events = new Subject<unknown>();
  const navigate = vi.fn().mockResolvedValue(true);
  let childPath: string | undefined;
  const route = {
    snapshot: {
      get firstChild() {
        return childPath === undefined ? null : { url: [{ path: childPath }] };
      },
    },
  };

  beforeEach(() => {
    childPath = undefined;
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events, navigate } },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
  });

  it('starts on the default tab when no child route is active', () => {
    const tabs = TestBed.runInInjectionContext(() => routeTabs('list'));
    expect(tabs.activeTab()).toBe('list');
  });

  it('starts on the active child segment', () => {
    childPath = 'imports';
    const tabs = TestBed.runInInjectionContext(() => routeTabs('list'));
    expect(tabs.activeTab()).toBe('imports');
  });

  it('follows the child segment after a NavigationEnd', () => {
    const tabs = TestBed.runInInjectionContext(() => routeTabs('list'));
    childPath = 'imports';
    events.next(new NavigationEnd(1, '/a', '/a'));
    expect(tabs.activeTab()).toBe('imports');
  });

  it('navigates relative to the route when a tab is selected', () => {
    const tabs = TestBed.runInInjectionContext(() => routeTabs('list'));
    tabs.onTabChange('imports');
    expect(navigate).toHaveBeenCalledWith(['imports'], { relativeTo: route });
  });

  it('ignores an undefined tab value', () => {
    const tabs = TestBed.runInInjectionContext(() => routeTabs('list'));
    tabs.onTabChange(undefined);
    expect(navigate).not.toHaveBeenCalled();
  });
});
