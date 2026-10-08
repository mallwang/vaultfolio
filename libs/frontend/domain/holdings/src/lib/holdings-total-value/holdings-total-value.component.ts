import { Component, computed, inject, signal } from '@angular/core';
import Decimal from 'decimal.js';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DashboardTileComponent,
  EmptyTileComponent,
  I18nService,
  TileValueComponent,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { HoldingsService } from '../holdings.service';
import { computeHoldingValue } from '../holdings-valuation';

const AREA = '/app/holdings';

/**
 * Dashboard tile with the purchase value (Kaufwert) of all holdings: quantity x purchase price of
 * ETF/SHARE/CRYPTO, summed exactly. Metal/deposit holdings and holdings without a purchase price
 * are not counted; their number is shown as a hint.
 */
@Component({
  selector: 'app-holdings-total-value',
  imports: [DashboardTileComponent, EmptyTileComponent, TileValueComponent, TranslatePipe],
  // Inline template/styles: consumed cross-package, see HoldingsDistributionComponent.
  template: `
    <app-dashboard-tile
      tileId="holdings-total-value"
      testIdPrefix="holdings-total-value"
      [title]="'dashboard.totalValue' | translate"
    >
      @switch (state()) {
        @case ('ready') {
          @if (empty()) {
            <app-empty-tile
              [link]="area"
              testId="holdings-total-value-empty"
              [title]="'holdingsTile.emptyTitle' | translate"
              [body]="'holdingsTile.emptyBody' | translate"
              [ctaLabel]="'holdingsTile.emptyCta' | translate"
            />
          } @else {
            <span class="muted" data-testid="holdings-total-value-label">{{
              'holdingsTile.purchaseValue' | translate
            }}</span>
            <app-tile-value data-testid="holdings-total-value-amount">{{
              formatted()
            }}</app-tile-value>
            @if (excluded() > 0) {
              <span class="muted" data-testid="holdings-total-value-hint">{{
                'holdingsTile.excluded' | translate: { n: excluded() }
              }}</span>
            }
          }
        }
        @case ('loading') {}
        @default {
          <p class="muted" data-testid="holdings-total-value-error">
            {{
              (state() === 'unavailable' ? 'holdingsTile.unavailable' : 'holdingsTile.error')
                | translate
            }}
          </p>
        }
      }
    </app-dashboard-tile>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class HoldingsTotalValueComponent {
  private readonly i18n = inject(I18nService);

  protected readonly area = AREA;
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  protected readonly empty = signal(true);
  protected readonly excluded = signal(0);
  protected readonly total = signal(new Decimal(0));
  protected readonly formatted = computed(() =>
    new Intl.NumberFormat(this.i18n.language(), { style: 'currency', currency: 'EUR' }).format(
      Number(this.total().toFixed(2)),
    ),
  );

  constructor() {
    inject(HoldingsService)
      .list()
      .subscribe({
        next: (holdings) => {
          let total = new Decimal(0);
          let excluded = 0;
          for (const h of holdings) {
            const value =
              h.assetType === 'PRECIOUS_METAL' || h.assetType === 'DEPOSIT_MONEY'
                ? null
                : computeHoldingValue(h);
            if (value) {
              total = total.plus(value);
            } else {
              excluded += 1;
            }
          }
          this.empty.set(holdings.length === 0);
          this.excluded.set(excluded);
          this.total.set(total);
          this.state.set('ready');
        },
        error: (e: unknown) =>
          this.state.set(
            e instanceof HttpErrorResponse && e.status === 503 ? 'unavailable' : 'error',
          ),
      });
  }
}
