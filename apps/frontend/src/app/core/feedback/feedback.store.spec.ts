import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import type { FeedbackQuota } from '@vaultfolio/api-contract';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { FeedbackDraftStorage } from './feedback-draft-storage';
import { FeedbackStore } from './feedback.store';

const quota = (remaining: number, resetAt: string | null = null): FeedbackQuota => ({
  limit: 5,
  remaining,
  resetAt,
});

describe('FeedbackStore', () => {
  let store: FeedbackStore;
  let http: HttpTestingController;
  let storage: FeedbackDraftStorage;
  const toast = { add: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    toast.add.mockClear();
    const users = new FakeCurrentUserStore();
    users.setAuthenticated({ id: 'u1' } as Parameters<FakeCurrentUserStore['setAuthenticated']>[0]);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrentUserStore, useValue: users },
        { provide: MessageService, useValue: toast },
      ],
    });
    store = TestBed.inject(FeedbackStore);
    http = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(FeedbackDraftStorage);
  });

  afterEach(() => http.verify());

  function openAndFill() {
    store.openDialog();
    http.expectOne('/api/feedback/quota').flush(quota(4));
    store.subject.set(' Hi ');
    store.message.set('Body');
  }

  it('opens and loads the quota', () => {
    store.openDialog();
    http.expectOne('/api/feedback/quota').flush(quota(3));
    expect(store.open()).toBe(true);
    expect(store.quota()?.remaining).toBe(3);
  });

  it('send success closes, toasts, clears draft and updates quota', async () => {
    openAndFill();
    const p = store.send('tok');
    const req = http.expectOne('/api/feedback');
    expect(req.request.body).toMatchObject({
      category: 'feature',
      subject: 'Hi',
      message: 'Body',
      turnstileToken: 'tok',
    });
    req.flush({ id: 'f1', quota: quota(3) }, { status: 201, statusText: 'Created' });
    expect(await p).toBe(true);
    expect(store.open()).toBe(false);
    expect(store.subject()).toBe('');
    expect(storage.hasDraft()).toBe(false);
    expect(store.quota()?.remaining).toBe(3);
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: expect.stringContaining('3') }),
    );
  });

  it('double submit sends one request; retry after failure reuses the attemptId', async () => {
    openAndFill();
    const first = store.send(null);
    expect(await store.send(null)).toBe(false);
    const req = http.expectOne('/api/feedback');
    const id = req.request.body.attemptId;
    expect(store.pending()).toBe(true);
    req.flush({ error: 'feedback_delivery_failed' }, { status: 502, statusText: 'Bad Gateway' });
    expect(await first).toBe(false);
    expect(store.error()).toBe('deliveryFailed');
    expect(store.open()).toBe(true);
    expect(storage.draft()).toMatchObject({ subject: 'Hi', message: 'Body' });

    void store.send(null);
    const retry = http.expectOne('/api/feedback');
    expect(retry.request.body.attemptId).toBe(id);
    retry.flush({ id: 'f', quota: quota(3) });
    await Promise.resolve();
  });

  it.each([
    [0, 'network', undefined],
    [503, 'unavailable', 'feedback_unavailable'],
    [403, 'botProtection', 'bot_protection_failed'],
  ] as const)('maps status %i to %s and keeps the draft', async (status, key, code) => {
    openAndFill();
    const p = store.send('t');
    const req = http.expectOne('/api/feedback');
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({ error: code }, { status, statusText: 'x' });
    expect(await p).toBe(false);
    expect(store.error()).toBe(key);
    expect(storage.hasDraft()).toBe(true);
  });

  it('429 sets the quota from the body, limits, and keeps the draft without a banner error', async () => {
    openAndFill();
    const p = store.send('t');
    http
      .expectOne('/api/feedback')
      .flush(
        { error: 'feedback_limit_reached', quota: quota(0, '2026-01-01T10:00:00Z') },
        { status: 429, statusText: 'Too Many' },
      );
    expect(await p).toBe(false);
    expect(store.limited()).toBe(true);
    expect(store.error()).toBeNull();
    expect(storage.hasDraft()).toBe(true);
  });

  it('restores a stored draft on open and discard clears everything', () => {
    storage.save({ category: 'problem', subject: 'S', message: 'M' });
    store.openDialog();
    http.expectOne('/api/feedback/quota').flush(quota(5));
    expect(store.category()).toBe('problem');
    expect(store.subject()).toBe('S');
    store.discard();
    expect(store.open()).toBe(false);
    expect(store.subject()).toBe('');
    expect(storage.hasDraft()).toBe(false);
  });
});
