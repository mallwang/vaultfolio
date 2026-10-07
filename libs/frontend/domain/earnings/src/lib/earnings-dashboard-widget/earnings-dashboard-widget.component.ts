import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EarningsOverview } from '@vaultfolio/api-contract';
import {
  EmptyTileComponent,
  I18nService,
  DashboardTileComponent,
  IconComponent,
  TileValueComponent,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
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
  imports: [
    RouterLink,
    IconComponent,
    TranslatePipe,
    EmptyTileComponent,
    DashboardTileComponent,
    TileValueComponent,
  ],
  template: `
    <div class="widget" data-testid="earnings-widget">
      @if (api.unavailable()) {
        <app-dashboard-tile
          tileId="earnings"
          testIdPrefix="earnings-widget"
          [title]="'dashboard.earnings' | translate"
        >
          <p class="muted" data-testid="earnings-widget-unavailable">
            {{ 'earnings.unavailable.title' | translate }}
          </p>
        </app-dashboard-tile>
      } @else if (overview(); as data) {
        @if (data.latestYear; as year) {
          <app-dashboard-tile
            tileId="earnings"
            testIdPrefix="earnings-widget"
            link="/app/earnings"
            linkTestId="earnings-widget-open"
            [title]="heading()"
            [linkLabel]="'earnings.widget.open' | translate"
          >
            @if (grossTile(); as gross) {
              <app-tile-value data-testid="earnings-widget-gross">{{ gross.value }}</app-tile-value>
            }
            @if (netTile(); as net) {
              <span class="sub" data-testid="earnings-widget-net">
                {{ net.label }} {{ net.value }}
                @if (net.delta) {
                  <span [class]="'delta delta--' + net.tone">{{ net.delta }}</span>
                }
              </span>
            }
            <div tileChart class="chart">
              @if (bars().length > 1) {
                <div class="plot" data-testid="earnings-widget-chart">
                  <p
                    class="readout"
                    aria-live="polite"
                    [attr.title]="readout()"
                    data-testid="earnings-widget-readout"
                  >
                    {{ readout() }}
                  </p>
                  <svg
                    viewBox="0 0 300 56"
                    preserveAspectRatio="none"
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
                </div>
              }
              <div class="details">
                @if (netRatioTile(); as ratio) {
                  <span data-testid="earnings-widget-netRatio">
                    {{ ratio.label }} <strong>{{ ratio.value }}</strong>
                  </span>
                }
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
            </div>
          </app-dashboard-tile>
        } @else {
          <app-dashboard-tile
            tileId="earnings"
            testIdPrefix="earnings-widget"
            [title]="'dashboard.earnings' | translate"
          >
            <app-empty-tile
              link="/app/earnings"
              testId="earnings-widget-empty"
              [title]="'earnings.empty.title' | translate"
              [body]="'earnings.widget.emptyBody' | translate"
              [ctaLabel]="'earnings.widget.emptyCta' | translate"
            />
          </app-dashboard-tile>
        }
      } @else if (failed()) {
        <app-dashboard-tile
          tileId="earnings"
          testIdPrefix="earnings-widget"
          [title]="'dashboard.earnings' | translate"
        >
          <p class="muted">{{ 'earnings.errors.generic' | translate }}</p>
        </app-dashboard-tile>
      } @else {
        <app-dashboard-tile
          tileId="earnings"
          testIdPrefix="earnings-widget"
          [title]="'dashboard.earnings' | translate"
        />
      }
    </div>
  `,
  styles: `
    .widget {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: 0.75rem;
    }
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
    }

    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .sub {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
      font-variant-numeric: tabular-nums;
    }
    .chart {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.5rem;
      align-self: stretch;
      min-width: 0;
    }
    .plot {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.15rem;
      min-height: 3.25rem;
    }
    .readout {
      margin: 0;
      overflow: hidden;
      line-height: 1.1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
      font-variant-numeric: tabular-nums;
    }
    svg {
      display: block;
      flex: 1;
      width: 100%;
      min-height: 0;
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
    .details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .details strong {
      color: var(--p-text-color);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .details strong.delta--good {
      color: var(--p-green-700);
    }
    .details strong.delta--bad {
      color: var(--p-red-700);
    }
    :host-context(.app-dark) .details strong.delta--good {
      color: var(--p-green-400);
    }
    :host-context(.app-dark) .details strong.delta--bad {
      color: var(--p-red-400);
    }
    .details a {
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .details a.issues {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-amber-700);
      font-weight: 500;
    }
    /* The glyph lives in app-icon's own encapsulated template, so shrinking it needs ng-deep. */
    .details a.issues ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
    :host-context(.app-dark) .details a.issues {
      color: var(--p-amber-400);
    }
    .details a:hover {
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

  protected readonly grossTile = computed(() => this.tiles().find((t) => t.key === 'gross'));
  protected readonly netTile = computed(() => this.tiles().find((t) => t.key === 'net'));
  protected readonly netRatioTile = computed(() => this.tiles().find((t) => t.key === 'netRatio'));

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
