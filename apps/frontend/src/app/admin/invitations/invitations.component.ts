import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { InvitationSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { InviteDialogComponent } from './invite-dialog/invite-dialog.component';
import { InvitationsService } from './invitations.service';

type InvitationStatus = InvitationSummary['status'];

const STATUS_SEVERITY: Record<
  InvitationStatus,
  'success' | 'info' | 'secondary' | 'danger' | 'warn'
> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  EXPIRED: 'secondary',
  CANCELLED: 'secondary',
  SUPERSEDED: 'secondary',
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

/**
 * Invitations tab (User Story 2, FR-007–FR-013): pending/accepted/expired
 * invitations with resend/cancel row actions and an "Invite member" primary
 * action (design.md "Invitations tab"). Same refresh-after-mutation pattern
 * as `AccountsComponent` — every mutation re-fetches the list rather than
 * reconciling local state by hand (YAGNI, Principle V).
 */
@Component({
  selector: 'app-invitations',
  imports: [
    DatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    InviteDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.css',
})
export class InvitationsComponent implements OnInit {
  private readonly invitationsService = inject(InvitationsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly invitations = signal<InvitationSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);

  /**
   * A resend supersedes the prior invitation and creates a new row for the
   * same email (see `InvitationsService.resend`), so the raw list can hold
   * several rows per email. The table only ever needs each email's latest
   * one, so collapse to the most-recently-created row per email here rather
   * than teaching the backend a "latest per email" query.
   */
  protected readonly displayedInvitations = computed<InvitationSummary[]>(() => {
    const latestByEmail = new Map<string, InvitationSummary>();
    for (const invitation of this.invitations()) {
      const current = latestByEmail.get(invitation.email);
      if (!current || invitation.createdAt > current.createdAt) {
        latestByEmail.set(invitation.email, invitation);
      }
    }
    return Array.from(latestByEmail.values());
  });

  protected statusSeverity(
    status: InvitationStatus,
  ): 'success' | 'info' | 'secondary' | 'danger' | 'warn' {
    return STATUS_SEVERITY[status];
  }

  protected statusLabel(status: InvitationStatus): string {
    return STATUS_LABEL[status];
  }

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.invitationsService.list().subscribe({
      next: (invitations) => {
        this.invitations.set(invitations);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load invitations. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openInviteDialog(): void {
    this.dialogVisible.set(true);
  }

  protected onInvited(): void {
    this.refresh();
    this.messageService.add({ severity: 'success', summary: 'Invitation sent' });
  }

  protected resend(invitation: InvitationSummary): void {
    this.invitationsService.resend(invitation.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Invitation resent' });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to resend this invitation.',
        });
      },
    });
  }

  protected confirmCancel(invitation: InvitationSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: 'Cancel this invitation?',
      message: `${invitation.email} won't be able to use this invitation link anymore.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger', label: 'Cancel invitation' },
      rejectButtonProps: { severity: 'secondary', label: 'Keep it' },
      accept: () => this.cancel(invitation),
    });
  }

  private cancel(invitation: InvitationSummary): void {
    this.invitationsService.cancel(invitation.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Invitation cancelled' });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to cancel this invitation.',
        });
      },
    });
  }
}
