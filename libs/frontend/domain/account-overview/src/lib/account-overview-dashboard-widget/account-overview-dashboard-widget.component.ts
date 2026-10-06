import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import {
  EmptyTileComponent,
  TranslatePipe,
  WidgetHeaderComponent,
} from '@vaultfolio/frontend-shared-ui';
import { countByCategory } from '../account-categories';
import { AccountOverviewService, isAccountOverviewUnavailable } from '../account-overview.service';

const AREA = '/app/account-overview';

/**
 * Dashboard tile: total number of accounts, the count per category in use and a link to the
 * overview; an invitation to add the first account when none exist.
 */
@Component({
  selector: 'app-account-overview-dashboard-widget',
  imports: [TranslatePipe, EmptyTileComponent, WidgetHeaderComponent],
  template: `
    <div class="widget" data-testid="account-overview-widget">
      @if (failed()) {
        <p class="muted" data-testid="account-overview-widget-error">
          {{
            (unavailable() ? 'accountOverview.unavailable' : 'accountOverview.loadError')
              | translate
          }}
        </p>
      } @else if (accounts(); as list) {
        @if (list.length === 0) {
          <app-empty-tile
            [link]="area"
            testId="account-overview-widget-empty"
            [title]="'accountOverview.emptyStateTitle' | translate"
            [body]="'accountOverview.widget.emptyBody' | translate"
            [ctaLabel]="'accountOverview.addFirstAccount' | translate"
          />
        } @else {
          <app-widget-header
            [link]="area"
            linkTestId="account-overview-widget-link"
            [title]="'accountOverview.widget.total' | translate"
            [linkLabel]="'accountOverview.widget.open' | translate"
          />
          <span class="hero" data-testid="account-overview-widget-total">{{ list.length }}</span>
          <ul class="legend" data-testid="account-overview-widget-categories">
            @for (entry of categories(); track entry.category) {
              <li [attr.data-testid]="'account-overview-widget-category-' + entry.category">
                <span class="legend__name">{{
                  'accountCategory.' + entry.category | translate
                }}</span>
                <span class="legend__count">{{ entry.count }}</span>
              </li>
            }
          </ul>
          @if (decommissioned() > 0) {
            <span class="muted" data-testid="account-overview-widget-decommissioned">
              {{ decommissioned() }} {{ 'accountStatus.DECOMMISSIONED' | translate }}
            </span>
          }
        }
      }
    </div>
  `,
  styles: `
    .widget {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .hero {
      font-size: 1.8rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .legend li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .legend__name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .legend__count {
      font-variant-numeric: tabular-nums;
      color: var(--p-text-muted-color);
    }
  `,
})
export class AccountOverviewDashboardWidgetComponent implements OnInit {
  private readonly service = inject(AccountOverviewService);

  protected readonly area = AREA;
  protected readonly accounts = signal<AccountOverviewEntry[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly unavailable = signal(false);

  protected readonly categories = computed(() => countByCategory(this.accounts() ?? []));
  protected readonly decommissioned = computed(
    () => (this.accounts() ?? []).filter((account) => account.status === 'DECOMMISSIONED').length,
  );

  ngOnInit(): void {
    this.service.list().subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: (error: unknown) => {
        this.unavailable.set(isAccountOverviewUnavailable(error));
        this.failed.set(true);
      },
    });
  }
}
