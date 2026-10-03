import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RetirementSummary } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate, formatMoney } from '../retirement-format';
import { RetirementService } from '../retirement.service';

/**
 * Dashboard tile (US3): the expected pension as the hero figure (tagged "Prognose"), a mini
 * guaranteed-vs-expected bar with the difference, and the rows pension start, guaranteed pension
 * and monthly savings — the same figures as the overview, from the same summary. The whole tile is
 * a link to the area; without records it invites to record provision, and an unavailable domain
 * (503) degrades to a short note instead of an error.
 */
@Component({
  selector: 'app-retirement-dashboard-widget',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="widget" data-testid="retirement-widget">
      @if (service.unavailable()) {
        <p class="muted" data-testid="retirement-widget-unavailable">
          {{ 'retirement.widget.unavailable' | translate }}
        </p>
      } @else if (summary(); as s) {
        @if (s.items.length === 0) {
          <a class="tile empty" routerLink="/app/retirement" data-testid="retirement-widget-empty">
            <strong>{{ 'retirement.widget.emptyTitle' | translate }}</strong>
            <span class="muted">{{ 'retirement.widget.emptyBody' | translate }}</span>
            <span class="cta">
              {{ 'retirement.widget.emptyCta' | translate }} <app-icon name="chevron-right" />
            </span>
          </a>
        } @else {
          <a class="tile" routerLink="/app/retirement" data-testid="retirement-widget-open">
            <div class="hero">
              <span class="muted">{{ 'retirement.widget.expected' | translate }}</span>
              <span class="hero__value" data-testid="retirement-widget-expected">
                ≈ {{ money(s.expectedMonthly) }}
              </span>
              <span class="muted">
                <span class="tag">{{ 'retirement.labels.projection' | translate }}</span>
                {{ 'retirement.widget.perMonth' | translate }}
              </span>
            </div>
            <div class="bar" aria-hidden="true">
              <div class="bar__guaranteed" [style.width.%]="guaranteedShare()"></div>
              <div class="bar__additional"></div>
            </div>
            <span class="muted" data-testid="retirement-widget-difference">{{ difference() }}</span>
            <dl class="rows">
              <div>
                <dt>{{ 'retirement.widget.start' | translate }}</dt>
                <dd data-testid="retirement-widget-start">
                  {{ s.pensionStart ? date(s.pensionStart.date) : '–' }}
                </dd>
              </div>
              <div>
                <dt>{{ 'retirement.widget.guaranteed' | translate }}</dt>
                <dd class="guaranteed" data-testid="retirement-widget-guaranteed">
                  {{ money(s.guaranteedMonthly) }}
                </dd>
              </div>
              <div>
                <dt>{{ 'retirement.widget.savings' | translate }}</dt>
                <dd data-testid="retirement-widget-savings">{{ money(s.monthlySavings) }}</dd>
              </div>
            </dl>
            @if (s.flags.outdatedCount > 0) {
              <span class="badge" data-testid="retirement-widget-outdated">{{ outdated() }}</span>
            }
            <span class="cta">
              {{ 'retirement.widget.open' | translate }} <app-icon name="chevron-right" />
            </span>
          </a>
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
    .empty {
      align-items: center;
      text-align: center;
      padding: 0.5rem 0;
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
    .tag,
    .badge {
      display: inline-block;
      padding: 0.0625rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      background: var(--p-surface-100);
      color: var(--p-text-color);
    }
    .tag {
      font-style: italic;
    }
    .badge {
      align-self: flex-start;
      background: color-mix(in srgb, var(--p-orange-500) 18%, transparent);
    }
    .bar {
      display: flex;
      height: 0.625rem;
      border-radius: 0.3rem;
      overflow: hidden;
    }
    .bar__guaranteed {
      background: var(--p-green-500);
    }
    .bar__additional {
      flex: 1;
      background: repeating-linear-gradient(
        45deg,
        var(--p-primary-color),
        var(--p-primary-color) 3px,
        transparent 3px,
        transparent 6px
      );
    }
    .rows {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      margin: 0;
    }
    .rows dt {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .rows dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .rows dd.guaranteed {
      font-weight: 700;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      color: var(--p-primary-color);
      font-size: 0.875rem;
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

  protected readonly difference = computed(() =>
    fill(this.i18n.translate('retirement.widget.difference'), {
      amount: this.money(this.summary()?.differenceMonthly ?? '0'),
    }),
  );

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
