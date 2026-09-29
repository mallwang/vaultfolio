import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EarningsOverview } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsService } from '../earnings.service';
import { fill, monthName } from '../earnings-format';
import { kpiTiles } from '../overview/latest-year-kpis/latest-year-kpis.component';

/**
 * Dashboard widget (FR-036, US7): the latest year's gross, net (with the change against the same
 * months of the previous year) and net ratio — the same figures as the Overview KPI tiles. Empty
 * and unavailable states render compactly.
 */
@Component({
  selector: 'app-earnings-dashboard-widget',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="widget" data-testid="earnings-widget">
      @if (api.unavailable()) {
        <p class="muted" data-testid="earnings-widget-unavailable">
          {{ 'earnings.unavailable.title' | translate }}
        </p>
      } @else if (overview(); as data) {
        @if (data.latestYear; as year) {
          <div class="head">
            <strong>{{ heading() }}</strong>
            <a routerLink="/app/earnings" data-testid="earnings-widget-open">
              {{ 'earnings.widget.open' | translate }} <app-icon name="chevron-right" />
            </a>
          </div>
          <dl class="kpis">
            @for (tile of tiles(); track tile.key) {
              <div class="kpi" [attr.data-testid]="'earnings-widget-' + tile.key">
                <dt>{{ tile.label }}</dt>
                <dd>{{ tile.value }}</dd>
                @if (tile.key === 'net' && tile.delta) {
                  <dd class="delta" [class]="'delta delta--' + tile.tone">{{ tile.delta }}</dd>
                }
                @if (tile.key === 'netRatio') {
                  <dd class="muted">{{ caption() }}</dd>
                }
              </div>
            }
          </dl>
        } @else {
          <p class="muted" data-testid="earnings-widget-empty">
            {{ 'earnings.empty.title' | translate }}
          </p>
          <a routerLink="/app/earnings/import">{{
            'earnings.toolbar.importDocuments' | translate
          }}</a>
        }
      } @else if (failed()) {
        <p class="muted">{{ 'earnings.errors.generic' | translate }}</p>
      }
    </div>
  `,
  styles: `
    .widget {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .head a {
      display: inline-flex;
      align-items: center;
      color: var(--p-primary-color);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    .kpi dt {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .kpi dd {
      margin: 0;
    }
    .kpi dd:first-of-type {
      font-size: 1.125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .delta {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
    .delta--good {
      color: var(--p-green-700);
    }
    .delta--bad {
      color: var(--p-red-700);
    }
    :host-context(.app-dark) .delta--good {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .delta--bad {
      color: var(--p-red-400);
    }
  `,
})
export class EarningsDashboardWidgetComponent implements OnInit {
  protected readonly api = inject(EarningsService);
  private readonly i18n = inject(I18nService);

  protected readonly overview = signal<EarningsOverview | null>(null);
  protected readonly failed = signal(false);

  protected readonly heading = computed(() => {
    const year = this.overview()?.latestYear;
    return year ? fill(this.i18n.translate('earnings.widget.title'), { year: year.year }) : '';
  });

  protected readonly caption = computed(() => {
    const year = this.overview()?.latestYear;
    return year
      ? fill(this.i18n.translate('earnings.widget.months'), {
          month: monthName(year.comparedMonths[1], this.i18n.language()),
        })
      : '';
  });

  protected readonly tiles = computed(() => {
    const year = this.overview()?.latestYear;
    if (!year) return [];
    return kpiTiles(year.current, year.previous, this.i18n.language(), (k) =>
      this.i18n.translate(k),
    ).filter((t) => ['gross', 'net', 'netRatio'].includes(t.key));
  });

  ngOnInit(): void {
    this.api.overview().subscribe({
      next: (overview) => this.overview.set(overview),
      error: () => this.failed.set(true),
    });
  }
}
