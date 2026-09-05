import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import type { AccountSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DOMAIN_REGISTRY } from '@vaultfolio/frontend-domain-access';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { CurrentUserStore } from '../../auth/current-user.store';
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
    TooltipModule,
    FormsModule,
    TranslatePipe,
    IconComponent,
    MultiSelectModule,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AccountsComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly currentUserStore = inject(CurrentUserStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslatePipe);

  protected readonly accounts = signal<AccountSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly lastAdminBlockedFor = signal<string | null>(null);

  protected readonly roleOptions = ROLE_OPTIONS;
  /** Drives the domain-scopes multi-select (T030, contracts/domain-access.md). */
  protected readonly domainRegistry = DOMAIN_REGISTRY;

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
        this.loadError.set(this.translate.transform('accounts.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected archiveLabel(account: AccountSummary): string {
    return this.translate.transform(
      account.isLastActiveAdmin ? 'accounts.cannotArchiveLastAdmin' : 'accounts.archiveAccount',
    );
  }

  /** Reason the role select is disabled, or '' when it isn't — drives both the `[disabled]` binding and the wrapper's tooltip (native `disabled` controls don't fire hover events themselves), so the two can never disagree. */
  protected roleSelectDisabledReason(account: AccountSummary): string {
    if (account.id === this.currentUserStore.current()?.id) {
      return this.translate.transform('accounts.cannotChangeOwnRole');
    }
    if (account.isLastActiveAdmin) {
      return this.translate.transform('accounts.cannotChangeRoleLastAdmin');
    }
    if (account.status === 'ARCHIVED') {
      return this.translate.transform('accounts.cannotChangeRoleArchived');
    }
    return '';
  }

  protected roleSelectDisabled(account: AccountSummary): boolean {
    return this.roleSelectDisabledReason(account) !== '';
  }

  /** Reason the domain-scopes multiselect is disabled, or '' when it isn't — drives the wrapper's tooltip, mirroring `roleSelectDisabledReason`. */
  protected domainScopesDisabledReason(account: AccountSummary): string {
    if (account.role === 'ADMIN') {
      return this.translate.transform('accounts.domainScopesDisabledAdmin');
    }
    if (account.status === 'ARCHIVED') {
      return this.translate.transform('accounts.domainScopesDisabledArchived');
    }
    return '';
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
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('accounts.roleUpdated'),
        });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number; error?: { error?: string } };
        if (httpError.status === 403 && httpError.error?.error === 'forbidden') {
          // Defense-in-depth: the select is disabled for the signed-in
          // user's own row, but a stale UI (e.g. a second tab) could still
          // reach the server, which enforces this regardless (020).
          this.refresh();
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.transform('accounts.cannotChangeOwnRole'),
          });
          return;
        }
        this.handleLifecycleError(account, error, 'role');
      },
    });
  }

  /** `PATCH /accounts/:id/domain-scopes` (020, FR-004): mirrors `onRoleChange`'s refetch-on-success pattern. */
  protected onDomainScopesChange(account: AccountSummary, domainScopes: string[]): void {
    this.accountsService.updateDomainScopes(account.id, { domainScopes }).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('accounts.domainScopesUpdated'),
        });
      },
      error: () => {
        this.refresh();
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('accounts.domainScopesUpdateError'),
        });
      },
    });
  }

  protected confirmArchive(account: AccountSummary, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: this.translate.transform('accounts.archiveConfirmHeader'),
      message: this.translate
        .transform('accounts.archiveConfirmMessage')
        .replace('{{name}}', account.displayName),
      acceptButtonProps: {
        severity: 'danger',
        label: this.translate.transform('accounts.archiveAccount'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('common.cancel'),
      },
      accept: () => this.archive(account),
    });
  }

  private archive(account: AccountSummary): void {
    this.lastAdminBlockedFor.set(null);
    this.accountsService.archive(account.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('accounts.archived'),
        });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number; error?: { error?: string } };
        if (httpError.status === 409 && httpError.error?.error === 'already_archived') {
          this.refresh();
          this.messageService.add({
            severity: 'info',
            summary: this.translate.transform('accounts.alreadyArchived'),
            detail: this.translate.transform('accounts.alreadyArchivedDetail'),
          });
          return;
        }
        this.handleLifecycleError(account, error, 'archive');
      },
    });
  }

  protected reactivate(account: AccountSummary): void {
    this.accountsService.reactivate(account.id).subscribe({
      next: () => {
        this.refresh();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('accounts.reactivated'),
        });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number };
        this.refresh();
        if (httpError.status === 410) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.transform('accounts.retentionWindowPassed'),
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('accounts.reactivateError'),
        });
      },
    });
  }

  private handleLifecycleError(
    account: AccountSummary,
    error: unknown,
    kind: 'role' | 'archive',
  ): void {
    const httpError = error as { status?: number; error?: { error?: string } };
    this.refresh();
    if (httpError.status === 409 && httpError.error?.error === 'last_admin') {
      this.lastAdminBlockedFor.set(account.displayName);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.transform(
          kind === 'role'
            ? 'accounts.cannotChangeRoleLastAdmin'
            : 'accounts.cannotArchiveLastAdmin',
        ),
        detail: this.translate
          .transform('accounts.lastAdminBlocked')
          .replace('{{name}}', account.displayName),
      });
      return;
    }
    this.messageService.add({
      severity: 'error',
      summary: this.translate.transform(
        kind === 'role' ? 'accounts.changeRoleError' : 'accounts.archiveError',
      ),
    });
  }
}
