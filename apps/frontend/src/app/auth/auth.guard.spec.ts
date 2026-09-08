import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { authGuard } from './auth.guard';
import { CurrentUserStore } from './current-user.store';
import { FakeCurrentUserStore } from './testing/current-user-store.testing';

function runGuard(url = '/app/dashboard') {
  return TestBed.runInInjectionContext(() => authGuard({} as never, { url } as never));
}

describe('authGuard', () => {
  let store: FakeCurrentUserStore;

  beforeEach(() => {
    store = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [{ provide: CurrentUserStore, useValue: store }],
    });
  });

  it('activates when the user is authenticated', () => {
    store.setAuthenticated({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      role: 'MEMBER',
      domainScopes: [],
    } satisfies SessionUser);

    expect(runGuard()).toBe(true);
  });

  it('redirects to /sign-in with a redirect param when unauthenticated', () => {
    store.setUnauthenticated();

    const result = runGuard('/app/dashboard');
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.parseUrl('/sign-in?redirect=%2Fapp%2Fdashboard'));
  });

  it('redirects to /sign-in when the Auth Status is still unknown', () => {
    store.setUnknown();

    const result = runGuard('/app/dashboard');
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.parseUrl('/sign-in?redirect=%2Fapp%2Fdashboard'));
  });
});
