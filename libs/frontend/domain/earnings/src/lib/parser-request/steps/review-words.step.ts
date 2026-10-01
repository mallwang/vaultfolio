import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { SheetComponent, type WordClick } from '../sheet/sheet.component';
import { wizardText } from './wizard-text';

/** Step 2 (FR-005–FR-007): the rebuilt page, the removed personal data and one keep/mask decision per unknown word. */
@Component({
  selector: 'app-request-review-words-step',
  imports: [ButtonModule, MessageModule, ProgressBarModule, TranslatePipe, SheetComponent],
  template: `
    @if (store.removedKinds().length > 0) {
      <p-message severity="warn" data-testid="request-removed-callout">
        {{ t('requests.wizard.review.calloutRemoved', { kinds: kinds() }) }}
      </p-message>
    }
    <p class="explain">{{ 'requests.wizard.review.explain' | translate }}</p>
    <ul class="legend">
      <li class="legend__value">{{ 'requests.wizard.review.legendValue' | translate }}</li>
      <li class="legend__removed">{{ 'requests.wizard.review.legendRemoved' | translate }}</li>
      <li class="legend__undecided">{{ 'requests.wizard.review.legendUndecided' | translate }}</li>
      <li class="legend__masked">{{ 'requests.wizard.review.legendMasked' | translate }}</li>
      <li class="legend__kept">{{ 'requests.wizard.review.legendKept' | translate }}</li>
    </ul>

    <div class="split">
      <app-request-sheet [pages]="store.anon()?.pages ?? []" (wordClick)="onWord($event)" />

      <section class="marked" data-testid="request-marked-words">
        <h3>{{ 'requests.wizard.review.markedTitle' | translate }}</h3>
        <p data-testid="request-progress">
          {{
            t('requests.wizard.review.progress', {
              done: done(),
              total: store.decisionWords().length,
            })
          }}
        </p>
        <p-progressbar [value]="percent()" [showValue]="false" />
        @if (store.removedCount() > 0) {
          <p class="removed" data-testid="request-removed-row">
            {{ t('requests.wizard.review.removedRow', { count: store.removedCount() }) }}
          </p>
        }
        @for (word of store.decisionWords(); track word.key) {
          <div class="decision">
            <span class="decision__word">{{ word.original }}</span>
            <span class="decision__buttons">
              <button
                pButton
                type="button"
                size="small"
                [outlined]="word.mark !== 'KEPT'"
                [attr.aria-pressed]="word.mark === 'KEPT'"
                [attr.data-testid]="'request-decision-' + word.key + '-keep'"
                (click)="store.decide(word.key, 'KEEP')"
              >
                {{ 'requests.wizard.review.keep' | translate }}
              </button>
              <button
                pButton
                type="button"
                size="small"
                [outlined]="word.mark !== 'MASKED'"
                [attr.aria-pressed]="word.mark === 'MASKED'"
                [attr.data-testid]="'request-decision-' + word.key + '-mask'"
                (click)="store.decide(word.key, 'MASK')"
              >
                {{ 'requests.wizard.review.mask' | translate }}
              </button>
            </span>
          </div>
        } @empty {
          <p>{{ 'requests.wizard.review.noWords' | translate }}</p>
        }
      </section>
    </div>

    <div class="actions">
      <button
        pButton
        type="button"
        severity="secondary"
        outlined
        data-testid="request-back"
        (click)="store.step.set('consent')"
      >
        {{ 'requests.wizard.back' | translate }}
      </button>
      <button
        pButton
        type="button"
        [disabled]="store.pendingDecisions() > 0"
        data-testid="request-continue"
        (click)="store.step.set('rules')"
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
    .explain {
      margin: 0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 0.875rem;
    }
    .legend__value {
      border-bottom: 1px dotted var(--p-text-muted-color);
    }
    .legend__removed {
      background: var(--p-surface-300);
    }
    .legend__undecided {
      border: 1px dashed var(--p-orange-500);
    }
    .legend__masked {
      border: 1px solid var(--p-primary-color);
    }
    .legend__kept {
      border: 1px solid var(--p-green-500);
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 800px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    .marked {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 1rem;
      background: var(--p-content-background);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    h3,
    p {
      margin: 0;
    }
    .decision {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .decision__word {
      font-family: ui-monospace, monospace;
      overflow-wrap: anywhere;
    }
    .decision__buttons {
      display: flex;
      gap: 0.25rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class ReviewWordsStepComponent {
  protected readonly store = inject(ParserRequestStore);
  protected readonly t = wizardText();

  protected done(): number {
    return this.store.decisionWords().filter((w) => w.mark !== 'NEEDS_DECISION').length;
  }

  protected percent(): number {
    const total = this.store.decisionWords().length;
    return total === 0 ? 100 : Math.round((this.done() / total) * 100);
  }

  protected kinds(): string {
    return this.store
      .removedKinds()
      .map((kind) => this.t(`requests.wizard.kinds.${kind}`))
      .join(', ');
  }

  protected onWord(click: WordClick): void {
    this.store.cycle(click.page, click.line, click.index);
  }
}
