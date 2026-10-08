import { TestBed } from '@angular/core/testing';
import { hide, parseHiddenState } from '@vaultfolio/frontend-hints';
import type { Hint } from '@vaultfolio/frontend-hints';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { HintsStorage } from './hints-storage';

const hint: Hint = {
  id: 'h1',
  severity: 'info',
  titleKey: 't',
  descriptionKey: 'd',
  target: { commands: ['/x'] },
  linkLabelKey: 'l',
};

describe('HintsStorage', () => {
  let storage: HintsStorage;
  let user: FakeCurrentUserStore;

  beforeEach(() => {
    localStorage.clear();
    user = new FakeCurrentUserStore();
    user.setAuthenticated({ id: 'u1' } as Parameters<typeof user.setAuthenticated>[0]);
    TestBed.configureTestingModule({ providers: [{ provide: CurrentUserStore, useValue: user }] });
    storage = TestBed.inject(HintsStorage);
  });

  afterEach(() => vi.restoreAllMocks());

  it('round-trips the hidden state per user', () => {
    const state = hide(parseHiddenState(null), hint, 'src');
    storage.save(state);

    expect(storage.load()).toEqual(state);
    expect(localStorage.getItem('vaultfolio.hints-hidden.u1')).not.toBeNull();

    user.setAuthenticated({ id: 'u2' } as Parameters<typeof user.setAuthenticated>[0]);
    expect(storage.load().entries).toEqual({});
  });

  it('clear() removes the stored state', () => {
    storage.save(hide(parseHiddenState(null), hint, 'src'));
    storage.clear();

    expect(localStorage.getItem('vaultfolio.hints-hidden.u1')).toBeNull();
  });

  it('degrades to empty state / no-ops when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(storage.load().entries).toEqual({});
    expect(() => storage.save(parseHiddenState(null))).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });
});
