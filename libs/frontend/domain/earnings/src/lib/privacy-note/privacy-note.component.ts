import { Component } from '@angular/core';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

interface PrivacyCard {
  icon: string;
  titleKey: string;
  bodyKey: string;
}

/**
 * The privacy note (FR-035, FR-042): what happens to the documents and figures, who can see them
 * (administrators included), that the operator holds the key, and how to delete. Shown on the
 * Imports tab (anchor `#privacy`) and in the empty state.
 */
@Component({
  selector: 'app-earnings-privacy-note',
  imports: [IconComponent, TranslatePipe],
  template: `
    <section class="privacy" data-testid="earnings-privacy-note">
      <h2>{{ 'earnings.privacy.title' | translate }}</h2>
      <p class="sub">{{ 'earnings.privacy.sub' | translate }}</p>
      <div class="cards">
        @for (card of cards; track card.titleKey) {
          <div class="card">
            <app-icon [name]="card.icon" />
            <div>
              <h3>{{ card.titleKey | translate }}</h3>
              <p>{{ card.bodyKey | translate }}</p>
            </div>
          </div>
        }
      </div>
      <p class="hint">{{ 'earnings.privacy.deleteHint' | translate }}</p>
    </section>
  `,
  styles: `
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .sub,
    .hint {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem;
      margin: 0.75rem 0;
    }
    .card {
      display: flex;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .card app-icon {
      color: var(--p-primary-color);
      align-self: flex-start;
    }
    h3 {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
    }
    .card p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class PrivacyNoteComponent {
  protected readonly cards: PrivacyCard[] = [
    { icon: 'lock', titleKey: 'earnings.privacy.deviceTitle', bodyKey: 'earnings.privacy.device' },
    {
      icon: 'shield',
      titleKey: 'earnings.privacy.figuresTitle',
      bodyKey: 'earnings.privacy.figures',
    },
    {
      icon: 'visibility-off',
      titleKey: 'earnings.privacy.onlyYouTitle',
      bodyKey: 'earnings.privacy.onlyYou',
    },
  ];
}
