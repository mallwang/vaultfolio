import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { AccountCategory, AccountOverviewEntry } from '@vaultfolio/api-contract';
import { ACCOUNT_CATEGORIES } from '../account-category-options';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewFormComponent } from '../account-overview-form/account-overview-form.component';
import { AccountOverviewService } from '../account-overview.service';

/** One in-use category group, plus its accounts (design.md's grouped content region). */
interface AccountGroup {
  category: AccountCategory | 'ALL';
  labelKey: string;
  accounts: AccountOverviewEntry[];
}

/**
 * Account Overview page (FR-001-FR-011, US1-US3): a read-only reference
 * directory of every recorded account, grouped by category in the fixed
 * order General -> Leisure -> Savings -> Credit Card -> Other (design.md),
 * plus the add/edit/delete flows. Collapses to a single "All accounts" group
 * when every account is `OTHER` (Edge Cases) — this is not a separate mode,
 * just what the grouped view naturally reduces to.
 *
 * Inline `template`/`styles`, not `templateUrl`/`styleUrl` (020, 021):
 * this component is the `/app/account-overview` route's lazily-loaded
 * target — see `HoldingsComponent`'s identical note.
 */
@Component({
  selector: 'app-account-overview-page',
  imports: [
    ButtonModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TagModule,
    TooltipModule,
    AccountOverviewFormComponent,
    TranslatePipe,
    IconComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'account-overview-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'account-overview-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    <section class="account-overview-panel">
      <div class="account-overview-panel__header">
        <div>
          <h2>
            {{ accounts().length }}
            {{
              (accounts().length === 1
                ? 'accountOverview.countSingular'
                : 'accountOverview.countPlural'
              ) | translate
            }}
          </h2>
          <p class="account-overview-panel__subtitle">
            {{ 'accountOverview.subtitle' | translate }}
          </p>
        </div>
        @if (accounts().length > 0) {
          <button
            pButton
            data-testid="account-overview-add-account"
            type="button"
            (click)="openAddDialog()"
          >
            <app-icon name="plus" /> {{ 'accountOverview.addAccount' | translate }}
          </button>
        }
      </div>

      @if (loadError()) {
        <p class="error-state">{{ loadError() }}</p>
      } @else if (accounts().length === 0 && !loading()) {
        <div class="empty-state" data-testid="account-overview-empty-state">
          <app-icon name="account-balance" class="empty-state__icon" />
          <h2>{{ 'accountOverview.emptyStateTitle' | translate }}</h2>
          <p>{{ 'accountOverview.emptyStateBody' | translate }}</p>
          <button
            pButton
            data-testid="account-overview-add-first-account"
            type="button"
            (click)="openAddDialog()"
          >
            {{ 'accountOverview.addFirstAccount' | translate }}
          </button>
        </div>
      } @else {
        @for (group of groups(); track group.category) {
          <p-card class="account-group">
            <ng-template #header>
              <div class="account-group__header">
                <h3>{{ group.labelKey | translate }}</h3>
                <p-tag [value]="group.accounts.length.toString()" [rounded]="true" />
              </div>
            </ng-template>
            @for (account of group.accounts; track account.id) {
              <div class="account-row" [attr.data-testid]="'account-overview-row-' + account.id">
                <div class="account-row__avatar">{{ initialsFor(account.name) }}</div>
                <div class="account-row__body">
                  <div class="account-row__title">
                    <span class="account-row__name">{{ account.name }}</span>
                    @if (account.provider) {
                      @if (account.website) {
                        <a
                          [href]="account.website"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="account-row__provider"
                        >
                          {{ account.provider }} <app-icon name="external-link" />
                        </a>
                      } @else {
                        <span class="account-row__provider">{{ account.provider }}</span>
                      }
                    }
                  </div>
                  @if (account.purpose) {
                    <p class="account-row__purpose">{{ account.purpose }}</p>
                  }
                  @if (account.cardUsage || account.requiredMinimum || account.notes) {
                    <div class="account-row__chips">
                      @if (account.cardUsage) {
                        <span class="chip"
                          >{{ 'accountOverview.cardUsageLabel' | translate }}:
                          {{ account.cardUsage }}</span
                        >
                      }
                      @if (account.requiredMinimum) {
                        <span class="chip"
                          >{{ 'accountOverview.requiredMinimumLabel' | translate }}:
                          {{ account.requiredMinimum }}</span
                        >
                      }
                      @if (account.notes) {
                        <span class="chip"
                          >{{ 'accountOverview.notesLabel' | translate }}: {{ account.notes }}</span
                        >
                      }
                    </div>
                  }
                </div>
                <div class="account-row__actions">
                  <button
                    pButton
                    type="button"
                    iconOnly
                    severity="secondary"
                    [text]="true"
                    [attr.data-testid]="'account-overview-row-' + account.id + '-edit'"
                    [attr.aria-label]="'accountOverview.editAccount' | translate"
                    [pTooltip]="'accountOverview.editAccount' | translate"
                    tooltipPosition="top"
                    (click)="openEditDialog(account)"
                  >
                    <app-icon name="pencil" />
                  </button>
                  <button
                    pButton
                    type="button"
                    iconOnly
                    severity="danger"
                    [text]="true"
                    [attr.data-testid]="'account-overview-row-' + account.id + '-delete'"
                    [attr.aria-label]="'accountOverview.deleteAccount' | translate"
                    [pTooltip]="'accountOverview.deleteAccount' | translate"
                    tooltipPosition="top"
                    (click)="confirmDelete(account, $event)"
                  >
                    <app-icon name="contract-delete" />
                  </button>
                </div>
              </div>
            }
          </p-card>
        }
      }
    </section>

    <p-dialog
      [(visible)]="dialogVisible"
      [header]="
        (editingAccount() ? 'accountOverview.editAccount' : 'accountOverview.addAccount')
          | translate
      "
      [modal]="true"
      [dismissableMask]="false"
      [pt]="{ pcCloseButton: { root: { 'data-testid': 'account-overview-dialog-close' } } }"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      @if (dialogVisible()) {
        <app-account-overview-form
          [account]="editingAccount()"
          (saved)="onSaved($event)"
          (cancelled)="onCancelled()"
        />
      }
    </p-dialog>
  `,
  styles: `
    .account-overview-panel {
      margin-bottom: 1.5rem;
    }

    .account-overview-panel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .account-overview-panel__subtitle {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
    }

    .account-group {
      margin-bottom: 1rem;
    }

    .account-group__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .account-group__header h3 {
      margin: 0;
    }

    .account-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--p-content-border-color);
    }

    .account-row:first-of-type {
      border-top: none;
      padding-top: 0;
    }

    .account-row__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: var(--p-highlight-background);
      color: var(--p-primary-color);
      font-weight: 600;
      font-size: 0.8rem;
      flex-shrink: 0;
    }

    .account-row__body {
      flex: 1;
      min-width: 0;
    }

    .account-row__title {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .account-row__name {
      font-weight: 600;
    }

    .account-row__provider {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      text-decoration: none;
    }

    a.account-row__provider:hover {
      text-decoration: underline;
    }

    .account-row__purpose {
      margin: 0.15rem 0 0;
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
    }

    .account-row__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.4rem;
    }

    .chip {
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      padding: 0.15rem 0.6rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }

    .account-row__actions {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .error-state {
      color: var(--p-red-500);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      text-align: center;
    }

    .empty-state__icon {
      font-size: 2rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class AccountOverviewPageComponent implements OnInit {
  private readonly accountOverviewService = inject(AccountOverviewService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  protected readonly accounts = signal<AccountOverviewEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly dialogVisible = signal(false);
  protected readonly editingAccount = signal<AccountOverviewEntry | null>(null);

  /**
   * Category groups in the fixed order, omitting empty ones (FR-009, Edge
   * Cases) — collapses to a single "All accounts" group when every account
   * is `OTHER` (i.e. no other category has any account at all).
   */
  protected readonly groups = computed<AccountGroup[]>(() => {
    const accounts = this.accounts();
    const nonOtherCategories = ACCOUNT_CATEGORIES.filter((category) => category !== 'OTHER');
    const anyNonOtherInUse = nonOtherCategories.some((category) =>
      accounts.some((account) => account.category === category),
    );

    if (!anyNonOtherInUse) {
      return accounts.length > 0
        ? [{ category: 'ALL', labelKey: 'accountOverview.allAccounts', accounts }]
        : [];
    }

    return ACCOUNT_CATEGORIES.map((category) => ({
      category,
      labelKey: `accountCategory.${category}`,
      accounts: accounts.filter((account) => account.category === category),
    })).filter((group) => group.accounts.length > 0);
  });

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.accountOverviewService.list().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(this.translate.transform('accountOverview.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected initialsFor(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected openAddDialog(): void {
    this.editingAccount.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(account: AccountOverviewEntry): void {
    this.editingAccount.set(account);
    this.dialogVisible.set(true);
  }

  protected onSaved(account: AccountOverviewEntry): void {
    this.dialogVisible.set(false);
    const current = this.accounts();
    const index = current.findIndex((existing) => existing.id === account.id);
    if (index === -1) {
      this.accounts.set([...current, account]);
    } else {
      this.accounts.set(
        current.map((existing) => (existing.id === account.id ? account : existing)),
      );
    }
  }

  protected onCancelled(): void {
    this.dialogVisible.set(false);
  }

  protected confirmDelete(account: AccountOverviewEntry, event: Event): void {
    const template = this.translate.transform('accountOverview.deleteConfirmMessage');
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: template.replace('{{name}}', account.name),
      header: this.translate.transform('accountOverview.deleteConfirmHeader'),
      acceptButtonProps: {
        severity: 'danger',
        label: this.translate.transform('accountOverview.delete'),
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('common.cancel'),
      },
      accept: () => this.deleteAccount(account),
    });
  }

  private deleteAccount(account: AccountOverviewEntry): void {
    this.accountOverviewService.remove(account.id).subscribe({
      next: () => {
        this.accounts.set(this.accounts().filter((existing) => existing.id !== account.id));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('accountOverview.deleted'),
        });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number };
        if (httpError.status === 404) {
          // Already gone — treat as success (Edge Case: deleted elsewhere).
          this.accounts.set(this.accounts().filter((existing) => existing.id !== account.id));
          this.messageService.add({
            severity: 'info',
            summary: this.translate.transform('accountOverview.alreadyDeleted'),
            detail: this.translate.transform('accountOverview.alreadyDeletedDetail'),
          });
          this.refresh();
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('accountOverview.deleteError'),
        });
      },
    });
  }
}
