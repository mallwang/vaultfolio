import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { routes } from './app.routes';
import { CurrentUserStore } from './auth/current-user.store';
import { FakeCurrentUserStore } from './auth/testing/current-user-store.testing';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'MEMBER',
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
      ['/app/settings', '/app/settings'],
    ])('resolves %s under /app/*', async (path, expected) => {
      await router.navigateByUrl(path);
      expect(location.path()).toBe(expected);
    });

    it.each([
      ['/', '/app/dashboard'],
      ['/dashboard', '/app/dashboard'],
      ['/holdings', '/app/holdings'],
      ['/imports', '/app/imports'],
      ['/settings', '/app/settings'],
    ])('redirects legacy %s to %s', async (legacy, expected) => {
      await router.navigateByUrl(legacy);
      expect(location.path()).toBe(expected);
    });
  });

  describe('when unauthenticated', () => {
    beforeEach(() => {
      setup();
      fakeCurrentUser.setUnauthenticated();
    });

    it.each(['/app/dashboard', '/app/holdings', '/app/imports', '/app/settings'])(
      'redirects %s to /sign-in',
      async (path) => {
        await router.navigateByUrl(path);
        expect(location.path()).toBe('/sign-in');
      },
    );

    it('redirects a legacy address to /sign-in via its /app equivalent', async () => {
      await router.navigateByUrl('/dashboard');
      expect(location.path()).toBe('/sign-in');
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
