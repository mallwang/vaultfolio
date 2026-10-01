import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { wizardText } from './wizard-text';

/** The document cannot be offered (scan, password, unreadable, too large): a specific reason, never "personal data". */
@Component({
  selector: 'app-request-refused-step',
  imports: [RouterLink, ButtonModule, MessageModule, TranslatePipe],
  template: `
    <p-message severity="error" data-testid="request-refused">
      <strong>{{ 'requests.wizard.refused.title' | translate }}</strong>
      {{ reason() }}
    </p-message>
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
  `,
})
export class RefusedStepComponent {
  private readonly store = inject(ParserRequestStore);
  private readonly t = wizardText();

  protected reason(): string {
    const code = this.store.refusal();
    return code ? this.t(`requests.wizard.refused.${code}`) : '';
  }
}
