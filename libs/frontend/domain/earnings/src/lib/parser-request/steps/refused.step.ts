import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { MAX_RECOGNITION_PAGES } from '@vaultfolio/frontend-document-reader';
import { wizardText } from './wizard-text';

/** The document cannot be offered (scan, password, unreadable, too large): a specific reason, never "personal data". */
@Component({
  selector: 'app-request-refused-step',
  imports: [RouterLink, ButtonModule, MessageModule, TranslatePipe],
  template: `
    <p-message severity="error" data-testid="request-refused">
      <strong>{{ 'requests.wizard.refused.title' | translate }}</strong>
      {{ reason() }}
      @if (hint(); as text) {
        <span data-testid="ocr-hint">{{ text }}</span>
      }
    </p-message>
    @if (canRetry()) {
      <button
        type="button"
        class="link"
        data-testid="ocr-instead"
        (click)="store.reofferRecognition()"
      >
        {{ 'ocr.instead' | translate }}
      </button>
    }
    <a pButton routerLink="/app/earnings/import" data-testid="request-choose-another">
      {{ 'requests.wizard.refused.chooseAnother' | translate }}
    </a>
  `,
  styles: `
    :host > * {
      flex-shrink: 0;
    }
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
    .link {
      padding: 0;
      border: none;
      background: none;
      color: var(--p-primary-color);
      cursor: pointer;
      font: inherit;
    }
  `,
})
export class RefusedStepComponent {
  protected readonly store = inject(ParserRequestStore);
  private readonly t = wizardText();

  protected hint(): string {
    const hint = this.store.recognitionHint();
    if (hint === 'TOO_MANY_PAGES') {
      return this.t('ocr.hintTooManyPages', { max: MAX_RECOGNITION_PAGES });
    }
    return hint ? this.t('ocr.hintEngineUnavailable') : '';
  }

  /** A declined or failed scan can be offered again, except when the page limit rules it out. */
  protected canRetry(): boolean {
    return (
      this.store.refusal() === 'IMAGE_ONLY' && this.store.recognitionHint() !== 'TOO_MANY_PAGES'
    );
  }

  protected reason(): string {
    const code = this.store.refusal();
    return code ? this.t(`requests.wizard.refused.${code}`) : '';
  }
}
