import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
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

const STATUS_LABEL: Record<SignupStatus, string> = {
  PENDING: 'Awaiting verification',
  VERIFIED: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
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
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './signups.component.html',
  styleUrl: './signups.component.css',
})
export class SignupsComponent implements OnInit {
  private readonly signupsAdminService = inject(SignupsAdminService);
  private readonly accountsService = inject(AccountsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly signups = signal<SignupSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rejectDialogVisible = signal(false);
  protected readonly rejectTarget = signal<SignupSummary | null>(null);

  protected statusSeverity(
    status: SignupStatus,
  ): 'success' | 'info' | 'secondary' | 'danger' | 'warn' {
    return STATUS_SEVERITY[status];
  }

  protected statusLabel(status: SignupStatus): string {
    return STATUS_LABEL[status];
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
        this.loadError.set('Unable to load sign-ups. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected confirmApprove(signup: SignupSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: 'Approve this sign-up?',
      message: `${signup.email} will get an active account and be notified by email.`,
      icon: 'pi pi-check-circle',
      acceptButtonProps: { severity: 'success', label: 'Approve' },
      rejectButtonProps: { severity: 'secondary', label: 'Cancel' },
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
        this.messageService.add({ severity: 'success', summary: 'Sign-up approved' });
      },
      error: () => {
        this.refresh();
        this.messageService.add({ severity: 'error', summary: 'Unable to approve this sign-up.' });
      },
    });
  }

  protected openRejectDialog(signup: SignupSummary): void {
    this.rejectTarget.set(signup);
    this.rejectDialogVisible.set(true);
  }

  protected onRejected(): void {
    this.refresh();
    this.messageService.add({ severity: 'success', summary: 'Sign-up rejected' });
  }

  protected confirmDelete(signup: SignupSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: 'Delete this sign-up entry?',
      message:
        signup.status === 'REJECTED'
          ? `This also clears ${signup.email} from the blocked list, freeing it for a new sign-up.`
          : `${signup.email} will need to sign up again if they still want an account.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger', label: 'Delete' },
      rejectButtonProps: { severity: 'secondary', label: 'Keep it' },
      accept: () => this.delete(signup),
    });
  }

  private delete(signup: SignupSummary): void {
    this.signupsAdminService.delete(signup.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Sign-up deleted' });
      },
      error: () => {
        this.refresh();
        this.messageService.add({ severity: 'error', summary: 'Unable to delete this sign-up.' });
      },
    });
  }
}
