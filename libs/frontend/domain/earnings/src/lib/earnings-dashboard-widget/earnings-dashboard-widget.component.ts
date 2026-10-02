import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EarningsOverview } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsService } from '../earnings.service';
import { fill, formatMoney, monthName } from '../earnings-format';
import { kpiTiles } from '../overview/latest-year-kpis/latest-year-kpis.component';
import { MAX_BARS, widgetFigures } from './widget-figures';

/**
 * Dashboard widget (FR-036, US7): the latest year's gross, net (with the change against the same
 * months of the previous year) and net ratio — the same figures as the Overview KPI tiles — plus
 * a ten-year gross bar chart and a footer with growth between the last two complete years and the
 * average gross per month, so the card still says something early in a year. Empty and
 * unavailable states render compactly.
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
              </div>
            }
          </dl>
          @if (bars().length > 1) {
            <div class="chart" data-testid="earnings-widget-chart">
              <p class="readout" aria-live="polite" data-testid="earnings-widget-readout">
                {{ readout() }}
              </p>
              <svg
                viewBox="0 0 300 56"
                role="group"
                [attr.aria-label]="'earnings.widget.chart' | translate"
              >
                @for (bar of bars(); track bar.year) {
                  <rect
                    class="bar"
                    [class.bar--partial]="bar.partial"
                    tabindex="0"
                    rx="2"
                    [attr.x]="bar.x"
                    [attr.y]="bar.y"
                    [attr.width]="bar.width"
                    [attr.height]="bar.height"
                    [attr.aria-label]="bar.label"
                    [attr.data-testid]="'earnings-widget-bar-' + bar.year"
                    (mouseenter)="hovered.set(bar.year)"
                    (focus)="hovered.set(bar.year)"
                    (mouseleave)="hovered.set(null)"
                    (blur)="hovered.set(null)"
                  />
                }
              </svg>
              <div class="axis" [style.padding-left.%]="(barsOffset() / 300) * 100">
                <span>{{ bars()[0].year }}</span>
                <span>{{ bars()[bars().length - 1].year }}</span>
              </div>
            </div>
          }
          <div class="foot">
            @if (growth(); as g) {
              <span data-testid="earnings-widget-growth">
                {{ g.label }}
                <strong [class]="'delta--' + g.tone">{{ g.value }}</strong>
              </span>
            }
            @if (perMonth(); as value) {
              <span data-testid="earnings-widget-permonth">
                {{ 'earnings.widget.perMonth' | translate }} <strong>{{ value }}</strong>
              </span>
            }
            @if (data.dataCheckIssues > 0) {
              <a
                class="issues"
                routerLink="/app/earnings/check"
                data-testid="earnings-widget-issues"
              >
                <app-icon name="warning" /> {{ issuesText() }}
              </a>
            }
          </div>
        } @else {
          <div class="empty">
            <p class="muted" data-testid="earnings-widget-empty">
              {{ 'earnings.empty.title' | translate }}
            </p>
            <a routerLink="/app/earnings/import" data-testid="earnings-widget-import">{{
              'earnings.toolbar.importDocuments' | translate
            }}</a>
          </div>
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
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 0.5rem 0;
      text-align: center;
      font-size: 0.85rem;
    }
    .empty .muted {
      font-size: 0.85rem;
    }
    .empty a {
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .empty a:hover {
      text-decoration: underline;
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
    .chart {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .readout {
      margin: 0;
      min-height: 1.1rem;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
      font-variant-numeric: tabular-nums;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .bar {
      fill: var(--p-primary-color);
      outline: none;
    }
    .bar--partial {
      fill: color-mix(in srgb, var(--p-primary-color) 45%, transparent);
    }
    .bar:hover,
    .bar:focus-visible {
      opacity: 0.75;
    }
    .axis {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .foot strong {
      color: var(--p-text-color);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .foot strong.delta--good {
      color: var(--p-green-700);
    }
    .foot strong.delta--bad {
      color: var(--p-red-700);
    }
    :host-context(.app-dark) .foot strong.delta--good {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .foot strong.delta--bad {
      color: var(--p-red-400);
    }
    .foot a {
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .foot a.issues {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-amber-700);
      font-weight: 500;
    }
    /* The glyph lives in app-icon's own encapsulated template, so shrinking it needs ng-deep. */
    .foot a.issues ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
    :host-context(.app-dark) .foot a.issues {
      color: var(--p-amber-400);
    }
    .foot a:hover {
      text-decoration: underline;
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
    return year
      ? fill(this.i18n.translate('earnings.widget.title'), {
          year: year.year,
          months: this.caption(),
        })
      : '';
  });

  protected readonly caption = computed(() => {
    const year = this.overview()?.latestYear;
    return year
      ? fill(this.i18n.translate('earnings.widget.months'), {
          month: monthName(year.comparedMonths[1], this.i18n.language()),
        })
      : '';
  });

  private readonly figures = computed(() => {
    const data = this.overview();
    return data ? widgetFigures(data) : null;
  });

  protected readonly hovered = signal<number | null>(null);

  protected readonly bars = computed(() => {
    const bars = this.figures()?.bars ?? [];
    const lang = this.i18n.language();
    const gap = 6;
    // Always ten slots, right-aligned, so a few years do not turn into a few huge bars.
    const width = (300 - gap * (MAX_BARS - 1)) / MAX_BARS;
    const offset = (MAX_BARS - bars.length) * (width + gap);
    const max = Math.max(...bars.map((b) => b.gross), 1);
    return bars.map((bar, i) => {
      const height = Math.max(2, (bar.gross / max) * 54);
      return {
        year: bar.year,
        partial: bar.partial,
        gross: bar.gross,
        x: offset + i * (width + gap),
        y: 56 - height,
        width,
        height,
        label: this.barLabel(bar.year, bar.gross, bar.partial, lang),
      };
    });
  });

  protected readonly barsOffset = computed(() => this.bars()[0]?.x ?? 0);

  /** The hovered or focused bar; the latest year while nothing is. */
  protected readonly readout = computed(() => {
    const bars = this.bars();
    const bar = bars.find((b) => b.year === this.hovered()) ?? bars[bars.length - 1];
    return bar?.label ?? '';
  });

  protected readonly growth = computed(() => {
    const growth = this.figures()?.growth;
    if (!growth) return null;
    const lang = this.i18n.language();
    const value = new Intl.NumberFormat(lang, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(growth.ratio);
    return {
      value,
      tone: growth.ratio >= 0 ? 'good' : 'bad',
      label: fill(this.i18n.translate('earnings.widget.growth'), {
        from: growth.from,
        to: growth.to,
      }),
    };
  });

  protected readonly perMonth = computed(() => {
    const value = this.figures()?.perMonth;
    return value ? formatMoney(value, this.i18n.language(), { whole: true }) : null;
  });

  protected readonly issuesText = computed(() =>
    fill(this.i18n.translate('earnings.widget.issues'), {
      count: this.overview()?.dataCheckIssues ?? 0,
    }),
  );

  protected readonly tiles = computed(() => {
    const year = this.overview()?.latestYear;
    if (!year) return [];
    return kpiTiles(year.current, year.previous, this.i18n.language(), (k) =>
      this.i18n.translate(k),
    ).filter((t) => ['gross', 'net', 'netRatio'].includes(t.key));
  });

  private barLabel(year: number, gross: number, partial: boolean, lang: string): string {
    const text = fill(this.i18n.translate('earnings.widget.readout'), {
      year,
      value: formatMoney(String(gross), lang, { whole: true }),
    });
    return partial ? `${text} (${this.caption()})` : text;
  }

  ngOnInit(): void {
    this.api.overview().subscribe({
      next: (overview) => this.overview.set(overview),
      error: () => this.failed.set(true),
    });
  }
}
