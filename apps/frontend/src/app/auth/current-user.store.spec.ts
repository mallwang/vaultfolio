import type { SessionUser } from '@vaultfolio/api-contract';
import { CurrentUserStore } from './current-user.store';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex',
  role: 'MEMBER',
  domainScopes: [],
};

describe('CurrentUserStore', () => {
  it('starts at Auth Status "unknown" with no user', () => {
    const store = new CurrentUserStore();
    expect(store.status()).toBe('unknown');
    expect(store.current()).toBeNull();
  });

  it('transitions unknown -> authenticated on setAuthenticated', () => {
    const store = new CurrentUserStore();
    store.setAuthenticated(user);
    expect(store.status()).toBe('authenticated');
    expect(store.current()).toEqual(user);
  });

  it('transitions unknown -> unauthenticated on setUnauthenticated', () => {
    const store = new CurrentUserStore();
    store.setUnauthenticated();
    expect(store.status()).toBe('unauthenticated');
    expect(store.current()).toBeNull();
  });

  it('transitions authenticated -> unauthenticated on sign-out and clears the user', () => {
    const store = new CurrentUserStore();
    store.setAuthenticated(user);
    store.setUnauthenticated();
    expect(store.status()).toBe('unauthenticated');
    expect(store.current()).toBeNull();
  });
});
