import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { EarningsRecordDetail } from '@vaultfolio/api-contract';
import { map } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  EchartComponent,
  type EchartClickEvent,
  I18nService,
  ThemeService,
  TranslatePipe,
  resolveChartPalette,
  resolveEarningsSeriesColors,
} from '@vaultfolio/frontend-shared-ui';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { EarningsService } from '../earnings.service';
import { fill, formatMoney, formatMonth, formatPercent } from '../earnings-format';
import { CareerSummaryComponent } from './career-summary/career-summary.component';
import {
  type ChartFormat,
  type ChartLabels,
  type GrossMode,
  type MonthRange,
  grossPerYearOption,
  monthlyOption,
  ratiosOption,
} from './charts/earnings-charts';
import { EarningsEmptyStateComponent } from './empty-state.component';
import { LatestYearKpisComponent } from './latest-year-kpis/latest-year-kpis.component';
import { MonthDetailComponent } from './month-detail/month-detail.component';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Overview tab (design.md "Overview tab"): data-check strip, career summary, latest-year KPIs,
 * gross per year, month by month (click → month detail, `?month=YYYY-MM`), deduction ratios and
 * the month detail. Without data it shows the empty state (FR-034).
 */
@Component({
  selector: 'app-earnings-overview',
  imports: [
    FormsModule,
    RouterLink,
    MessageModule,
    SelectButtonModule,
    EchartComponent,
    TranslatePipe,
    CareerSummaryComponent,
    LatestYearKpisComponent,
    MonthDetailComponent,
    EarningsEmptyStateComponent,
  ],
  template: `
    @if (store.hasData() === false) {
      <app-earnings-empty-state />
    } @else if (store.overview(); as overview) {
      @if (overview.dataCheckIssues > 0) {
        <p-message severity="warn" data-testid="earnings-check-strip">
          {{ checkStrip() }}
          <a routerLink="../check" data-testid="earnings-check-strip-link">{{
            'earnings.overview.openCheck' | translate
          }}</a>
        </p-message>
      }

      <app-earnings-career-summary [entries]="overview.career" />
      <app-earnings-latest-year-kpis [latest]="overview.latestYear" />

      <section class="card">
        <div class="card__head">
          <div>
            <h2>{{ 'earnings.overview.grossPerYear' | translate }}</h2>
            <p class="muted">{{ 'earnings.overview.grossPerYearSub' | translate }}</p>
          </div>
          <p-selectbutton
            [options]="grossModes()"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            [ngModel]="grossMode()"
            (ngModelChange)="grossMode.set($event)"
            data-testid="earnings-gross-mode"
          />
        </div>
        <div class="chart"><app-echart [option]="grossOption()" /></div>
      </section>

      <section class="card">
        <div class="card__head">
          <div>
            <h2>{{ 'earnings.overview.whereGross' | translate }}</h2>
            <p class="muted">{{ 'earnings.overview.whereGrossSub' | translate }}</p>
          </div>
          <p-selectbutton
            [options]="ranges()"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            [ngModel]="range()"
            (ngModelChange)="range.set($event)"
            [attr.aria-label]="'earnings.overview.range' | translate"
            data-testid="earnings-month-range"
          />
        </div>
        <div class="chart chart--tall" data-testid="earnings-monthly-chart">
          <app-echart [option]="monthly().option" (chartClick)="onMonthClick($event)" />
        </div>
      </section>

      <div class="pair">
        <section class="card">
          <h2>{{ 'earnings.overview.ratios' | translate }}</h2>
          <p class="muted">{{ 'earnings.overview.ratiosSub' | translate }}</p>
          <div class="chart" data-testid="earnings-ratios-chart">
            <app-echart [option]="ratiosChart()" />
          </div>
        </section>
        <section class="card">
          <app-earnings-month-detail
            [period]="selected()"
            [records]="detailRecords()"
            [loading]="detailLoading()"
          />
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .card {
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .card__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .chart {
      height: 280px;
      margin-top: 0.75rem;
    }
    .chart--tall {
      height: 320px;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
    }
    @media (max-width: 900px) {
      .pair {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class EarningsOverviewComponent {
  protected readonly store = inject(EarningsFilterStore);
  private readonly api = inject(EarningsService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly grossMode = signal<GrossMode>('total');
  protected readonly range = signal<MonthRange>('3y');
  protected readonly detailRecords = signal<EarningsRecordDetail[]>([]);
  protected readonly detailLoading = signal(false);

  /** `?month=YYYY-MM` selects the month (deep link from the Tables tab). */
  protected readonly selected = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const month = params.get('month');
        return month && PERIOD.test(month) ? month : null;
      }),
    ),
    { initialValue: null },
  );

  private readonly colors = computed(() => ({
    ...resolveEarningsSeriesColors(this.theme.theme()),
    text: resolveChartPalette(this.theme.theme()).textColor,
  }));

  private readonly labels = computed<ChartLabels>(() => {
    this.i18n.language();
    const t = (k: string) => this.i18n.translate(k);
    return {
      regular: t('earnings.terms.regular'),
      bonus: t('earnings.terms.bonusOneOff'),
      net: t('earnings.terms.net'),
      taxes: t('earnings.terms.taxes'),
      social: t('earnings.terms.social'),
      bonusMonth: t('earnings.overview.bonusMonth'),
      employerChange: t('earnings.overview.employerChange'),
    };
  });

  private readonly format = computed<ChartFormat>(() => {
    const lang = this.i18n.language();
    return {
      money: (v) => formatMoney(v.toFixed(2), lang),
      moneyWhole: (v) => formatMoney(String(v), lang, { whole: true }),
      percent: (v) => formatPercent(v, lang),
      month: (p) => formatMonth(p, lang),
    };
  });

  protected readonly grossModes = computed(() => {
    this.i18n.language();
    return [
      { label: this.i18n.translate('earnings.overview.total'), value: 'total' },
      { label: this.i18n.translate('earnings.overview.perMonthEmployed'), value: 'perMonth' },
    ];
  });

  protected readonly ranges = computed(() => {
    this.i18n.language();
    const keys = { '1y': 'range1y', '3y': 'range3y', all: 'rangeAll' } as const;
    return (['1y', '3y', 'all'] as const).map((value) => ({
      label: this.i18n.translate(`earnings.overview.${keys[value]}`),
      value,
    }));
  });

  protected readonly grossOption = computed(() =>
    grossPerYearOption(
      this.store.overview()?.yearly ?? [],
      this.grossMode(),
      this.colors(),
      this.labels(),
      this.format(),
    ),
  );

  protected readonly monthly = computed(() => {
    const overview = this.store.overview();
    return monthlyOption(
      overview?.monthly ?? [],
      this.range(),
      this.selected(),
      overview?.employerChanges ?? [],
      this.colors(),
      this.labels(),
      this.format(),
    );
  });

  // Only taxes and social share this chart, so social takes the theme teal here (taxes stay orange).
  protected readonly ratiosChart = computed(() =>
    ratiosOption(
      this.store.overview()?.yearly ?? [],
      { ...this.colors(), social: this.colors().net },
      this.labels(),
      this.format(),
    ),
  );

  protected readonly checkStrip = computed(() => {
    const count = this.store.dataCheckIssues();
    this.i18n.language();
    return count === 1
      ? this.i18n.translate('earnings.overview.checkIssueOne')
      : fill(this.i18n.translate('earnings.overview.checkIssueMany'), { count });
  });

  constructor() {
    effect((onCleanup) => {
      const period = this.selected();
      const employerId = this.store.employerId();
      this.store.query();
      if (!period) {
        this.detailRecords.set([]);
        return;
      }
      this.detailLoading.set(true);
      const subscription = this.api.records(period).subscribe({
        next: (records) => {
          this.detailRecords.set(
            employerId ? records.filter((r) => r.employerId === employerId) : records,
          );
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected onMonthClick(event: EchartClickEvent): void {
    const period = this.monthly().periods[event.dataIndex];
    if (!period) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: period },
      queryParamsHandling: 'merge',
    });
  }
}
