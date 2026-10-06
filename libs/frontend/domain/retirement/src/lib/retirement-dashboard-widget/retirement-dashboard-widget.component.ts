import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { RetirementSummary } from '@vaultfolio/api-contract';
import {
  EmptyTileComponent,
  I18nService,
  IconComponent,
  TranslatePipe,
  WidgetHeaderComponent,
} from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate, formatMoney } from '../retirement-format';
import { RetirementService } from '../retirement.service';

/**
 * Dashboard tile (US3), laid out like the earnings widget: a header with the "open" link at the
 * top right, the expected pension as the hero figure (tagged "Prognose"), the KPIs pension start,
 * guaranteed pension and monthly savings, and a guaranteed-vs-expected bar whose segments explain
 * themselves on hover/focus — the same figures as the overview, from the same summary. Only the
 * "open" link navigates; without records the tile invites to record provision, and an unavailable
 * domain (503) degrades to a short note instead of an error.
 */
@Component({
  selector: 'app-retirement-dashboard-widget',
  imports: [IconComponent, TranslatePipe, EmptyTileComponent, WidgetHeaderComponent],
  template: `
    <div class="widget" data-testid="retirement-widget">
      @if (service.unavailable()) {
        <p class="muted" data-testid="retirement-widget-unavailable">
          {{ 'retirement.widget.unavailable' | translate }}
        </p>
      } @else if (summary(); as s) {
        @if (s.items.length === 0) {
          <app-empty-tile
            link="/app/retirement"
            testId="retirement-widget-empty"
            [title]="'retirement.widget.emptyTitle' | translate"
            [body]="'retirement.widget.emptyBody' | translate"
            [ctaLabel]="'retirement.widget.emptyCta' | translate"
          />
        } @else {
          <div class="tile">
            <app-widget-header
              link="/app/retirement"
              linkTestId="retirement-widget-open"
              [title]="'retirement.widget.expected' | translate"
              [linkLabel]="'retirement.widget.open' | translate"
            />
            <div class="hero">
              <span class="hero__value" data-testid="retirement-widget-expected">
                ≈ {{ money(s.expectedMonthly) }}
              </span>
              <span class="muted">
                <span class="tag">{{ 'retirement.labels.projection' | translate }}</span>
                {{ 'retirement.widget.perMonth' | translate }}
              </span>
            </div>
            <dl class="kpis">
              <div class="kpi">
                <dt>{{ 'retirement.widget.start' | translate }}</dt>
                <dd data-testid="retirement-widget-start">
                  {{ s.pensionStart ? date(s.pensionStart.date) : '–' }}
                </dd>
              </div>
              <div class="kpi">
                <dt>{{ 'retirement.widget.guaranteed' | translate }}</dt>
                <dd data-testid="retirement-widget-guaranteed">
                  {{ money(s.guaranteedMonthly) }}
                </dd>
              </div>
              <div class="kpi">
                <dt>{{ 'retirement.widget.savings' | translate }}</dt>
                <dd data-testid="retirement-widget-savings">{{ money(s.monthlySavings) }}</dd>
              </div>
            </dl>
            <div class="chart" data-testid="retirement-widget-chart">
              <p class="readout" aria-live="polite" data-testid="retirement-widget-readout">
                {{ readout() }}
              </p>
              <div
                class="bar"
                role="group"
                [attr.aria-label]="'retirement.widget.barLabel' | translate"
              >
                <div
                  class="bar__guaranteed"
                  tabindex="0"
                  [style.width.%]="guaranteedShare()"
                  [attr.aria-label]="guaranteedText()"
                  [attr.title]="guaranteedText()"
                  data-testid="retirement-widget-bar-guaranteed"
                  (mouseenter)="hovered.set('guaranteed')"
                  (focus)="hovered.set('guaranteed')"
                  (mouseleave)="hovered.set(null)"
                  (blur)="hovered.set(null)"
                ></div>
                <div
                  class="bar__additional"
                  tabindex="0"
                  [attr.aria-label]="additionalText()"
                  [attr.title]="additionalText()"
                  data-testid="retirement-widget-bar-additional"
                  (mouseenter)="hovered.set('additional')"
                  (focus)="hovered.set('additional')"
                  (mouseleave)="hovered.set(null)"
                  (blur)="hovered.set(null)"
                ></div>
              </div>
              <div class="legend">
                <span class="legend__item">
                  <i class="swatch swatch--guaranteed"></i>
                  {{ 'retirement.widget.legendGuaranteed' | translate }}
                </span>
                <span class="legend__item">
                  <i class="swatch swatch--additional"></i>
                  {{ 'retirement.widget.legendAdditional' | translate }}
                </span>
              </div>
            </div>
            <div class="foot">
              <span data-testid="retirement-widget-contracts">{{ contracts() }}</span>
              @if (s.flags.outdatedCount > 0) {
                <span class="outdated" data-testid="retirement-widget-outdated">
                  <app-icon name="warning" /> {{ outdated() }}
                </span>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      color: inherit;
      text-decoration: none;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .hero {
      display: flex;
      flex-direction: column;
    }
    .hero__value {
      font-size: 1.5rem;
      font-weight: 600;
      font-style: italic;
      font-variant-numeric: tabular-nums;
    }
    .tag {
      display: inline-block;
      padding: 0.0625rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
      color: var(--p-text-color);
    }
    .tag {
      font-style: italic;
    }
    .outdated {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-amber-700);
      font-weight: 500;
    }
    /* The glyph lives in app-icon's own encapsulated template, so shrinking it needs ng-deep. */
    .outdated ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
    :host-context(.app-dark) .outdated {
      color: var(--p-amber-400);
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
    .bar {
      display: flex;
      height: 0.75rem;
      border-radius: 0.3rem;
      overflow: hidden;
    }
    .bar__guaranteed,
    .bar__additional {
      outline: none;
    }
    .bar__guaranteed,
    .swatch--guaranteed {
      background: var(--p-green-500);
    }
    .bar__additional {
      flex: 1;
    }
    .bar__additional,
    .swatch--additional {
      background: repeating-linear-gradient(
        45deg,
        var(--p-primary-color),
        var(--p-primary-color) 3px,
        transparent 3px,
        transparent 6px
      );
    }
    .bar__guaranteed:hover,
    .bar__guaranteed:focus-visible,
    .bar__additional:hover,
    .bar__additional:focus-visible {
      opacity: 0.75;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .legend__item {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }
    .swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.5rem;
      border-radius: 2px;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 1rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class RetirementDashboardWidgetComponent implements OnInit {
  protected readonly service = inject(RetirementService);
  private readonly i18n = inject(I18nService);

  protected readonly summary = signal<RetirementSummary | null>(null);

  /** Guaranteed share of the expected total (display only), clamped to 0–100. */
  protected readonly guaranteedShare = computed(() => {
    const s = this.summary();
    const expected = Number(s?.expectedMonthly ?? 0);
    if (!s || expected <= 0) return 0;
    return Math.min(100, (Number(s.guaranteedMonthly) / expected) * 100);
  });

  protected readonly hovered = signal<'guaranteed' | 'additional' | null>(null);

  protected readonly guaranteedText = computed(() => {
    const s = this.summary();
    return fill(this.i18n.translate('retirement.widget.barGuaranteed'), {
      amount: this.money(s?.guaranteedMonthly ?? '0'),
      share: Math.round(this.guaranteedShare()),
    });
  });

  protected readonly additionalText = computed(() =>
    fill(this.i18n.translate('retirement.widget.barAdditional'), {
      amount: this.money(this.summary()?.differenceMonthly ?? '0'),
    }),
  );

  /** The hovered or focused segment; the overall explanation while nothing is. */
  protected readonly readout = computed(() => {
    switch (this.hovered()) {
      case 'guaranteed':
        return this.guaranteedText();
      case 'additional':
        return this.additionalText();
      default:
        return this.i18n.translate('retirement.widget.barHint');
    }
  });

  protected readonly contracts = computed(() => {
    const n = this.summary()?.items.length ?? 0;
    return fill(
      this.i18n.translate(
        n === 1 ? 'retirement.widget.contractsOne' : 'retirement.widget.contracts',
      ),
      { n },
    );
  });

  protected readonly outdated = computed(() =>
    fill(this.i18n.translate('retirement.widget.outdated'), {
      n: this.summary()?.flags.outdatedCount ?? 0,
    }),
  );

  ngOnInit(): void {
    this.service.summary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language());
  }

  protected date(value: string): string {
    return formatDate(value, this.i18n.language());
  }
}
