import { Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { PrivacyDialogComponent } from './privacy-dialog.component';

/** Compact teaser for the privacy note: one line plus a button that opens the full note as a modal. */
@Component({
  selector: 'app-earnings-privacy-info',
  imports: [ButtonModule, IconComponent, TranslatePipe, PrivacyDialogComponent],
  template: `
    <div class="info" data-testid="earnings-privacy-info">
      <app-icon name="lock" />
      <span class="info__text">{{ 'earnings.privacy.sub' | translate }}</span>
      <button
        pButton
        type="button"
        size="small"
        [text]="true"
        data-testid="earnings-privacy-open"
        (click)="open.set(true)"
      >
        {{ 'earnings.toolbar.howProtected' | translate }}
      </button>
    </div>
    <app-earnings-privacy-dialog [(visible)]="open" />
  `,
  styles: `
    .info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
      font-size: 0.875rem;
    }
    .info app-icon {
      color: var(--p-primary-color);
    }
    .info__text {
      flex: 1 1 auto;
      color: var(--p-text-muted-color);
    }
  `,
})
export class PrivacyInfoComponent {
  protected readonly open = signal(false);
}
