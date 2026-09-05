import { Component, OnInit, inject, signal } from '@angular/core';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, LocaleDatePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { AccountsService } from '../accounts/accounts.service';
import { RejectDialogComponent } from './reject-dialog/reject-dialog.component';
import { SignupsAdminService } from './signups.service';

type SignupStatus = SignupSummary['status'];

const STATUS_SEVERITY: Record<SignupStatus, 'success' | 'info' | 'secondary' | 'danger' | 'warn'> =
  {
    PENDING: 'secondary',
    VERIFIED: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
  };

/** Translation key per status — resolved through the `translate` pipe (013, US3). */
const STATUS_LABEL_KEY: Record<SignupStatus, string> = {
  PENDING: 'signups.statusPending',
  VERIFIED: 'signups.statusVerified',
  APPROVED: 'signups.statusApproved',
  REJECTED: 'signups.statusRejected',
};

/**
 * Sign-ups tab (User Story 2, FR-005–FR-011): admin review queue for
 * self-service sign-up requests, distinct from the Invitations/Accounts
 * tabs. Same refresh-after-mutation pattern as `InvitationsComponent` —
 * every mutation re-fetches the list rather than reconciling local state by
 * hand (YAGNI, Principle V).
 */
@Component({
  selector: 'app-signups',
  imports: [
    LocaleDatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    RejectDialogComponent,
    TranslatePipe,
    IconComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog>
      <ng-template #icon><app-icon [name]="confirmIcon()" /></ng-template>
    </p-confirmdialog>

    <section class="signups-panel">
      <div class="signups-panel__header">
        <div>
          <h2>{{ 'nav.signups' | translate }}</h2>
          <p>{{ 'signups.subtitle' | translate }}</p>
        </div>
      </div>

      @if (loadError()) {
        <p class="error-state">{{ loadError() }}</p>
      } @else {
        <p-table [value]="signups()" [loading]="loading()" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template #header>
            <tr>
              <th scope="col">{{ 'invitations.columnEmail' | translate }}</th>
              <th scope="col">{{ 'signups.columnSubmitted' | translate }}</th>
              <th scope="col">{{ 'invitations.columnStatus' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </ng-template>
          <ng-template #body let-signup>
            <tr>
              <td>{{ signup.email }}</td>
              <td>{{ signup.createdAt | localeDate }}</td>
              <td>
                <p-tag
                  [severity]="statusSeverity(signup.status)"
                  [value]="statusLabelKey(signup.status) | translate"
                  [rounded]="true"
                />
                @if (signup.accountDeletedAt) {
                  <div class="status-followup">
                    {{ 'signups.accountDeleted' | translate }}
                    {{ signup.accountDeletedAt | localeDate }}
                  </div>
                }
              </td>
              <td>
                <div class="row-actions">
                  @if (signup.status === 'VERIFIED') {
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="success"
                      [text]="true"
                      [attr.aria-label]="'signups.approveSignup' | translate"
                      [pTooltip]="'signups.approveSignup' | translate"
                      tooltipPosition="top"
                      appendTo="body"
                      (click)="confirmApprove(signup, $event)"
                    >
                      <app-icon name="check-circle" />
                    </button>
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="danger"
                      [text]="true"
                      [attr.aria-label]="'signups.rejectSignup' | translate"
                      [pTooltip]="'signups.rejectSignup' | translate"
                      tooltipPosition="top"
                      appendTo="body"
                      (click)="openRejectDialog(signup)"
                    >
                      <app-icon name="close" />
                    </button>
                  }
                  <button
                    pButton
                    type="button"
                    iconOnly
                    severity="secondary"
                    [text]="true"
                    [attr.aria-label]="'signups.deleteSignup' | translate"
                    [pTooltip]="'signups.deleteSignup' | translate"
                    tooltipPosition="top"
                    appendTo="body"
                    (click)="confirmDelete(signup, $event)"
                  >
                    <app-icon name="trash" />
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="4">
                <div class="empty-state">{{ 'signups.emptyState' | translate }}</div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>

    <app-reject-dialog
      [visible]="rejectDialogVisible()"
      [signupId]="rejectTarget()?.id ?? null"
      [signupEmail]="rejectTarget()?.email ?? ''"
      (visibleChange)="rejectDialogVisible.set($event)"
      (rejected)="onRejected()"
    />
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
    }

    .signups-panel {
      margin-bottom: 1.5rem;
    }

    .signups-panel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      justify-content: flex-end;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    .error-state {
      color: var(--p-red-500);
    }

    .status-followup {
      margin-top: 0.25rem;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--p-text-muted-color);
    }
  `,
})
export class SignupsComponent implements OnInit {
  private readonly signupsAdminService = inject(SignupsAdminService);
  private readonly accountsService = inject(AccountsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  protected readonly signups = signal<SignupSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rejectDialogVisible = signal(false);
  protected readonly rejectTarget = signal<SignupSummary | null>(null);
  /**
   * `p-confirmdialog`'s `#icon` template is static per instance, but this
   * component's two confirm() calls (approve/delete) need different icons —
   * set right before each `confirm()` call so the shared dialog picks it up.
   */
  protected readonly confirmIcon = signal<string>('warning');

  protected statusSeverity(
    status: SignupStatus,
  ): 'success' | 'info' | 'secondary' | 'danger' | 'warn' {
    return STATUS_SEVERITY[status];
  }

  protected statusLabelKey(status: SignupStatus): string {
    return STATUS_LABEL_KEY[status];
  }

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.signupsAdminService.list().subscribe({
      next: (signups) => {
        this.signups.set(signups);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(this.translate.transform('signups.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected confirmApprove(signup: SignupSummary, event: Event): void {
    this.confirmIcon.set('check-circle');
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: this.translate.transform('signups.approveConfirmHeader'),
      message: this.translate
        .transform('signups.approveConfirmMessage')
        .replace('{{email}}', signup.email),
      acceptButtonProps: {
        severity: 'success',
        label: this.translate.transform('signups.approve'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('common.cancel'),
      },
      accept: () => this.approve(signup),
    });
  }

  private approve(signup: SignupSummary): void {
    this.signupsAdminService.approve(signup.id).subscribe({
      next: () => {
        this.refresh();
        // Approving creates a new account — tell the (already-instantiated)
        // Accounts tab to refetch so it shows up without a page reload.
        this.accountsService.notifyChanged();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('signups.approved'),
        });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('signups.approveError'),
        });
      },
    });
  }

  protected openRejectDialog(signup: SignupSummary): void {
    this.rejectTarget.set(signup);
    this.rejectDialogVisible.set(true);
  }

  protected onRejected(): void {
    this.refresh();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.transform('signups.rejected'),
    });
  }

  protected confirmDelete(signup: SignupSummary, event: Event): void {
    this.confirmIcon.set('warning');
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: this.translate.transform('signups.deleteConfirmHeader'),
      message: this.translate
        .transform(
          signup.status === 'REJECTED'
            ? 'signups.deleteConfirmMessageRejected'
            : 'signups.deleteConfirmMessage',
        )
        .replace('{{email}}', signup.email),
      acceptButtonProps: { severity: 'danger', label: this.translate.transform('holdings.delete') },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('invitations.keepIt'),
      },
      accept: () => this.delete(signup),
    });
  }

  private delete(signup: SignupSummary): void {
    this.signupsAdminService.delete(signup.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('signups.deleted'),
        });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('signups.deleteError'),
        });
      },
    });
  }
}
