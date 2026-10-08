import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { FeedbackDraftStorage } from './feedback-draft-storage';

const draft = { category: 'other', subject: 'S', message: 'M' } as const;
const user = (id: string) => ({ id }) as Parameters<FakeCurrentUserStore['setAuthenticated']>[0];

describe('FeedbackDraftStorage', () => {
  let users: FakeCurrentUserStore;
  let storage: FeedbackDraftStorage;

  beforeEach(() => {
    localStorage.clear();
    users = new FakeCurrentUserStore();
    users.setAuthenticated(user('u1'));
    TestBed.configureTestingModule({ providers: [{ provide: CurrentUserStore, useValue: users }] });
    storage = TestBed.inject(FeedbackDraftStorage);
  });

  it('stores under a per-user key and exposes hasDraft', () => {
    storage.save(draft);
    expect(localStorage.getItem('vaultfolio.feedback-draft.u1')).toContain('"subject":"S"');
    expect(storage.hasDraft()).toBe(true);
    storage.clear();
    expect(localStorage.getItem('vaultfolio.feedback-draft.u1')).toBeNull();
    expect(storage.hasDraft()).toBe(false);
  });

  it('separates users', () => {
    storage.save(draft);
    users.setAuthenticated(user('u2'));
    expect(storage.load()).toBeNull();
    users.setAuthenticated(user('u1'));
    expect(storage.load()).toEqual(draft);
  });

  it('swallows storage errors', () => {
    const boom = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => storage.save(draft)).not.toThrow();
    expect(storage.hasDraft()).toBe(true);
    expect(storage.load()).toBeNull();
    boom.mockRestore();
    get.mockRestore();
  });
});
