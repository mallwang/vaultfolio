import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { SheetComponent } from '../sheet/sheet.component';
import { wizardText } from './wizard-text';

/** Step 4 (FR-008, FR-009, FR-018): exactly what is sent, a summary, and the only way to send it. */
@Component({
  selector: 'app-request-preview-send-step',
  imports: [ButtonModule, MessageModule, TranslatePipe, SheetComponent],
  template: `
    @if (store.recognised()) {
      <p-message severity="warn" data-testid="request-ocr-notice">
        <strong>{{ 'requests.wizard.ocr.noticeTitle' | translate }}</strong>
        {{ 'requests.wizard.ocr.notice' | translate }}
      </p-message>
    }
    <p-message severity="success">{{ 'requests.wizard.preview.callout' | translate }}</p-message>
    @if (store.recognised()) {
      <p-message severity="success" data-testid="request-ocr-removed">
        @if (store.removedKinds().length > 0) {
          {{ t('requests.wizard.ocr.removedKinds', { kinds: kinds() }) }}
        }
        {{ 'requests.wizard.ocr.lookalike' | translate }}
      </p-message>
      <p class="legend" data-testid="request-ocr-legend">
        <span class="legend__lowconf">{{
          'requests.wizard.ocr.legendLowConfidence' | translate
        }}</span>
      </p>
    }
    <div class="split">
      <app-request-sheet [pages]="store.anon()?.pages ?? []" />
      <section class="summary" data-testid="request-summary">
        <h3>{{ 'requests.wizard.preview.summaryTitle' | translate }}</h3>
        <dl>
          <dt>{{ 'requests.wizard.preview.pages' | translate }}</dt>
          <dd>{{ store.anon()?.pages?.length ?? 0 }}</dd>
          <dt>{{ 'requests.wizard.preview.kept' | translate }}</dt>
          <dd>{{ store.keptCount() }}</dd>
          <dt>{{ 'requests.wizard.preview.masked' | translate }}</dt>
          <dd>{{ store.maskedCount() }}</dd>
          <dt>{{ 'requests.wizard.preview.removed' | translate }}</dt>
          <dd>{{ store.removedCount() }}</dd>
          <dt>{{ 'requests.wizard.preview.values' | translate }}</dt>
          <dd>{{ store.valueCount() }}</dd>
          <dt>{{ 'requests.wizard.preview.rulesMarked' | translate }}</dt>
          <dd data-testid="request-summary-rules">{{ store.ruleLines().length }}</dd>
          <dt>{{ 'requests.wizard.preview.consentGiven' | translate }}</dt>
          <dd>{{ store.consent() ? '✓' : '–' }}</dd>
        </dl>
        @if (!store.canSend() && !store.sending()) {
          <p class="blocked" data-testid="request-blocked">
            {{ 'requests.wizard.preview.blocked' | translate }}
          </p>
        }
        @if (store.errorCode(); as code) {
          <p-message severity="error" data-testid="request-error">{{ errorText(code) }}</p-message>
        }
        <div class="actions">
          <button
            pButton
            type="button"
            data-testid="request-send"
            [disabled]="!store.canSend()"
            (click)="store.submit()"
          >
            {{
              (store.sending() ? 'requests.wizard.preview.sending' : 'requests.wizard.preview.send')
                | translate
            }}
          </button>
          <button
            pButton
            type="button"
            severity="danger"
            outlined
            data-testid="request-discard"
            (click)="discard()"
          >
            {{ 'requests.wizard.preview.discard' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="secondary"
            outlined
            data-testid="request-back"
            (click)="store.step.set('rules')"
          >
            {{ 'requests.wizard.back' | translate }}
          </button>
        </div>
      </section>
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
    .summary {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 1rem;
      background: var(--p-content-background);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h3,
    p,
    dl {
      margin: 0;
    }
    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.25rem 1rem;
    }
    dd {
      margin: 0;
      text-align: right;
    }
    .legend {
      margin: 0;
      font-size: 0.875rem;
    }
    .legend__lowconf {
      text-decoration: underline wavy var(--p-orange-500);
      text-underline-offset: 2px;
    }
    .blocked {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class PreviewSendStepComponent {
  protected readonly store = inject(ParserRequestStore);
  private readonly router = inject(Router);
  protected readonly t = wizardText();

  protected errorText(code: string): string {
    const specific = `requests.errors.${code}`;
    const text = this.t(specific);
    return text === specific ? this.t('requests.wizard.errorGeneric') : text;
  }

  protected kinds(): string {
    return this.store
      .removedKinds()
      .map((kind) => this.t(`requests.wizard.kinds.${kind}`))
      .join(', ');
  }

  protected discard(): void {
    this.store.reset();
    void this.router.navigate(['/app/earnings/import']);
  }
}
