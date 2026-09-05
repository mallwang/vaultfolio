import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { routes } from './app.routes';
import { CurrentUserStore } from './auth/current-user.store';
import { FakeCurrentUserStore } from './auth/testing/current-user-store.testing';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'MEMBER',
  // FR-009: existing users are backfilled with holdings access — this fixture
  // represents that default, unaffected majority (020).
  domainScopes: ['holdings'],
};

const admin: SessionUser = {
  id: 'user-2',
  email: 'admin@example.com',
  displayName: 'Admin Example',
  role: 'ADMIN',
  domainScopes: [],
};

/**
 * Route-table integration test per contracts/routes.md (T013): exercises
 * the router ↔ guard contract without rendering components, by navigating
 * and asserting on the resolved URL.
 */
describe('app.routes', () => {
  let router: Router;
  let location: Location;
  let fakeCurrentUser: FakeCurrentUserStore;

  function setup(): void {
    fakeCurrentUser = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
        { provide: CURRENT_USER_SOURCE, useExisting: CurrentUserStore },
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  }

  describe('when authenticated', () => {
    beforeEach(() => {
      setup();
      fakeCurrentUser.setAuthenticated(user);
    });

    it.each([
      ['/app/dashboard', '/app/dashboard'],
      ['/app/holdings', '/app/holdings'],
      ['/app/imports', '/app/imports'],
      ['/app/settings', '/app/settings/profile'],
    ])('resolves %s under /app/*', async (path, expected) => {
      await router.navigateByUrl(path);
      expect(location.path()).toBe(expected);
    });

    it.each([
      ['/', '/app/dashboard'],
      ['/dashboard', '/app/dashboard'],
      ['/holdings', '/app/holdings'],
      ['/imports', '/app/imports'],
      ['/settings', '/app/settings/profile'],
    ])('redirects legacy %s to %s', async (legacy, expected) => {
      await router.navigateByUrl(legacy);
      expect(location.path()).toBe(expected);
    });

    // 012 US4: each Settings/Admin tab is directly addressable for deep
    // links (e.g. from emails), and opening the area with no subsection
    // still defaults to its first tab.
    it.each(['/app/settings/profile', '/app/settings/preferences'])(
      'resolves %s directly to itself',
      async (path) => {
        await router.navigateByUrl(path);
        expect(location.path()).toBe(path);
      },
    );

    it('redirects a MEMBER opening an admin subsection address away, same as /app/admin', async () => {
      await router.navigateByUrl('/app/admin/invitations');
      expect(location.path()).toBe('/app/dashboard');
    });
  });

  describe('when authenticated as ADMIN', () => {
    beforeEach(() => {
      setup();
      fakeCurrentUser.setAuthenticated(admin);
    });

    it('defaults /app/admin to /app/admin/accounts', async () => {
      await router.navigateByUrl('/app/admin');
      expect(location.path()).toBe('/app/admin/accounts');
    });

    it.each([
      '/app/admin/accounts',
      '/app/admin/signups',
      '/app/admin/invitations',
      '/app/admin/general',
    ])('resolves %s directly to itself', async (path) => {
      await router.navigateByUrl(path);
      expect(location.path()).toBe(path);
    });
  });

  describe('when unauthenticated', () => {
    beforeEach(() => {
      setup();
      fakeCurrentUser.setUnauthenticated();
    });

    it.each([
      ['/app/dashboard', '/app/dashboard'],
      ['/app/holdings', '/app/holdings'],
      ['/app/imports', '/app/imports'],
      ['/app/settings', '/app/settings/profile'],
    ])('redirects %s to /sign-in, preserving %s as a redirect target', async (path, resolved) => {
      await router.navigateByUrl(path);
      expect(location.path()).toBe(`/sign-in?redirect=${encodeURIComponent(resolved)}`);
    });

    it('redirects a legacy address to /sign-in via its /app equivalent, preserving the resolved /app address as a redirect target', async () => {
      await router.navigateByUrl('/dashboard');
      expect(location.path()).toBe(`/sign-in?redirect=${encodeURIComponent('/app/dashboard')}`);
    });

    it.each(['/sign-in', '/signup', '/invite/expired'])(
      'still resolves the public path %s with no /app prefix',
      async (path) => {
        await router.navigateByUrl(path);
        expect(location.path()).toBe(path);
      },
    );
  });
});
