import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import type { AccountSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AccountsService } from './accounts.service';

type UserRole = AccountSummary['role'];

interface RoleOption {
  label: string;
  value: UserRole;
}

const ROLE_OPTIONS: RoleOption[] = [
  { label: 'Member', value: 'MEMBER' },
  { label: 'Administrator', value: 'ADMIN' },
];

/**
 * Accounts tab (User Story 1, FR-001–FR-006): lists every account, lets an
 * admin change roles, archive, and reactivate — with the last-admin
 * invariant surfaced identically everywhere it can block an action
 * (design.md "Last-admin-blocked banner"). Every mutation re-fetches the
 * list from the server rather than reconciling local state by hand (YAGNI,
 * Principle V) — table-select controls stay correct even if a request fails.
 *
 * Also refetches on `AccountsService.changed$` — e.g. `SignupsComponent`
 * approving a sign-up creates an account this component's own `ngOnInit`
 * fetch already ran without, so nothing else would tell it to refresh short
 * of a page reload.
 */
@Component({
  selector: 'app-accounts',
  imports: [
    TableModule,
    ButtonModule,
    SelectModule,
    TagModule,
    MessageModule,
    ConfirmDialogModule,
    ToastModule,
    FormsModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AccountsComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly accounts = signal<AccountSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly lastAdminBlockedFor = signal<string | null>(null);

  protected readonly roleOptions = ROLE_OPTIONS;

  ngOnInit(): void {
    this.refresh();
    this.accountsService.changed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.accountsService.list().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load accounts. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected archiveLabel(account: AccountSummary): string {
    return account.isLastActiveAdmin ? "Can't archive the last administrator" : 'Archive account';
  }

  protected daysLeft(account: AccountSummary): number | null {
    if (!account.retentionExpiresAt) {
      return null;
    }
    const msLeft = new Date(account.retentionExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  }

  protected onRoleChange(account: AccountSummary, role: UserRole): void {
    if (role === account.role) {
      return;
    }
    this.lastAdminBlockedFor.set(null);
    this.accountsService.changeRole(account.id, { role }).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Role updated' });
      },
      error: (error: unknown) => {
        this.handleLifecycleError(account, error, 'change that role');
      },
    });
  }

  protected confirmArchive(account: AccountSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: 'Archive this account?',
      message: `${account.displayName} will be signed out immediately and won't be able to sign back in. Their data is kept for 30 days and can be restored by reactivating the account within that window.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger', label: 'Archive account' },
      rejectButtonProps: { severity: 'secondary', label: 'Cancel' },
      accept: () => this.archive(account),
    });
  }

  private archive(account: AccountSummary): void {
    this.lastAdminBlockedFor.set(null);
    this.accountsService.archive(account.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Account archived' });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number; error?: { error?: string } };
        if (httpError.status === 409 && httpError.error?.error === 'already_archived') {
          this.refresh();
          this.messageService.add({
            severity: 'info',
            summary: 'Already archived',
            detail: 'This account was already archived.',
          });
          return;
        }
        this.handleLifecycleError(account, error, 'archive this account');
      },
    });
  }

  protected reactivate(account: AccountSummary): void {
    this.accountsService.reactivate(account.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Account reactivated' });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number };
        this.refresh();
        if (httpError.status === 410) {
          this.messageService.add({
            severity: 'error',
            summary: "Retention window has passed — this account can't be reactivated.",
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to reactivate this account.',
        });
      },
    });
  }

  private handleLifecycleError(account: AccountSummary, error: unknown, action: string): void {
    const httpError = error as { status?: number; error?: { error?: string } };
    this.refresh();
    if (httpError.status === 409 && httpError.error?.error === 'last_admin') {
      this.lastAdminBlockedFor.set(account.displayName);
      this.messageService.add({
        severity: 'warn',
        summary: "Can't " + action,
        detail: `${account.displayName} is the only active administrator.`,
      });
      return;
    }
    this.messageService.add({ severity: 'error', summary: `Unable to ${action}.` });
  }
}
