import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate, formatMoney, formatPct } from '../wealth-format';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';
import { sparklinePoints, widgetFiguresOf } from './widget-figures';

const AREA = '/app/historic-wealth-development';

/**
 * Dashboard tile (design.md "Dashboard tile"): the whole tile is a link to the wealth page. With
 * two or more snapshots it shows the latest net worth, the change since the previous snapshot with
 * percent and date, an inline-SVG sparkline and the asset and liability rows; with one snapshot a
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
            <a class="tile" [routerLink]="area" data-testid="wealth-widget-link">
              <strong>{{ 'wealth.widget.net' | translate }}</strong>
              <span class="hero" data-testid="wealth-widget-net">{{ text().net }}</span>
              @if (figures().kind === 'trend') {
                <span
                  class="change"
                  [class.negative]="negative()"
                  data-testid="wealth-widget-change"
                >
                  {{ text().change }}
                </span>
                <svg
                  class="spark"
                  viewBox="0 0 200 48"
                  preserveAspectRatio="none"
                  role="img"
                  [attr.aria-label]="'wealth.widget.trend' | translate"
                  data-testid="wealth-widget-sparkline"
                >
                  <polyline
                    [attr.points]="points()"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              } @else {
                <span class="muted" data-testid="wealth-widget-hint">
                  {{ 'wealth.widget.oneSnapshot' | translate }}
                </span>
                <span class="cta">
                  {{ 'wealth.widget.addSnapshot' | translate }} <app-icon name="chevron-right" />
                </span>
              }
              <dl class="rows">
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
              <span class="cta">
                {{ 'wealth.widget.link' | translate }} <app-icon name="chevron-right" />
              </span>
            </a>
          }
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
    .spark {
      width: 100%;
      height: 3rem;
      color: var(--p-primary-color);
    }
    .rows {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .rows > div {
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

  protected readonly area = AREA;
  protected readonly figures = computed(() => widgetFiguresOf(this.store.snapshots()));
  protected readonly points = computed(() => sparklinePoints(this.figures().trend, 200, 48));
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
    };
  });

  ngOnInit(): void {
    this.store.ensureLoaded();
  }
}
