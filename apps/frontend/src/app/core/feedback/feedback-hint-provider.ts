import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import type { Hint, HintProvider } from '@vaultfolio/frontend-hints';
import { FeedbackDraftStorage } from './feedback-draft-storage';

/** Info hint while an unsent feedback draft exists; the link reopens the dialog. */
@Injectable({ providedIn: 'root' })
export class FeedbackHintProvider implements HintProvider {
  private readonly storage = inject(FeedbackDraftStorage);

  readonly hints: Signal<readonly Hint[]> = computed(() => {
    const draft = this.storage.draft();
    if (!draft) return [];
    return [
      {
        id: 'feedback.draft',
        severity: 'info',
        titleKey: 'hints.feedback.draft.title',
        descriptionKey: 'hints.feedback.draft.description',
        params: { subject: draft.subject.trim() || '…' },
        target: { commands: ['/app/dashboard'], queryParams: { feedback: 'draft' } },
        linkLabelKey: 'hints.feedback.draft.linkLabel',
      },
    ];
  });

  readonly ready = signal(true).asReadonly();

  load(): void {
    this.storage.load();
  }

  refresh(): void {
    this.storage.load();
  }
}
