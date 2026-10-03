import { Component, inject, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { RetirementService } from '../retirement.service';

interface PrivacyCard {
  icon: string;
  key: 'stored' | 'encrypted' | 'operator' | 'device' | 'links';
}

/**
 * The retirement privacy note (FR-016): what is stored, that amounts and numbers are encrypted,
 * that the instance operator holds the key, that documents are read on the device only and that
 * the external links send no data, plus the "delete all my retirement data" action (FR-015, asks
 * for confirmation; the account stays). Shown at the bottom of the information tab, which
 * the toolbar link "How your data is protected" jumps to.
 */
@Component({
  selector: 'app-retirement-privacy-note',
  imports: [ButtonModule, ConfirmDialogModule, MessageModule, IconComponent, TranslatePipe],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'retirement-delete-all-accept' } },
        pcRejectButton: { root: { 'data-testid': 'retirement-delete-all-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>
    <section class="privacy" id="retirement-privacy" data-testid="retirement-privacy-note">
      <h2>{{ 'retirement.privacy.title' | translate }}</h2>
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
      <button
        pButton
        type="button"
        severity="danger"
        [outlined]="true"
        class="delete-all"
        data-testid="retirement-delete-all"
        (click)="confirmDeleteAll()"
      >
        <app-icon name="trash" /> {{ 'retirement.privacy.deleteAll' | translate }}
      </button>
      @if (deleted()) {
        <p-message severity="success" data-testid="retirement-delete-all-done">{{
          'retirement.privacy.deleteAllDone' | translate
        }}</p-message>
      }
      @if (failed()) {
        <p-message severity="error" data-testid="retirement-delete-all-failed">{{
          'retirement.privacy.deleteAllFailed' | translate
        }}</p-message>
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
    }
    .sub,
    .hint {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .delete-all {
      margin-top: 0.75rem;
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

  private readonly service = inject(RetirementService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);

  protected readonly deleted = signal(false);
  protected readonly failed = signal(false);

  protected confirmDeleteAll(): void {
    this.confirmation.confirm({
      header: this.i18n.translate('retirement.privacy.deleteAllHeader'),
      message: this.i18n.translate('retirement.privacy.deleteAllMessage'),
      acceptLabel: this.i18n.translate('retirement.privacy.deleteAll'),
      rejectLabel: this.i18n.translate('retirement.form.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.deleted.set(false);
        this.failed.set(false);
        this.service.deleteAll().subscribe({
          next: () => this.deleted.set(true),
          error: () => this.failed.set(true),
        });
      },
    });
  }
}
