import { Injectable, computed, inject, signal } from '@angular/core';
import { CurrentUserStore } from '../../auth/current-user.store';
import { type FeedbackDraft, parseDraft, serializeDraft } from './feedback-draft';

const STORAGE_PREFIX = 'vaultfolio.feedback-draft.';

/** Per-user, best-effort localStorage persistence of a failed feedback draft. */
@Injectable({ providedIn: 'root' })
export class FeedbackDraftStorage {
  private readonly currentUser = inject(CurrentUserStore);
  private readonly _draft = signal<FeedbackDraft | null>(null);

  /** Reactive view of the stored draft for the current user (call `load()` after sign-in). */
  readonly draft = this._draft.asReadonly();
  readonly hasDraft = computed(() => this._draft() !== null);

  private get key(): string {
    return `${STORAGE_PREFIX}${this.currentUser.current()?.id ?? 'anonymous'}`;
  }

  load(): FeedbackDraft | null {
    let draft: FeedbackDraft | null = null;
    try {
      draft = parseDraft(localStorage.getItem(this.key));
    } catch {
      // best-effort
    }
    this._draft.set(draft);
    return draft;
  }

  save(draft: FeedbackDraft): void {
    this._draft.set(draft);
    try {
      localStorage.setItem(this.key, serializeDraft(draft));
    } catch {
      // best-effort: kept in memory for this session only
    }
  }

  clear(): void {
    this._draft.set(null);
    try {
      localStorage.removeItem(this.key);
    } catch {
      // best-effort
    }
  }
}
