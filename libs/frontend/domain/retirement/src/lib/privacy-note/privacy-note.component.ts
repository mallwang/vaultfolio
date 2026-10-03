import { Component } from '@angular/core';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

interface PrivacyCard {
  icon: string;
  key: 'stored' | 'encrypted' | 'operator' | 'device' | 'links';
}

/**
 * The retirement privacy note (FR-016): what is stored, that amounts and numbers are encrypted,
 * that the instance operator holds the key, that documents are read on the device only and that
 * the external links send no data. Content only: shown inside `PrivacyDialogComponent`, which the
 * toolbar link "How your data is protected" and the empty state's teaser open. Deleting lives in
 * `DangerZoneComponent` on the information tab.
 */
@Component({
  selector: 'app-retirement-privacy-note',
  imports: [IconComponent, TranslatePipe],
  template: `
    <section class="privacy" data-testid="retirement-privacy-note">
      <p class="sub">{{ 'retirement.privacy.sub' | translate }}</p>
      <div class="cards">
        @for (card of cards; track card.key) {
          <div class="card" [attr.data-testid]="'retirement-privacy-card-' + card.key">
            <app-icon [name]="card.icon" />
            <div>
              <h3>{{ 'retirement.privacy.' + card.key + '.title' | translate }}</h3>
              <p>{{ 'retirement.privacy.' + card.key + '.body' | translate }}</p>
            </div>
          </div>
        }
      </div>
      <p class="hint">{{ 'retirement.privacy.deleteHint' | translate }}</p>
    </section>
  `,
  styles: `
    .sub,
    .hint {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
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
    { icon: 'contract', key: 'stored' },
    { icon: 'lock', key: 'encrypted' },
    { icon: 'key', key: 'operator' },
    { icon: 'shield', key: 'device' },
    { icon: 'external-link', key: 'links' },
  ];
}
