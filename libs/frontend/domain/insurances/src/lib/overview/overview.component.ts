import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import {
  EchartComponent,
  I18nService,
  IconComponent,
  ThemeService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import type { InsuranceGroup, UpcomingDeadline } from '@vaultfolio/insurances';
import {
  chartParts,
  groupChartOption,
  insurancesChartColors,
  timelineChartOption,
} from '../charts/insurances-charts';
import { fill, formatDateShort, formatMoney, monthName } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { daysLeftLabel } from '../insurances-view';

/**
 * Overview tab (design.md "Übersicht", Stories 2 and 3): four KPI tiles, the cost-by-group donut,
 * the payment timeline, upcoming cancellation deadlines and a gap-check summary — or the empty state.
 */
@Component({
  selector: 'app-insurances-overview',
  imports: [RouterLink, ButtonModule, EchartComponent, IconComponent, TranslatePipe],
  template: `
    @if (isEmpty()) {
      <section class="empty" data-testid="insurances-empty">
        <h2>{{ 'insurances.overview.emptyTitle' | translate }}</h2>
        <p>{{ 'insurances.overview.emptyBody' | translate }}</p>
        <div class="empty__actions">
          <a pButton routerLink="/app/insurances/new" data-testid="insurances-empty-add">
            <app-icon name="plus" /> {{ 'insurances.toolbar.addFirst' | translate }}
          </a>
          <a
            pButton
            [outlined]="true"
            severity="secondary"
            routerLink="../gap-check"
            data-testid="insurances-empty-gap"
          >
            {{ 'insurances.overview.emptyGap' | translate }}
          </a>
        </div>
      </section>
    } @else {
      <div class="kpis">
        <div class="kpi kpi--hero" data-testid="insurances-kpi-monthly">
          <span class="kpi__label">{{ 'insurances.kpi.monthly' | translate }}</span>
          <strong class="kpi__value">{{ money(monthlyTotal()) }}</strong>
          @if (hasStatutory()) {
            <span class="kpi__sub" data-testid="insurances-kpi-monthly-statutory">{{
              t('insurances.kpi.monthlyStatutory', { amount: money(summary().monthlyStatutory) })
            }}</span>
          }
        </div>
        <div class="kpi" data-testid="insurances-kpi-yearly">
          <span class="kpi__label">{{ 'insurances.kpi.yearly' | translate }}</span>
          <strong class="kpi__value">{{ money(yearlyTotal()) }}</strong>
        </div>
        <div class="kpi" data-testid="insurances-kpi-active">
          <span class="kpi__label">{{ 'insurances.kpi.active' | translate }}</span>
          <strong class="kpi__value">{{ summary().activeCount }}</strong>
        </div>
        <div
          class="kpi"
          [class.kpi--warn]="nextDeadline()?.withinWindow"
          data-testid="insurances-kpi-next"
        >
          <span class="kpi__label">{{ 'insurances.kpi.next' | translate }}</span>
          @if (nextDeadline(); as next) {
            <strong class="kpi__value">{{ date(next.date) }}</strong>
            <span class="kpi__sub">{{ next.name }} · {{ daysLeft(next.daysLeft) }}</span>
          } @else {
            <strong class="kpi__value">{{ 'insurances.kpi.none' | translate }}</strong>
          }
        </div>
      </div>

      <div class="panels">
        <section class="panel" data-testid="insurances-chart-groups">
          <h2>{{ 'insurances.chart.groupTitle' | translate }}</h2>
          @if (groups().length > 0) {
            <p class="sr-only" data-testid="insurances-chart-groups-summary">
              {{ groupSummary() }}
            </p>
            <div class="donut">
              <div class="chart chart--donut" role="img" [attr.aria-label]="groupSummary()">
                <app-echart [option]="groupOption()" />
              </div>
              <ul class="legend" data-testid="insurances-chart-groups-legend">
                @for (g of groups(); track g.group) {
                  <li>
                    <span class="swatch" [style.background]="groupColor(g.group)"></span>
                    <span class="legend__name">{{ groupLabel(g.group) }}</span>
                    <span class="legend__share">{{ percent(g.share) }}</span>
                  </li>
                }
              </ul>
            </div>
          } @else {
            <p class="muted">{{ 'insurances.chart.empty' | translate }}</p>
          }
        </section>

        <section class="panel" data-testid="insurances-chart-timeline">
          <h2>{{ t('insurances.chart.timelineTitle', { year: store.year() }) }}</h2>
          <p class="sr-only" data-testid="insurances-chart-timeline-summary">
            {{ timelineSummary() }}
          </p>
          <div class="chart" role="img" [attr.aria-label]="timelineSummary()">
            <app-echart [option]="timelineOption()" />
          </div>
        </section>
      </div>

      <div class="panels">
        <section class="panel" data-testid="insurances-upcoming">
          <h2>{{ 'insurances.upcoming.title' | translate }}</h2>
          @if (summary().upcoming.length === 0) {
            <p class="muted">{{ 'insurances.upcoming.empty' | translate }}</p>
          } @else {
            <ul class="upcoming">
              @for (u of summary().upcoming; track u.id) {
                <li
                  [class.upcoming--warn]="u.withinWindow"
                  [attr.data-testid]="'insurances-upcoming-' + u.id"
                >
                  <span class="tag" [class.tag--warn]="u.withinWindow">{{ date(u.date) }}</span>
                  <span class="upcoming__name">{{ u.name }}</span>
                  <span class="muted">{{ daysLeft(u.daysLeft) }} · {{ reminderHint(u.id) }}</span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="panel" data-testid="insurances-gap-summary">
          <h2>{{ 'insurances.overview.gapTitle' | translate }}</h2>
          @if (store.gaps().missing.length > 0) {
            <p data-testid="insurances-gap-summary-count">
              {{ t('insurances.overview.gapMissing', { count: store.gaps().missing.length }) }}
            </p>
            <ul class="missing">
              @for (m of store.gaps().missing; track m.requirement) {
                <li>{{ requirementName(m.requirement) }}</li>
              }
            </ul>
          } @else {
            <p class="muted">{{ 'insurances.overview.gapNone' | translate }}</p>
          }
          <a routerLink="../gap-check" class="link" data-testid="insurances-gap-summary-open">
            {{ 'insurances.overview.gapOpen' | translate }} <app-icon name="chevron-right" />
          </a>
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }
    .kpi,
    .panel,
    .empty {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .kpi--hero {
      border-color: var(--p-primary-color);
    }
    .kpi--warn {
      border-color: var(--p-orange-500);
    }
    .kpi__label,
    .kpi__sub,
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .kpi__value {
      font-size: 1.5rem;
      font-variant-numeric: tabular-nums;
    }
    .panels {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .chart {
      height: 16rem;
    }
    .donut {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .chart--donut {
      flex: none;
      width: 14rem;
      height: 14rem;
    }
    .legend,
    .upcoming,
    .missing {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    .legend {
      flex: 1;
    }
    .legend li,
    .upcoming li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .swatch {
      flex: none;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 0.15rem;
    }
    .legend__name,
    .upcoming__name {
      flex: 1;
      min-width: 0;
    }
    .legend__share {
      font-variant-numeric: tabular-nums;
      color: var(--p-text-muted-color);
    }
    .tag {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
      color: var(--p-text-color);
      font-size: 0.8rem;
      font-variant-numeric: tabular-nums;
    }
    .tag--warn {
      background: color-mix(in srgb, var(--p-orange-500) 20%, transparent);
      color: var(--p-orange-700, var(--p-text-color));
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.5rem;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
    }
    .empty h2 {
      margin: 0;
    }
    .empty p {
      margin: 0;
      color: var(--p-text-muted-color);
      max-width: 36rem;
    }
    .empty__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 0.5rem;
    }
    a.p-button {
      text-decoration: none;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .panels {
        grid-template-columns: minmax(0, 1fr);
      }
      .donut {
        flex-direction: column;
        align-items: stretch;
      }
      .chart--donut {
        width: 100%;
      }
    }
  `,
})
export class InsurancesOverviewComponent {
  protected readonly store = inject(InsurancesStore);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  protected readonly summary = this.store.summary;
  protected readonly groups = computed(() => this.summary().byGroup);
  protected readonly nextDeadline = computed<UpcomingDeadline | null>(
    () => this.summary().upcoming[0] ?? null,
  );
  protected readonly hasStatutory = computed(() => this.summary().statutoryCount > 0);
  protected readonly monthlyTotal = computed(() => this.summary().monthlyTotal);
  protected readonly yearlyTotal = computed(() => this.summary().yearlyTotal);
  protected readonly isEmpty = computed(
    () =>
      this.store.loaded() &&
      this.store.contracts().length === 0 &&
      this.store.linkedSocial().length === 0,
  );

  private readonly format = computed(() => {
    const lang = this.i18n.language();
    return {
      money: (v: number) => formatMoney(String(v), lang),
      moneyWhole: (v: number) => formatMoney(String(v), lang, true),
    };
  });

  protected readonly groupOption = computed(() => {
    this.i18n.language();
    return groupChartOption(
      this.groups(),
      (g) => this.groupLabel(g),
      this.format(),
      insurancesChartColors(this.theme.theme()),
    );
  });

  protected readonly timelineOption = computed(() => {
    const lang = this.i18n.language();
    return timelineChartOption(
      this.summary().timeline,
      (m) => monthName(m, lang, 'short'),
      this.i18n.translate('insurances.chart.payments'),
      this.format(),
      insurancesChartColors(this.theme.theme()),
    );
  });

  protected readonly groupSummary = computed(() =>
    this.t('insurances.chart.groupSummary', {
      parts: chartParts(
        this.groups().map((g) => ({
          label: this.groupLabel(g.group),
          value: this.money(g.yearly),
        })),
      ),
    }),
  );

  protected readonly timelineSummary = computed(() =>
    this.t('insurances.chart.timelineSummary', {
      year: this.store.year(),
      parts: chartParts(
        this.summary()
          .timeline.filter((x) => Number(x.amount) > 0)
          .map((x) => ({
            label: monthName(x.month, this.i18n.language(), 'short'),
            value: this.money(x.amount),
          })),
      ),
    }),
  );

  protected t(key: string, params?: Record<string, string | number>): string {
    return fill(this.i18n.translate(key), params);
  }

  protected money(value: string): string {
    return formatMoney(value, this.i18n.language());
  }

  protected date(iso: string): string {
    return formatDateShort(iso, this.i18n.language());
  }

  protected percent(share: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(share / 100);
  }

  protected daysLeft(days: number): string {
    return daysLeftLabel(days, (key, params) => this.t(key, params));
  }

  protected groupLabel(group: InsuranceGroup): string {
    return this.i18n.translate(`insurances.groups.${group}`);
  }

  protected groupColor(group: InsuranceGroup): string {
    return insurancesChartColors(this.theme.theme()).groups[group];
  }

  protected requirementName(id: string): string {
    return this.i18n.translate(`insurances.requirements.${id}.name`);
  }

  protected reminderHint(id: string): string {
    const settings = this.store.settings();
    const contract = this.store.contracts().find((c) => c.id === id);
    return settings.reminders.enabled && contract?.reminderEnabled
      ? this.i18n.translate('insurances.upcoming.reminderOn')
      : this.i18n.translate('insurances.upcoming.reminderOff');
  }
}
