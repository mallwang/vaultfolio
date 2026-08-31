import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { IconComponent } from '../../shared/icon/icon.component';
import { AccountsService } from '../accounts/accounts.service';
import { RejectDialogComponent } from './reject-dialog/reject-dialog.component';
import { SignupsAdminService } from './signups.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
    DatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    RejectDialogComponent,
    TranslatePipe,
    IconComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  templateUrl: './signups.component.html',
  styleUrl: './signups.component.css',
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
