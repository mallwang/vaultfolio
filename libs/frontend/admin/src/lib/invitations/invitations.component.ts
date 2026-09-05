import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { InvitationSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, LocaleDatePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
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

/** Translation key per status — resolved through the `translate` pipe (013, US3). */
const STATUS_LABEL_KEY: Record<InvitationStatus, string> = {
  PENDING: 'invitations.statusPending',
  ACCEPTED: 'invitations.statusAccepted',
  EXPIRED: 'invitations.statusExpired',
  CANCELLED: 'invitations.statusCancelled',
  SUPERSEDED: 'invitations.statusSuperseded',
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
    LocaleDatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    InviteDialogComponent,
    TranslatePipe,
    IconComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog>
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    <section class="invitations-panel">
      <div class="invitations-panel__header">
        <div>
          <h2>{{ 'nav.invitations' | translate }}</h2>
          <p>{{ 'invitations.subtitle' | translate }}</p>
        </div>
        <button pButton type="button" (click)="openInviteDialog()">
          <app-icon name="plus" /> {{ 'invitations.inviteMember' | translate }}
        </button>
      </div>

      @if (loadError()) {
        <p class="error-state">{{ loadError() }}</p>
      } @else {
        <p-table
          [value]="displayedInvitations()"
          [loading]="loading()"
          [tableStyle]="{ 'min-width': '50rem' }"
        >
          <ng-template #header>
            <tr>
              <th scope="col">{{ 'invitations.columnEmail' | translate }}</th>
              <th scope="col">{{ 'invitations.columnRole' | translate }}</th>
              <th scope="col">{{ 'invitations.columnSent' | translate }}</th>
              <th scope="col">{{ 'invitations.columnStatus' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </ng-template>
          <ng-template #body let-invitation>
            <tr>
              <td>{{ invitation.email }}</td>
              <td>
                {{
                  (invitation.role === 'ADMIN' ? 'header.roleAdmin' : 'header.roleMember')
                    | translate
                }}
              </td>
              <td>{{ invitation.createdAt | localeDate }}</td>
              <td>
                <p-tag
                  [severity]="statusSeverity(invitation.status)"
                  [value]="statusLabelKey(invitation.status) | translate"
                  [rounded]="true"
                />
              </td>
              <td>
                <div class="row-actions">
                  @if (invitation.status === 'PENDING') {
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="secondary"
                      [text]="true"
                      [attr.aria-label]="'invitations.resendInvitation' | translate"
                      [pTooltip]="'invitations.resendInvitation' | translate"
                      tooltipPosition="top"
                      appendTo="body"
                      (click)="resend(invitation)"
                    >
                      <app-icon name="send" />
                    </button>
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="danger"
                      [text]="true"
                      [attr.aria-label]="'invitations.cancelInvitation' | translate"
                      [pTooltip]="'invitations.cancelInvitation' | translate"
                      tooltipPosition="top"
                      appendTo="body"
                      (click)="confirmCancel(invitation, $event)"
                    >
                      <app-icon name="close" />
                    </button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="5">
                <div class="empty-state">{{ 'invitations.emptyState' | translate }}</div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>

    <app-invite-dialog
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      (created)="onInvited()"
    />
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
    }

    .invitations-panel {
      margin-bottom: 1.5rem;
    }

    .invitations-panel__header {
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

    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--p-text-muted-color);
    }
  `,
})
export class InvitationsComponent implements OnInit {
  private readonly invitationsService = inject(InvitationsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

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

  protected statusLabelKey(status: InvitationStatus): string {
    return STATUS_LABEL_KEY[status];
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
        this.loadError.set(this.translate.transform('invitations.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected openInviteDialog(): void {
    this.dialogVisible.set(true);
  }

  protected onInvited(): void {
    this.refresh();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.transform('invitations.sent'),
    });
  }

  protected resend(invitation: InvitationSummary): void {
    this.invitationsService.resend(invitation.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('invitations.resent'),
        });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('invitations.resendError'),
        });
      },
    });
  }

  protected confirmCancel(invitation: InvitationSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: this.translate.transform('invitations.cancelConfirmHeader'),
      message: this.translate
        .transform('invitations.cancelConfirmMessage')
        .replace('{{email}}', invitation.email),
      acceptButtonProps: {
        severity: 'danger',
        label: this.translate.transform('invitations.cancelInvitation'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('invitations.keepIt'),
      },
      accept: () => this.cancel(invitation),
    });
  }

  private cancel(invitation: InvitationSummary): void {
    this.invitationsService.cancel(invitation.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('invitations.cancelled'),
        });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('invitations.cancelError'),
        });
      },
    });
  }
}
