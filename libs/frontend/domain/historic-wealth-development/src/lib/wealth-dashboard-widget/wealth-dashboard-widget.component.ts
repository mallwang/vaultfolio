import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  I18nService,
  IconComponent,
  ThemeService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate, formatMoney, formatPct, formatShare } from '../wealth-format';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';
import { classLabels, wealthChartColors } from '../charts/wealth-charts';
import { sortedByDate } from '@vaultfolio/wealth';
import { widgetFiguresOf } from './widget-figures';

const AREA = '/app/historic-wealth-development';

/**
 * Dashboard tile (design.md "Dashboard tile"): only the "Zum Vermögen" link in the header leads to the wealth page (the empty state is one big call to action). With
 * two or more snapshots it shows the latest net worth, the change since the previous snapshot with
 * percent and date, the asset-class composition bar, the reference date and, below a divider, the asset and liability rows; with one snapshot a
 * hint to record a second; without data an invitation. An unavailable domain (503) degrades to a
 * short note. Reads the same lib derivations as the overview, so the figures match (SC-005).
 */
@Component({
  selector: 'app-wealth-dashboard-widget',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="widget" data-testid="wealth-widget">
      @if (service.unavailable()) {
        <p class="muted" data-testid="wealth-widget-unavailable">
          {{ 'wealth.widget.unavailable' | translate }}
        </p>
      } @else if (store.loaded()) {
        @switch (figures().kind) {
          @case ('empty') {
            <a class="tile empty" [routerLink]="area" data-testid="wealth-widget-empty">
              <strong>{{ 'wealth.widget.title' | translate }}</strong>
              <span class="muted">{{ 'wealth.widget.emptyBody' | translate }}</span>
              <span class="cta">
                {{ 'wealth.widget.emptyCta' | translate }} <app-icon name="chevron-right" />
              </span>
            </a>
          }
          @default {
            <div class="tile">
              <div class="head">
                <strong>{{ 'wealth.widget.net' | translate }}</strong>
                <a [routerLink]="area" data-testid="wealth-widget-link">
                  {{ 'wealth.widget.open' | translate }} <app-icon name="chevron-right" />
                </a>
              </div>
              <span class="hero" data-testid="wealth-widget-net">{{ text().net }}</span>
              <span class="muted" data-testid="wealth-widget-date">{{ text().asOf }}</span>
              @if (figures().kind === 'trend') {
                <span
                  class="change"
                  [class.negative]="negative()"
                  data-testid="wealth-widget-change"
                >
                  {{ text().change }}
                </span>
              } @else {
                <span class="muted" data-testid="wealth-widget-hint">
                  {{ 'wealth.widget.oneSnapshot' | translate }}
                </span>
              }
              @if (parts().length > 0) {
                <div
                  class="bar"
                  role="img"
                  [attr.aria-label]="'wealth.single.composition' | translate"
                  data-testid="wealth-widget-composition"
                >
                  @for (part of parts(); track part.key) {
                    <span
                      class="bar__part"
                      [style.flex-grow]="part.weight"
                      [style.background]="part.color"
                    ></span>
                  }
                </div>
                <ul class="legend" data-testid="wealth-widget-legend">
                  @for (part of parts(); track part.key) {
                    <li>
                      <span class="swatch" [style.background]="part.color"></span>
                      <span class="legend__name">{{ part.label }}</span>
                      <span class="legend__share">{{ part.share }}</span>
                    </li>
                  }
                </ul>
                <span class="muted" data-testid="wealth-widget-legend-hint">
                  {{ 'wealth.widget.legendHint' | translate }}
                </span>
              }
              <dl class="foot">
                <div>
                  <dt>{{ 'wealth.widget.assets' | translate }}</dt>
                  <dd data-testid="wealth-widget-assets">{{ text().assets }}</dd>
                </div>
                <div>
                  <dt>{{ 'wealth.widget.liabilities' | translate }}</dt>
                  <dd class="liability" data-testid="wealth-widget-liabilities">
                    {{ text().liabilities }}
                  </dd>
                </div>
              </dl>
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    .head a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      text-decoration: none;
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .swatch {
      flex: none;
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 0.15rem;
    }
    .legend__name {
      flex: 1;
      min-width: 0;
    }
    .legend__share {
      font-variant-numeric: tabular-nums;
      color: var(--p-text-muted-color);
    }
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
    .hero {
      font-size: 1.8rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .change {
      font-size: 0.875rem;
      color: var(--p-green-600);
    }
    .negative,
    .liability {
      color: var(--p-red-600);
    }
    .bar {
      display: flex;
      height: 0.75rem;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .bar__part {
      flex-basis: 0;
    }
    .foot {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
    }
    .foot > div {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    dt {
      color: var(--p-text-muted-color);
    }
    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
    }
  `,
})
export class WealthDashboardWidgetComponent implements OnInit {
  protected readonly store = inject(WealthStore);
  protected readonly service = inject(WealthService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  protected readonly area = AREA;
  protected readonly figures = computed(() => widgetFiguresOf(this.store.snapshots()));
  /** Asset-class composition of the latest snapshot, colored like the overview's bar. */
  protected readonly parts = computed(() => {
    const colors = wealthChartColors(this.theme.theme()).classes;
    const lang = this.i18n.language();
    const labelOf = classLabels(sortedByDate(this.store.snapshots()), (id) =>
      this.i18n.translate(`wealth.classes.${id}`),
    );
    const total = this.figures().composition.reduce((sum, part) => sum + part.weight, 0);
    return this.figures()
      .composition.map((part, index) => ({
        ...part,
        label: labelOf.get(part.key) ?? part.key,
        share: formatShare(String(part.weight), String(total), lang),
        color: colors[index % colors.length],
      }))
      .filter((part) => part.weight > 0);
  });
  protected readonly negative = computed(() => Number(this.figures().delta ?? 0) < 0);

  protected readonly text = computed(() => {
    const lang = this.i18n.language();
    const f = this.figures();
    const na = this.i18n.translate('wealth.kpi.notAvailable');
    const change =
      f.delta === null || f.previousDate === null
        ? ''
        : fill(this.i18n.translate('wealth.widget.changeSince'), {
            change: `${formatMoney(f.delta, lang, { signed: true })} (${formatPct(f.pct, lang, na)})`,
            date: formatDate(f.previousDate, lang),
          });
    return {
      net: formatMoney(f.net, lang),
      assets: formatMoney(f.assets, lang),
      liabilities: formatMoney(f.liabilities, lang),
      change,
      asOf: fill(this.i18n.translate('wealth.kpi.asOf'), { date: formatDate(f.date, lang) }),
    };
  });

  ngOnInit(): void {
    this.store.ensureLoaded();
  }
}
