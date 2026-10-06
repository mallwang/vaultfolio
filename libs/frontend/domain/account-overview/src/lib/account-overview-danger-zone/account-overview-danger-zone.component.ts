import { Component, inject, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewService } from '../account-overview.service';

/** Danger zone: deletes every account after a confirmation. */
@Component({
  selector: 'app-account-overview-danger-zone',
  imports: [ButtonModule, DialogModule, IconComponent, MessageModule, TranslatePipe],
  template: `
    <section class="danger" data-testid="account-overview-danger-zone">
      <h2>{{ 'accountOverview.danger.title' | translate }}</h2>
      <p>{{ 'accountOverview.danger.body' | translate }}</p>
      <button
        type="button"
        pButton
        severity="danger"
        data-testid="account-overview-delete-all"
        (click)="open.set(true)"
      >
        <app-icon name="trash" /> {{ 'accountOverview.danger.button' | translate }}
      </button>
    </section>
    <p-dialog
      [visible]="open()"
      (visibleChange)="$event || close()"
      [modal]="true"
      [header]="'accountOverview.danger.confirmTitle' | translate"
      [style]="{ width: '28rem' }"
    >
      <p>{{ 'accountOverview.danger.confirmBody' | translate }}</p>
      @if (failed()) {
        <p-message severity="error" data-testid="account-overview-delete-all-error">{{
          'accountOverview.danger.failed' | translate
        }}</p-message>
      }
      <ng-template #footer>
        <button
          type="button"
          pButton
          severity="secondary"
          [outlined]="true"
          data-testid="account-overview-delete-all-cancel"
          (click)="close()"
        >
          {{ 'accountOverview.danger.cancel' | translate }}
        </button>
        <button
          type="button"
          pButton
          severity="danger"
          data-testid="account-overview-delete-all-confirm"
          (click)="confirm()"
        >
          {{ 'accountOverview.danger.confirm' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host {
      display: block;
    }
    .danger {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      box-sizing: border-box;
      padding: 1rem;
      border: 1px solid var(--p-red-400);
      border-radius: var(--p-content-border-radius);
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    p {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class AccountOverviewDangerZoneComponent {
  private readonly service = inject(AccountOverviewService);

  readonly deleted = output<void>();

  protected readonly open = signal(false);
  protected readonly failed = signal(false);

  protected close(): void {
    this.open.set(false);
    this.failed.set(false);
  }

  protected confirm(): void {
    this.service.removeAll().subscribe({
      next: () => {
        this.close();
        this.deleted.emit();
      },
      error: () => this.failed.set(true),
    });
  }
}
