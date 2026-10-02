import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { PrivacyInfoComponent } from '../privacy-note/privacy-info.component';

/** Empty state (FR-034): values are only ever read from documents — nothing can be typed in. */
@Component({
  selector: 'app-earnings-empty-state',
  imports: [
    RouterLink,
    ButtonModule,
    TagModule,
    IconComponent,
    TranslatePipe,
    PrivacyInfoComponent,
  ],
  template: `
    <div class="empty" data-testid="earnings-empty-state">
      <span class="icon"><app-icon name="payments" /></span>
      <h2>{{ 'earnings.empty.title' | translate }}</h2>
      <p>{{ 'earnings.empty.body' | translate }}</p>
      <a pButton routerLink="/app/earnings/import" data-testid="earnings-empty-import">
        <app-icon name="upload" /> {{ 'earnings.toolbar.importDocuments' | translate }}
      </a>
      <div class="chips">
        <span class="supported">{{ 'earnings.import.supported' | translate }}:</span>
        <p-tag severity="secondary" [value]="'earnings.formatChips.sap' | translate" />
        <p-tag severity="secondary" [value]="'earnings.formatChips.certificate' | translate" />
        <p-tag severity="secondary" [value]="'earnings.formatChips.export' | translate" />
      </div>
    </div>
    <app-earnings-privacy-info />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    a.p-button {
      text-decoration: none;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.75rem;
      max-width: 36rem;
      margin: 2rem auto 0;
    }
    .icon {
      display: inline-flex;
      padding: 0.875rem;
      border-radius: 50%;
      color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      font-size: 1.5rem;
    }
    h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    p {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      width: max-content;
      max-width: 100vw;
    }
    .supported {
      color: var(--p-text-muted-color);
    }
  `,
})
export class EarningsEmptyStateComponent {}
