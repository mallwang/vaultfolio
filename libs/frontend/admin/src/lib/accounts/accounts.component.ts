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
import { CURRENT_USER_SOURCE, DOMAIN_REGISTRY } from '@vaultfolio/frontend-domain-access';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
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
  template: `
    <p-toast />
    <p-confirmdialog>
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    @if (lastAdminBlockedFor()) {
      <p-message severity="warn" styleClass="last-admin-banner">
        {{ ('accounts.lastAdminBlocked' | translate).replace('{{name}}', lastAdminBlockedFor() ??
        '') }}
      </p-message>
    }

    <section class="accounts-panel">
      <div class="accounts-panel__header">
        <h2>{{ 'nav.accounts' | translate }}</h2>
        <p>{{ 'accounts.subtitle' | translate }}</p>
      </div>

      @if (loadError()) {
        <p class="error-state">{{ loadError() }}</p>
      } @else {
        <p-table [value]="accounts()" [loading]="loading()" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template #header>
            <tr>
              <th scope="col">{{ 'accounts.columnName' | translate }}</th>
              <th scope="col">{{ 'accounts.columnEmail' | translate }}</th>
              <th scope="col">{{ 'accounts.columnRole' | translate }}</th>
              <th scope="col">{{ 'accounts.columnDomains' | translate }}</th>
              <th scope="col">{{ 'accounts.columnStatus' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </ng-template>
          <ng-template #body let-account>
            <tr>
              <td>{{ account.displayName }}</td>
              <td>{{ account.email }}</td>
              <td>
                <div class="role-cell">
                  <span
                    [pTooltip]="roleSelectDisabledReason(account)"
                    tooltipPosition="top"
                    appendTo="body"
                  >
                    <p-select
                      [options]="roleOptions"
                      optionLabel="label"
                      optionValue="value"
                      [ngModel]="account.role"
                      [disabled]="roleSelectDisabled(account)"
                      (onChange)="onRoleChange(account, $event.value)"
                      appendTo="body"
                    >
                      <ng-template #dropdownicon><app-icon name="chevron-down" /></ng-template>
                    </p-select>
                  </span>
                  @if (account.isLastActiveAdmin) {
                    <p-tag
                      severity="info"
                      [value]="'accounts.lastAdmin' | translate"
                      [rounded]="true"
                    />
                  }
                </div>
              </td>
              <td>
                <span
                  [pTooltip]="domainScopesDisabledReason(account)"
                  tooltipPosition="top"
                  appendTo="body"
                >
                  <p-multiselect
                    [options]="domainRegistry"
                    optionLabel="labelKey"
                    optionValue="id"
                    display="chip"
                    [ngModel]="account.role === 'ADMIN' ? [] : account.domainScopes"
                    [disabled]="account.role === 'ADMIN' || account.status === 'ARCHIVED'"
                    [placeholder]="
                      account.role === 'ADMIN'
                        ? ('accounts.allDomains' | translate)
                        : ('accounts.noDomains' | translate)
                    "
                    appendTo="body"
                    (onChange)="onDomainScopesChange(account, $event.value)"
                  >
                    <ng-template #dropdownicon><app-icon name="chevron-down" /></ng-template>
                    <ng-template let-domain #item>{{ domain.labelKey | translate }}</ng-template>
                    <ng-template let-selected #selecteditems>
                      @for (domain of selected; track domain.id) {
                        <span class="p-multiselect-chip-item">{{
                          domain.labelKey | translate
                        }}</span>
                      }
                    </ng-template>
                  </p-multiselect>
                </span>
              </td>
              <td>
                @if (account.status === 'ACTIVE') {
                  <p-tag
                    severity="success"
                    [value]="'accounts.active' | translate"
                    [rounded]="true"
                  />
                } @else {
                  <p-tag
                    severity="secondary"
                    [value]="
                      ('accounts.archivedDaysLeft' | translate).replace(
                        '{{days}}',
                        '' + daysLeft(account)
                      )
                    "
                    [rounded]="true"
                  />
                }
              </td>
              <td>
                <div class="row-actions">
                  @if (account.status === 'ACTIVE') {
                    <span [pTooltip]="archiveLabel(account)" tooltipPosition="top" appendTo="body">
                      <button
                        pButton
                        type="button"
                        iconOnly
                        severity="danger"
                        [text]="true"
                        [disabled]="account.isLastActiveAdmin"
                        [attr.aria-label]="archiveLabel(account)"
                        (click)="confirmArchive(account, $event)"
                      >
                        <app-icon name="inbox" />
                      </button>
                    </span>
                  } @else {
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="secondary"
                      [text]="true"
                      [attr.aria-label]="'accounts.reactivateAccount' | translate"
                      [pTooltip]="'accounts.reactivateAccount' | translate"
                      tooltipPosition="top"
                      appendTo="body"
                      (click)="reactivate(account)"
                    >
                      <app-icon name="replay" />
                    </button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="6">
                <div class="empty-state">{{ 'accounts.emptyState' | translate }}</div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>
  `,
  styles: `
    .accounts-panel {
      margin-bottom: 1.5rem;
    }

    .accounts-panel__header {
      margin-bottom: 0.75rem;
    }

    .role-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: nowrap;
      white-space: nowrap;
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

    ::ng-deep .last-admin-banner {
      display: block;
      margin-bottom: 1rem;
    }
  `,
})
export class AccountsComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly currentUserSource = inject(CURRENT_USER_SOURCE);
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
    if (account.id === this.currentUserSource.current()?.id) {
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
