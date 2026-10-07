import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  EmptyTileComponent,
  DashboardTileComponent,
  I18nService,
  ThemeService,
  TileDetailsDirective,
  TileValueComponent,
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
  imports: [
    TranslatePipe,
    EmptyTileComponent,
    DashboardTileComponent,
    TileDetailsDirective,
    TileValueComponent,
  ],
  template: `
    <div class="widget" data-testid="wealth-widget">
      @if (service.unavailable()) {
        <app-dashboard-tile
          tileId="historic-wealth-development"
          testIdPrefix="wealth-widget"
          [title]="'dashboard.wealth' | translate"
        >
          <p class="muted" data-testid="wealth-widget-unavailable">
            {{ 'wealth.widget.unavailable' | translate }}
          </p>
        </app-dashboard-tile>
      } @else if (store.loaded()) {
        @switch (figures().kind) {
          @case ('empty') {
            <app-dashboard-tile
              tileId="historic-wealth-development"
              testIdPrefix="wealth-widget"
              [title]="'dashboard.wealth' | translate"
            >
              <app-empty-tile
                [link]="area"
                testId="wealth-widget-empty"
                [title]="'wealth.widget.title' | translate"
                [body]="'wealth.widget.emptyBody' | translate"
                [ctaLabel]="'wealth.widget.emptyCta' | translate"
              />
            </app-dashboard-tile>
          }
          @default {
            <app-dashboard-tile
              tileId="historic-wealth-development"
              testIdPrefix="wealth-widget"
              [link]="area"
              linkTestId="wealth-widget-link"
              [title]="'wealth.widget.net' | translate"
              [linkLabel]="'wealth.widget.open' | translate"
            >
              <app-tile-value data-testid="wealth-widget-net">{{ text().net }}</app-tile-value>
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
                  tileChart
                  class="bar"
                  role="img"
                  [attr.aria-label]="'wealth.single.composition' | translate"
                  data-testid="wealth-widget-composition"
                >
                  @for (part of parts(); track part.key) {
                    <span
                      class="bar__part"
                      [class.dim]="hovered() !== null && hovered() !== part.key"
                      [style.flex-grow]="part.weight"
                      [style.background]="part.color"
                      [title]="part.label + ': ' + part.amount + ' (' + part.share + ')'"
                      (mouseenter)="hovered.set(part.key)"
                      (mouseleave)="hovered.set(null)"
                    ></span>
                  }
                </div>
              }
              <div tileDetails class="details">
                @if (parts().length > 0) {
                  <ul class="legend" data-testid="wealth-widget-legend">
                    @for (part of parts(); track part.key) {
                      <li
                        [class.active]="hovered() === part.key"
                        (mouseenter)="hovered.set(part.key)"
                        (mouseleave)="hovered.set(null)"
                      >
                        <span class="swatch" [style.background]="part.color"></span>
                        <span class="legend__name">{{ part.label }}</span>
                        <span class="legend__share">{{ part.amount }} ({{ part.share }})</span>
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
            </app-dashboard-tile>
          }
        }
      } @else {
        <app-dashboard-tile
          tileId="historic-wealth-development"
          testIdPrefix="wealth-widget"
          [title]="'dashboard.wealth' | translate"
        />
      }
    </div>
  `,
  styles: `
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
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
    }
    .widget {
      display: flex;
      flex: 1;
      min-width: 0;
    }
    .details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
      width: 100%;
      height: 0.75rem;
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .bar__part {
      flex-basis: 0;
      transition: opacity 0.15s;
    }
    .bar__part.dim {
      opacity: 0.35;
    }
    .legend li.active {
      font-weight: 600;
    }
    .foot {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
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
  `,
})
export class WealthDashboardWidgetComponent implements OnInit {
  protected readonly store = inject(WealthStore);
  protected readonly service = inject(WealthService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  protected readonly area = AREA;
  protected readonly hovered = signal<string | null>(null);
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
        amount: formatMoney(String(part.weight), lang),
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
