import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { adminGuard } from './admin.guard';
import { CurrentUserStore } from './current-user.store';
import { FakeCurrentUserStore } from './testing/current-user-store.testing';

function runGuard() {
  return TestBed.runInInjectionContext(() =>
    adminGuard({} as never, { url: '/app/admin' } as never),
  );
}

describe('adminGuard', () => {
  let store: FakeCurrentUserStore;

  beforeEach(() => {
    store = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [{ provide: CurrentUserStore, useValue: store }],
    });
  });

  it('activates for an ADMIN user', () => {
    store.setAuthenticated({
      id: 'user-1',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
    } satisfies SessionUser);

    expect(runGuard()).toBe(true);
  });

  it('redirects to /app/dashboard for a MEMBER user', () => {
    store.setAuthenticated({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      role: 'MEMBER',
    } satisfies SessionUser);

    const result = runGuard();
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.parseUrl('/app/dashboard'));
  });
});
