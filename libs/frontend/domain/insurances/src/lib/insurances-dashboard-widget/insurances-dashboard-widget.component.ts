import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import type { UpcomingDeadline } from '@vaultfolio/insurances';
import { fill, formatDateShort, formatMoney } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';

const AREA = '/app/insurances';

/**
 * Dashboard tile (FR-017): monthly cost, yearly cost and the next cancellation deadline; an
 * invitation without contracts; a short note when the domain is unavailable (503). Reads the same
 * lib derivations as the overview, so the figures match.
 */
@Component({
  selector: 'app-insurances-dashboard-widget',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="widget" data-testid="insurances-widget">
      @if (service.unavailable()) {
        <p class="muted" data-testid="insurances-widget-unavailable">
          {{ 'insurances.widget.unavailable' | translate }}
        </p>
      } @else if (store.loaded()) {
        @if (empty()) {
          <a class="tile" [routerLink]="area" data-testid="insurances-widget-empty">
            <strong>{{ 'insurances.widget.title' | translate }}</strong>
            <span class="muted">{{ 'insurances.widget.emptyBody' | translate }}</span>
            <span class="cta">
              {{ 'insurances.widget.emptyCta' | translate }} <app-icon name="chevron-right" />
            </span>
          </a>
        } @else {
          <div class="tile">
            <div class="head">
              <strong>{{ 'insurances.widget.monthly' | translate }}</strong>
              <a [routerLink]="area" data-testid="insurances-widget-link">
                {{ 'insurances.widget.open' | translate }} <app-icon name="chevron-right" />
              </a>
            </div>
            <span class="hero" data-testid="insurances-widget-monthly">{{ monthly() }}</span>
            <span class="muted" data-testid="insurances-widget-yearly">{{ yearly() }}</span>
            <span class="muted" [class.warn]="warn()" data-testid="insurances-widget-next">{{
              next()
            }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: inherit;
      text-decoration: none;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .head a,
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      text-decoration: none;
    }
    .hero {
      font-size: 1.8rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .warn {
      color: var(--p-orange-600);
      font-weight: 600;
    }
  `,
})
export class InsurancesDashboardWidgetComponent {
  protected readonly store = inject(InsurancesStore);
  protected readonly service = inject(InsurancesService);
  private readonly i18n = inject(I18nService);
  protected readonly area = AREA;

  protected readonly empty = computed(
    () => this.store.contracts().length === 0 && this.store.linkedSocial().length === 0,
  );
  private readonly firstDeadline = computed<UpcomingDeadline | null>(
    () => this.store.summary().upcoming[0] ?? null,
  );
  protected readonly warn = computed(() => this.firstDeadline()?.withinWindow ?? false);
  protected readonly monthly = computed(() =>
    formatMoney(this.store.summary().monthlyTotal, this.i18n.language()),
  );
  protected readonly yearly = computed(() =>
    fill(this.i18n.translate('insurances.widget.yearly'), {
      amount: formatMoney(this.store.summary().yearlyTotal, this.i18n.language()),
    }),
  );
  protected readonly next = computed(() => {
    const deadline = this.firstDeadline();
    return deadline
      ? fill(this.i18n.translate('insurances.widget.next'), {
          name: deadline.name,
          date: formatDateShort(deadline.date, this.i18n.language()),
        })
      : this.i18n.translate('insurances.widget.noDeadline');
  });

  constructor() {
    this.store.ensureLoaded();
  }
}
