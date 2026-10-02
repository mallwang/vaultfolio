import { Component, inject, signal } from '@angular/core';
import type { WordDecision } from '@vaultfolio/earnings';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { SheetComponent, type WordClick } from '../sheet/sheet.component';
import { wizardText } from './wizard-text';

/** Step 2 (FR-005–FR-007): the rebuilt page, the removed personal data and an optional keep/mask choice per distinct unknown word — everything undecided is masked. */
@Component({
  selector: 'app-request-review-words-step',
  imports: [ButtonModule, MessageModule, TranslatePipe, SheetComponent],
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
      <li class="legend__masked">{{ 'requests.wizard.review.legendMasked' | translate }}</li>
      <li class="legend__kept">{{ 'requests.wizard.review.legendKept' | translate }}</li>
    </ul>

    <div class="split">
      <app-request-sheet
        class="sheet"
        [pages]="store.anon()?.pages ?? []"
        [picked]="highlighted()"
        (wordClick)="onWord($event)"
      />

      <section class="marked" data-testid="request-marked-words">
        <h3>{{ 'requests.wizard.review.markedTitle' | translate }}</h3>
        <p data-testid="request-progress">
          {{
            t('requests.wizard.review.summary', {
              kept: keptGroups(),
              total: store.decisionGroups().length,
            })
          }}
        </p>
        @if (store.removedCount() > 0) {
          <p class="removed" data-testid="request-removed-row">
            {{ t('requests.wizard.review.removedRow', { count: store.removedCount() }) }}
          </p>
        }
        @if (store.noiseCount() > 0) {
          <p class="removed" data-testid="request-noise-row">
            {{ t('requests.wizard.review.noiseRow', { count: store.noiseCount() }) }}
          </p>
        }
        @if (store.decisionGroups().length > 0) {
          <div class="bulk">
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              outlined
              data-testid="request-keep-all"
              (click)="decideAll('KEEP')"
            >
              {{ 'requests.wizard.review.keepAll' | translate }}
            </button>
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              outlined
              data-testid="request-mask-all"
              (click)="decideAll('MASK')"
            >
              {{ 'requests.wizard.review.maskAll' | translate }}
            </button>
          </div>
        }
        <div class="list">
          @for (group of store.decisionGroups(); track group.text.toLowerCase()) {
            <div
              class="decision"
              role="group"
              [attr.aria-label]="group.text"
              (mouseenter)="highlight(group.keys)"
              (mouseleave)="highlight([])"
              (focusin)="highlight(group.keys)"
              (focusout)="highlight([])"
            >
              <span class="decision__word"
                >{{ group.text }}
                @if (group.keys.length > 1) {
                  <span class="decision__count">×{{ group.keys.length }}</span>
                }
              </span>
              <span class="decision__buttons">
                <button
                  pButton
                  type="button"
                  size="small"
                  [outlined]="group.mark !== 'KEPT'"
                  [severity]="group.mark === 'KEPT' ? 'success' : 'secondary'"
                  [attr.aria-pressed]="group.mark === 'KEPT'"
                  [attr.data-testid]="'request-decision-' + group.keys[0] + '-keep'"
                  (click)="store.decideMany(group.keys, group.mark === 'KEPT' ? 'MASK' : 'KEEP')"
                >
                  {{ 'requests.wizard.review.keep' | translate }}
                </button>
              </span>
            </div>
          } @empty {
            <p>{{ 'requests.wizard.review.noWords' | translate }}</p>
          }
        </div>
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
    .legend__masked {
      background: var(--p-surface-200);
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
    .sheet {
      position: sticky;
      top: 1rem;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: calc(100dvh - 22rem);
      min-height: 8rem;
      overflow-y: auto;
    }
    .bulk {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .decision__count {
      color: var(--p-text-muted-color);
      font-size: 0.8rem;
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
  protected readonly highlighted = signal<ReadonlySet<string>>(new Set());
  protected readonly store = inject(ParserRequestStore);
  protected readonly t = wizardText();

  /** Groups whose occurrences are all kept as labels. */
  protected keptGroups(): number {
    return this.store.decisionGroups().filter((g) => g.mark === 'KEPT').length;
  }

  protected decideAll(decision: WordDecision): void {
    this.store.decideMany(
      this.store.decisionGroups().flatMap((group) => group.keys),
      decision,
    );
  }

  protected highlight(keys: readonly string[]): void {
    this.highlighted.set(new Set(keys));
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
