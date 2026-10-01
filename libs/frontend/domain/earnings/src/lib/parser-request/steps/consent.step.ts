import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { wizardText } from './wizard-text';

/** Step 1 (FR-002–FR-005): what stays, what is sent, who sees it — document checks and the consent box. */
@Component({
  selector: 'app-request-consent-step',
  imports: [FormsModule, RouterLink, ButtonModule, CheckboxModule, MessageModule, TranslatePipe],
  template: `
    <div class="facts">
      <section class="fact fact--device">
        <h3>{{ 'requests.wizard.consent.factDeviceTitle' | translate }}</h3>
        <p>{{ 'requests.wizard.consent.factDeviceText' | translate }}</p>
      </section>
      <section class="fact fact--sent">
        <h3>{{ 'requests.wizard.consent.factSentTitle' | translate }}</h3>
        <p>{{ 'requests.wizard.consent.factSentText' | translate }}</p>
      </section>
      <section class="fact">
        <h3>{{ 'requests.wizard.consent.factWhoTitle' | translate }}</h3>
        <p>{{ 'requests.wizard.consent.factWhoText' | translate }}</p>
      </section>
    </div>

    <section class="checks" data-testid="request-checks">
      <h3>{{ 'requests.wizard.consent.checksTitle' | translate }}</h3>
      <ul>
        <li>{{ t('requests.wizard.consent.checkReadable', { pages: pages() }) }}</li>
        @if (store.removedKinds().length > 0) {
          <li data-testid="request-check-personal">
            {{ t('requests.wizard.consent.checkPersonal', { kinds: kinds() }) }}
          </li>
        } @else {
          <li>{{ 'requests.wizard.consent.checkNoPersonal' | translate }}</li>
        }
        @if (store.coveredCount() > 0) {
          <li data-testid="request-check-covered">
            {{ t('requests.wizard.consent.checkCovered', { count: store.coveredCount() }) }}
          </li>
        }
      </ul>
    </section>

    <label class="consent">
      <p-checkbox
        [binary]="true"
        [ngModel]="store.consent()"
        (ngModelChange)="store.consent.set($event)"
        inputId="request-consent-input"
        data-testid="request-consent"
      />
      <span>{{ 'requests.wizard.consent.consentLabel' | translate }}</span>
    </label>

    <div class="actions">
      <a
        pButton
        severity="secondary"
        outlined
        routerLink="/app/earnings/import"
        data-testid="request-cancel"
      >
        {{ 'requests.wizard.cancel' | translate }}
      </a>
      <button
        pButton
        type="button"
        [disabled]="!store.consent()"
        data-testid="request-continue"
        (click)="store.step.set('review')"
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
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 1rem;
    }
    .fact,
    .checks,
    .consent {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 1rem;
      background: var(--p-content-background);
    }
    .fact--device {
      border-color: var(--p-green-500);
    }
    .fact--sent {
      border-color: var(--p-blue-500);
    }
    h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    p {
      margin: 0;
    }
    ul {
      margin: 0;
      padding-left: 1.25rem;
    }
    .consent {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      cursor: pointer;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class ConsentStepComponent {
  protected readonly store = inject(ParserRequestStore);
  protected readonly t = wizardText();

  protected pages(): number {
    return this.store.analysis()?.pages.length ?? 0;
  }

  protected kinds(): string {
    return this.store
      .removedKinds()
      .map((kind) => this.t(`requests.wizard.kinds.${kind}`))
      .join(', ');
  }
}
