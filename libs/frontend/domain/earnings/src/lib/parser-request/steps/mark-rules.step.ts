import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';

/** Step 3 (optional, FR-010–FR-014): placeholder until the rule marking of US4 — it can only be skipped. */
@Component({
  selector: 'app-request-mark-rules-step',
  imports: [ButtonModule, MessageModule, TranslatePipe],
  template: `
    <p-message severity="info">{{ 'requests.wizard.rules.optional' | translate }}</p-message>
    <div class="actions">
      <button
        pButton
        type="button"
        severity="secondary"
        outlined
        data-testid="request-back"
        (click)="store.step.set('review')"
      >
        {{ 'requests.wizard.back' | translate }}
      </button>
      <button
        pButton
        type="button"
        severity="secondary"
        data-testid="request-skip-rules"
        (click)="store.step.set('preview')"
      >
        {{ 'requests.wizard.rules.skip' | translate }}
      </button>
      <button
        pButton
        type="button"
        data-testid="request-continue"
        (click)="store.step.set('preview')"
      >
        {{ 'requests.wizard.continue' | translate }}
      </button>
    </div>
  `,
  styles: `
    :host > * {
      flex-shrink: 0;
    }
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class MarkRulesStepComponent {
  protected readonly store = inject(ParserRequestStore);
}
