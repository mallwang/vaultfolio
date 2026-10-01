import { Component, OnDestroy, inject } from '@angular/core';
import { StepperModule } from 'primeng/stepper';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from './parser-request.store';
import { ConsentStepComponent } from './steps/consent.step';
import { MarkRulesStepComponent } from './steps/mark-rules.step';
import { PreviewSendStepComponent } from './steps/preview-send.step';
import { RefusedStepComponent } from './steps/refused.step';
import { ReviewWordsStepComponent } from './steps/review-words.step';
import { SentStepComponent } from './steps/sent.step';

const STEPS = [
  { value: 1, step: 'consent', label: 'requests.wizard.steps.consent' },
  { value: 2, step: 'review', label: 'requests.wizard.steps.review' },
  { value: 3, step: 'rules', label: 'requests.wizard.steps.rules' },
  { value: 4, step: 'preview', label: 'requests.wizard.steps.preview' },
] as const;

/**
 * Host of the four-step parser request (route `earnings/import/request`). All state lives in the
 * root `ParserRequestStore`, which is cleared when this page is left (FR-009).
 */
@Component({
  selector: 'app-parser-request',
  imports: [
    StepperModule,
    TranslatePipe,
    ConsentStepComponent,
    ReviewWordsStepComponent,
    MarkRulesStepComponent,
    PreviewSendStepComponent,
    SentStepComponent,
    RefusedStepComponent,
  ],
  template: `
    <h1>{{ 'requests.wizard.title' | translate }}</h1>

    @if (store.loading()) {
      <p data-testid="request-loading">{{ 'requests.wizard.loading' | translate }}</p>
    } @else if (store.refusal()) {
      <app-request-refused-step />
    } @else {
      @if (store.step() !== 'sent') {
        <div class="stepper-scroll">
          <p-stepper [value]="current()" data-testid="request-stepper">
            <p-step-list>
              @for (s of steps; track s.value) {
                <p-step [value]="s.value" [attr.data-testid]="'request-step-' + s.value">
                  {{ s.label | translate }}
                </p-step>
              }
            </p-step-list>
          </p-stepper>
        </div>
      }
      @switch (store.step()) {
        @case ('consent') {
          <app-request-consent-step />
        }
        @case ('review') {
          <app-request-review-words-step />
        }
        @case ('rules') {
          <app-request-mark-rules-step />
        }
        @case ('preview') {
          <app-request-preview-send-step />
        }
        @case ('sent') {
          <app-request-sent-step />
        }
      }
    }
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
    .stepper-scroll {
      overflow-x: auto;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
    }
  `,
})
export class ParserRequestComponent implements OnDestroy {
  protected readonly store = inject(ParserRequestStore);
  protected readonly steps = STEPS;

  protected current(): number {
    return STEPS.find((s) => s.step === this.store.step())?.value ?? 1;
  }

  ngOnDestroy(): void {
    this.store.reset();
  }
}
