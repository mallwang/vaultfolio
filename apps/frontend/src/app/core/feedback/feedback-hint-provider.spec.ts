import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { FeedbackDraftStorage } from './feedback-draft-storage';
import { FeedbackHintProvider } from './feedback-hint-provider';

describe('FeedbackHintProvider', () => {
  let provider: FeedbackHintProvider;
  let storage: FeedbackDraftStorage;

  beforeEach(() => {
    localStorage.clear();
    const users = new FakeCurrentUserStore();
    users.setAuthenticated({ id: 'u1' } as Parameters<FakeCurrentUserStore['setAuthenticated']>[0]);
    TestBed.configureTestingModule({ providers: [{ provide: CurrentUserStore, useValue: users }] });
    provider = TestBed.inject(FeedbackHintProvider);
    storage = TestBed.inject(FeedbackDraftStorage);
  });

  it('has no hint without a draft and is ready', () => {
    provider.load();
    expect(provider.ready()).toBe(true);
    expect(provider.hints()).toEqual([]);
  });

  it('yields feedback.draft while a draft exists', () => {
    storage.save({ category: 'feature', subject: 'Dark mode', message: 'x' });
    const [hint] = provider.hints();
    expect(hint.id).toBe('feedback.draft');
    expect(hint.severity).toBe('info');
    expect(hint.params).toEqual({ subject: 'Dark mode' });
    expect(hint.target).toEqual({
      commands: ['/app/dashboard'],
      queryParams: { feedback: 'draft' },
    });
    storage.clear();
    expect(provider.hints()).toEqual([]);
  });

  it('picks up a draft stored before load()', () => {
    localStorage.setItem(
      'vaultfolio.feedback-draft.u1',
      JSON.stringify({ v: 1, category: 'other', subject: 'S', message: 'M' }),
    );
    provider.load();
    expect(provider.hints()).toHaveLength(1);
  });
});
