import { Component, computed, inject, input } from '@angular/core';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import {
  EchartComponent,
  I18nService,
  ThemeService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { sortedByDate, totalsOf } from '@vaultfolio/wealth';
import {
  type WealthChartFormat,
  chartSummary,
  classLabels,
  wealthChartColors,
  wealthChartOption,
} from '../charts/wealth-charts';
import { formatDate, formatMoney } from '../wealth-format';

/** Chart panel: stacked asset classes, hanging liabilities and the net-worth line. */
@Component({
  selector: 'app-wealth-chart-panel',
  imports: [EchartComponent, TranslatePipe],
  template: `
    <section class="panel" data-testid="wealth-chart">
      <h2>{{ 'wealth.chart.title' | translate }}</h2>
      <p class="sr-only" data-testid="wealth-chart-summary">{{ summary() }}</p>
      <div class="chart" role="img" [attr.aria-label]="summary()">
        <app-echart [option]="option()" />
      </div>
    </section>
  `,
  styles: `
    .panel {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .chart {
      height: 22rem;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .chart {
        height: 16rem;
      }
    }
  `,
})
export class WealthChartPanelComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  /** Snapshots of the chosen period (non-empty), any order. */
  readonly snapshots = input.required<readonly WealthSnapshot[]>();

  private readonly format = computed<WealthChartFormat>(() => {
    const lang = this.i18n.language();
    return {
      money: (v) => formatMoney(String(v), lang),
      moneyWhole: (v) => formatMoney(String(v), lang, { whole: true }),
      date: (iso) => formatDate(iso, lang),
    };
  });

  protected readonly summary = computed(() =>
    chartSummary(
      this.i18n.translate('wealth.chart.summary'),
      sortedByDate(this.snapshots()),
      this.format(),
      (snapshot) => totalsOf(snapshot).net,
    ),
  );

  protected readonly option = computed(() => {
    this.i18n.language();
    const sorted = sortedByDate(this.snapshots());
    const labelOf = classLabels(sorted, (id) => this.i18n.translate(`wealth.classes.${id}`));
    return wealthChartOption(
      sorted,
      labelOf,
      {
        net: this.i18n.translate('wealth.chart.net'),
        liabilities: this.i18n.translate('wealth.chart.liabilities'),
      },
      this.format(),
      wealthChartColors(this.theme.theme()),
    );
  });
}
