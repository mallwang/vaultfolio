import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HoldingsAreaComponent } from './holdings-area.component';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

@Component({ selector: 'app-stub-list', template: `list content` })
class StubListComponent {}

const routes: Routes = [
  {
    path: 'holdings',
    component: HoldingsAreaComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'list' },
      { path: 'list', component: StubListComponent },
    ],
  },
];

/**
 * Tab-switching/active-tab detection from the route (research.md #5,
 * mirroring `SettingsComponent`/`AdminComponent`'s existing pattern per
 * plan.md Principle IV) — `domainGuard('holdings')` itself is exercised at
 * the `app.routes.ts` level (app.routes.spec.ts), not duplicated here.
 */
describe('HoldingsAreaComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to the "list" tab and shows its content', async () => {
    const harness = await RouterTestingHarness.create('/holdings');

    const tab = harness.routeNativeElement?.querySelector('[data-p-active="true"]');
    expect(tab?.textContent?.trim()).toBe('List');
    expect(harness.routeNativeElement?.textContent).toContain('list content');
  });

  it('renders only the List tab', async () => {
    const harness = await RouterTestingHarness.create('/holdings');

    expect(harness.routeNativeElement?.querySelectorAll('p-tab').length).toBe(1);
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="holdings-area-tab-imports"]'),
    ).toBeNull();
  });
});
