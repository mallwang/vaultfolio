import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';
import { FeedbackStore } from '../feedback.store';
import { FeedbackDialogComponent } from './feedback-dialog.component';

describe('FeedbackDialogComponent', () => {
  let fixture: ComponentFixture<FeedbackDialogComponent>;
  let store: FeedbackStore;
  let http: HttpTestingController;
  let turnstileCb: ((t: string) => void) | undefined;
  const reset = vi.fn();

  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const type = (id: string, value: string) => {
    const el = q(id) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function open(remaining = 4) {
    store.openDialog();
    http
      .expectOne('/api/feedback/quota')
      .flush({ limit: 5, remaining, resetAt: remaining ? null : '2026-01-01T18:42:00Z' });
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    reset.mockClear();
    turnstileCb = undefined;
    (window as unknown as { turnstile: unknown }).turnstile = {
      render: (_el: unknown, o: { callback: (t: string) => void }) => {
        turnstileCb = o.callback;
        return 'w1';
      },
      reset,
      remove: vi.fn(),
    };
    const users = new FakeCurrentUserStore();
    users.setAuthenticated({ id: 'u1' } as Parameters<FakeCurrentUserStore['setAuthenticated']>[0]);
    await TestBed.configureTestingModule({
      imports: [FeedbackDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrentUserStore, useValue: users },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    }).compileComponents();
    store = TestBed.inject(FeedbackStore);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FeedbackDialogComponent);
  });

  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    store.open.set(false);
    fixture.destroy();
  });

  it('is hidden until opened, then renders the form with counters', async () => {
    await settle();
    expect(q('feedback-dialog')).toBeNull();
    await open();
    expect(q('feedback-dialog')).not.toBeNull();
    expect(q('feedback-category')).not.toBeNull();
    type('feedback-subject', 'abc');
    await settle();
    expect(document.body.textContent).toContain('3 / 100');
    expect(q('feedback-quota')?.textContent).toContain('4');
  });

  it('shows required errors after blur and keeps submit disabled while invalid or without token', async () => {
    await open();
    const submit = () => (q('feedback-submit') as HTMLButtonElement).disabled;
    expect(submit()).toBe(true);
    q('feedback-subject')!.dispatchEvent(new Event('blur'));
    await settle();
    expect(q('feedback-subject')!.getAttribute('aria-invalid')).toBe('true');
    type('feedback-subject', 'S');
    type('feedback-message', 'M');
    await settle();
    expect(submit()).toBe(true); // no turnstile token yet
    turnstileCb?.('tok');
    await settle();
    expect(submit()).toBe(false);
  });

  it('sends with the token and resets turnstile after a failed attempt (retry message on 403)', async () => {
    await open();
    type('feedback-subject', 'S');
    type('feedback-message', 'M');
    turnstileCb?.('tok');
    await settle();
    q('feedback-submit')!.click();
    http
      .expectOne('/api/feedback')
      .flush({ error: 'bot_protection_failed' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    await settle();
    expect(reset).toHaveBeenCalled();
    expect(q('feedback-error-banner')).not.toBeNull();
    expect((q('feedback-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(store.subject()).toBe('S');
  });

  it('cancel with empty fields closes immediately', async () => {
    await open();
    q('feedback-cancel')!.click();
    await settle();
    expect(store.open()).toBe(false);
  });

  it('cancel with text asks for confirmation; keep returns, discard closes; Escape cancels', async () => {
    await open();
    type('feedback-subject', 'S');
    await settle();
    q('feedback-cancel')!.click();
    await settle();
    expect(q('feedback-cancel-confirm')).not.toBeNull();
    expect(store.open()).toBe(true);
    q('feedback-cancel-keep')!.click();
    await settle();
    expect(q('feedback-cancel-confirm')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(q('feedback-cancel-confirm')).not.toBeNull();
    q('feedback-cancel-discard')!.click();
    await settle();
    expect(store.open()).toBe(false);
    expect(store.subject()).toBe('');
  });

  it('at the daily limit shows the banner and disables send but keeps the fields editable', async () => {
    await open(0);
    expect(q('feedback-limit-banner')).not.toBeNull();
    type('feedback-subject', 'S');
    type('feedback-message', 'M');
    turnstileCb?.('tok');
    await settle();
    expect((q('feedback-submit') as HTMLButtonElement).disabled).toBe(true);
    expect((q('feedback-subject') as HTMLInputElement).disabled).toBe(false);
  });

  it('disables cancel while sending', async () => {
    await open();
    type('feedback-subject', 'S');
    type('feedback-message', 'M');
    turnstileCb?.('tok');
    await settle();
    q('feedback-submit')!.click();
    await settle();
    expect((q('feedback-cancel') as HTMLButtonElement).disabled).toBe(true);
    http
      .expectOne('/api/feedback')
      .flush({ id: 'x', quota: { limit: 5, remaining: 3, resetAt: null } });
    await settle();
    expect(store.open()).toBe(false);
  });
});
