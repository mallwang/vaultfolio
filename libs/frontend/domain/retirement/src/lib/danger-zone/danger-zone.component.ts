import { Component, inject, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { RetirementService } from '../retirement.service';

/**
 * "Delete all my retirement data" (FR-015): a danger zone like the earnings imports tab's, at the
 * bottom of the information tab. Asks for confirmation; the account stays.
 */
@Component({
  selector: 'app-retirement-danger-zone',
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
    <section class="panel danger" data-testid="retirement-danger-zone">
      <h2>{{ 'retirement.privacy.dangerTitle' | translate }}</h2>
      <p class="muted">{{ 'retirement.privacy.dangerSub' | translate }}</p>
      <button
        pButton
        type="button"
        severity="danger"
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
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .danger {
      align-items: flex-start;
      padding: 1rem;
      border: 1px solid var(--p-red-400);
      border-radius: var(--p-content-border-radius);
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class DangerZoneComponent {
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
