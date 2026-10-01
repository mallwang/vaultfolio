import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { findRequestType, requestTypeLabel } from '@vaultfolio/requests';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';

/** Confirmation (role=status): what was sent, when, and how long the sample is kept. */
@Component({
  selector: 'app-request-sent-step',
  imports: [RouterLink, ButtonModule, MessageModule, TranslatePipe],
  template: `
    <p-message severity="success" role="status" data-testid="request-sent">
      <strong>{{ 'requests.wizard.sent.title' | translate }}</strong>
      {{ 'requests.wizard.sent.text' | translate }}
    </p-message>
    @if (store.sent()?.possibleDuplicate) {
      <p-message severity="info" data-testid="request-duplicate">{{
        'requests.wizard.sent.duplicate' | translate
      }}</p-message>
    }
    <dl class="facts">
      <dt>{{ 'requests.wizard.sent.feature' | translate }}</dt>
      <dd>{{ label().feature }}</dd>
      <dt>{{ 'requests.wizard.sent.request' | translate }}</dt>
      <dd>{{ label().type }}</dd>
      <dt>{{ 'requests.wizard.sent.sentAt' | translate }}</dt>
      <dd>{{ sentAt() }}</dd>
      <dt>{{ 'requests.wizard.sent.keptUntil' | translate }}</dt>
      <dd>{{ 'requests.wizard.sent.keptUntilValue' | translate }}</dd>
    </dl>
    <a pButton routerLink="/app/earnings/import" data-testid="request-back-to-import">
      {{ 'requests.wizard.backToImport' | translate }}
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
    .facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    dd {
      margin: 0;
    }
  `,
})
export class SentStepComponent {
  protected readonly store = inject(ParserRequestStore);
  private readonly i18n = inject(I18nService);

  protected label(): { feature: string; type: string } {
    const lang = this.i18n.language() === 'de' ? 'de' : 'en';
    const definition = findRequestType('earnings', 'new-parser');
    return definition
      ? requestTypeLabel(definition, lang)
      : { feature: 'earnings', type: 'new-parser' };
  }

  protected sentAt(): string {
    const iso = this.store.sent()?.submittedAt;
    return iso ? new Date(iso).toLocaleString(this.i18n.language()) : '';
  }
}
