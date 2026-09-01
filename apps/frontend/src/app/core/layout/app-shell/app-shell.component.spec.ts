import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { SessionUser } from '@vaultfolio/api-contract';
import { routes } from '../../../app.routes';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';
import { APPLICATION_AREAS } from '../application-areas';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'MEMBER',
};

/**
 * Integration test (T020): renders the real route tree so the sidebar and
 * the `authGuard`-on-parent-route contract are exercised together, not just
 * `AppShellComponent` in isolation.
 */
describe('AppShellComponent (integration)', () => {
  let location: Location;
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(() => {
    fakeCurrentUser = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
      ],
    });
    location = TestBed.inject(Location);
  });

  it('renders the sidebar listing the role-visible APPLICATION_AREAS entries when authenticated', async () => {
    fakeCurrentUser.setAuthenticated(user);
    const harness = await RouterTestingHarness.create('/app/dashboard');
    const visibleAreas = APPLICATION_AREAS.filter(
      (area) => !area.roles || area.roles.includes(user.role),
    );

    const items = harness.routeNativeElement?.querySelectorAll('.app-nav__item');
    expect(items?.length).toBe(visibleAreas.length);
    const labels = Array.from(items ?? []).map((el) => el.textContent?.trim());
    for (const area of visibleAreas) {
      expect(labels.some((label) => label?.includes(area.label))).toBe(true);
    }
  });

  it('is unreachable (redirects to /sign-in) when Auth Status is unauthenticated', async () => {
    fakeCurrentUser.setUnauthenticated();
    await RouterTestingHarness.create('/app/dashboard');
    expect(location.path()).toBe(`/sign-in?redirect=${encodeURIComponent('/app/dashboard')}`);
  });

  it('is unreachable (redirects to /sign-in) while Auth Status is unknown', async () => {
    fakeCurrentUser.setUnknown();
    await RouterTestingHarness.create('/app/dashboard');
    expect(location.path()).toBe(`/sign-in?redirect=${encodeURIComponent('/app/dashboard')}`);
  });
});
