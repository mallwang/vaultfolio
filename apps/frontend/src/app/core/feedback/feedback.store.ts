import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import type {
  FeedbackCategory,
  FeedbackLanguage,
  FeedbackQuota,
  SendFeedbackRequest,
  SendFeedbackResponse,
} from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { type FeedbackDraft, isDraftEmpty } from './feedback-draft';
import { FeedbackDraftStorage } from './feedback-draft-storage';

/** Suffix of the `feedback.errors.*` translation key shown in the error banner. */
export type FeedbackErrorKey = 'deliveryFailed' | 'unavailable' | 'network' | 'botProtection';

@Injectable({ providedIn: 'root' })
export class FeedbackStore {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(MessageService);
  private readonly storage = inject(FeedbackDraftStorage);

  readonly open = signal(false);
  readonly category = signal<FeedbackCategory>('feature');
  readonly subject = signal('');
  readonly message = signal('');
  readonly pending = signal(false);
  readonly error = signal<FeedbackErrorKey | null>(null);
  readonly quota = signal<FeedbackQuota | null>(null);

  readonly hasText = computed(
    () => !isDraftEmpty({ subject: this.subject(), message: this.message() }),
  );
  readonly limited = computed(() => (this.quota()?.remaining ?? 1) <= 0);

  /** Kept across retries of a failed send so the server can dedupe; renewed after success/discard. */
  private attemptId = crypto.randomUUID();

  openDialog(): void {
    const draft = this.storage.load();
    this.category.set(draft?.category ?? 'feature');
    this.subject.set(draft?.subject ?? '');
    this.message.set(draft?.message ?? '');
    this.error.set(null);
    this.open.set(true);
    this.refreshQuota();
  }

  /** Confirmed discard: forget the text and the stored draft, then close. */
  discard(): void {
    this.storage.clear();
    this.finish();
  }

  /** Close but keep the text as a draft for the next time the dialog opens. */
  keepDraft(): void {
    this.storage.save({
      category: this.category(),
      subject: this.subject().trim(),
      message: this.message().trim(),
    });
    this.finish();
  }

  /** Resolves true on success (dialog closed), false on failure (dialog stays, draft stored). */
  async send(turnstileToken: string | null): Promise<boolean> {
    if (this.pending()) return false;
    const draft: FeedbackDraft = {
      category: this.category(),
      subject: this.subject().trim(),
      message: this.message().trim(),
    };
    const body: SendFeedbackRequest = {
      attemptId: this.attemptId,
      ...draft,
      language: this.i18n.language() as FeedbackLanguage,
      ...(turnstileToken ? { turnstileToken } : {}),
    };
    this.pending.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.http.post<SendFeedbackResponse>('/api/feedback', body));
      this.quota.set(res.quota);
      this.storage.clear();
      this.finish();
      this.toast.add({
        severity: 'success',
        summary: this.i18n
          .translate('feedback.toast.success')
          .replaceAll('{{remaining}}', String(res.quota.remaining))
          .replaceAll('{{limit}}', String(res.quota.limit)),
      });
      return true;
    } catch (err) {
      this.storage.save(draft);
      this.error.set(this.mapError(err));
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  refreshQuota(): void {
    this.http.get<FeedbackQuota>('/api/feedback/quota').subscribe({
      next: (q) => this.quota.set(q),
      error: () => undefined, // the footer simply stays hidden; the server enforces the limit
    });
  }

  private finish(): void {
    this.attemptId = crypto.randomUUID();
    this.subject.set('');
    this.message.set('');
    this.category.set('feature');
    this.error.set(null);
    this.open.set(false);
  }

  private mapError(err: unknown): FeedbackErrorKey | null {
    if (!(err instanceof HttpErrorResponse) || err.status === 0) return 'network';
    switch (err.error?.error) {
      case 'bot_protection_failed':
        return 'botProtection';
      case 'feedback_unavailable':
        return 'unavailable';
      case 'feedback_limit_reached':
        if (err.error.quota) this.quota.set(err.error.quota);
        else this.refreshQuota();
        return null; // the limit banner (derived from quota) explains it
      default:
        return 'deliveryFailed';
    }
  }
}
