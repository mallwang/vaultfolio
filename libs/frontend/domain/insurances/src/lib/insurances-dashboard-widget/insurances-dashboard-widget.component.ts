import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  I18nService,
  IconComponent,
  ThemeService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { isActiveOn, isSocialType, type UpcomingDeadline } from '@vaultfolio/insurances';
import { insurancesChartColors } from '../charts/insurances-charts';
import { fill, formatDateShort, formatMoney } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';

const AREA = '/app/insurances';

/**
 * Dashboard tile (FR-017): monthly cost, yearly cost and the next cancellation deadline; an
 * invitation without contracts; a short note when the domain is unavailable (503). Reads the same
 * lib derivations as the overview, so the figures match.
 */
@Component({
  selector: 'app-insurances-dashboard-widget',
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="widget" data-testid="insurances-widget">
      @if (service.unavailable()) {
        <p class="muted" data-testid="insurances-widget-unavailable">
          {{ 'insurances.widget.unavailable' | translate }}
        </p>
      } @else if (store.loaded()) {
        @if (empty()) {
          <a class="tile" [routerLink]="area" data-testid="insurances-widget-empty">
            <strong>{{ 'insurances.widget.title' | translate }}</strong>
            <span class="muted">{{ 'insurances.widget.emptyBody' | translate }}</span>
            <span class="cta">
              {{ 'insurances.widget.emptyCta' | translate }} <app-icon name="chevron-right" />
            </span>
          </a>
        } @else {
          <div class="tile">
            <div class="head">
              <strong>{{ 'insurances.widget.monthly' | translate }}</strong>
              <a [routerLink]="area" data-testid="insurances-widget-link">
                {{ 'insurances.widget.open' | translate }} <app-icon name="chevron-right" />
              </a>
            </div>
            <span class="hero" data-testid="insurances-widget-monthly">{{ monthly() }}</span>
            <span class="muted" data-testid="insurances-widget-yearly">{{ yearly() }}</span>
            <span class="muted" [class.warn]="warn()" data-testid="insurances-widget-next">{{
              next()
            }}</span>
            @if (parts().length > 0) {
              <div
                class="bar"
                role="img"
                [attr.aria-label]="'insurances.chart.groupTitle' | translate"
                data-testid="insurances-widget-chart"
              >
                @for (part of parts(); track part.group) {
                  <span
                    class="bar__part"
                    [class.dim]="hovered() !== null && hovered() !== part.group"
                    [style.flex-grow]="part.weight"
                    [style.background]="part.color"
                    [title]="part.label + ': ' + part.value"
                    (mouseenter)="hovered.set(part.group)"
                    (mouseleave)="hovered.set(null)"
                  ></span>
                }
              </div>
              <ul class="legend" data-testid="insurances-widget-legend">
                @for (part of parts(); track part.group) {
                  <li
                    [class.active]="hovered() === part.group"
                    (mouseenter)="hovered.set(part.group)"
                    (mouseleave)="hovered.set(null)"
                  >
                    <span class="swatch" [style.background]="part.color"></span>
                    <span class="legend__name">{{ part.label }}</span>
                    <span class="legend__share">{{ part.value }}</span>
                  </li>
                }
              </ul>
            }
            <div class="foot">
              <span data-testid="insurances-widget-active">{{ activeText() }}</span>
              @if (gapCount() > 0) {
                <a class="gaps" [routerLink]="gapCheckPath" data-testid="insurances-widget-gaps">
                  <app-icon name="warning" /> {{ gapText() }}
                </a>
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
    .head a,
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      font-size: 0.875rem;
      text-decoration: none;
    }
    .hero {
      font-size: 1.8rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .warn {
      color: var(--p-orange-600);
      font-weight: 600;
    }
    .bar {
      display: flex;
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
    .legend li.active {
      font-weight: 600;
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
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
      font-size: 0.9rem;
    }
    .gaps {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-orange-600);
      font-weight: 500;
      text-decoration: none;
    }
    .gaps:hover {
      text-decoration: underline;
    }
    /* The glyph lives in app-icon's own encapsulated template, so shrinking it needs ng-deep. */
    .gaps ::ng-deep .material-symbols-outlined {
      font-size: 1rem;
    }
  `,
})
export class InsurancesDashboardWidgetComponent {
  protected readonly store = inject(InsurancesStore);
  protected readonly service = inject(InsurancesService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  protected readonly area = AREA;
  protected readonly hovered = signal<string | null>(null);
  protected readonly gapCheckPath = `${AREA}/gap-check`;

  protected readonly empty = computed(
    () => this.store.contracts().length === 0 && this.store.linkedSocial().length === 0,
  );
  private readonly firstDeadline = computed<UpcomingDeadline | null>(
    () => this.store.summary().upcoming[0] ?? null,
  );
  protected readonly warn = computed(() => this.firstDeadline()?.withinWindow ?? false);
  protected readonly monthly = computed(() =>
    formatMoney(this.store.summary().monthlyTotal, this.i18n.language()),
  );
  protected readonly yearly = computed(() =>
    fill(this.i18n.translate('insurances.widget.yearly'), {
      amount: formatMoney(this.store.summary().yearlyTotal, this.i18n.language()),
    }),
  );
  protected readonly next = computed(() => {
    const deadline = this.firstDeadline();
    return deadline
      ? fill(this.i18n.translate('insurances.widget.next'), {
          name: deadline.name,
          date: formatDateShort(deadline.date, this.i18n.language()),
        })
      : this.i18n.translate('insurances.widget.noDeadline');
  });

  protected readonly parts = computed(() => {
    const lang = this.i18n.language();
    const colors = insurancesChartColors(this.theme.theme());
    return this.store.summary().byGroup.map((g) => ({
      group: g.group,
      label: this.i18n.translate(`insurances.groups.${g.group}`),
      color: colors.groups[g.group],
      weight: Number(g.yearly),
      value: `${formatMoney(g.yearly, lang)} (${new Intl.NumberFormat(lang, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(g.share / 100)})`,
    }));
  });
  protected readonly activeText = computed(() => {
    const active = fill(this.i18n.translate('insurances.widget.active'), {
      count: this.store.summary().activeCount,
    });
    const inactiveCount = this.store
      .contracts()
      .filter((c) => !isSocialType(c.type) && !isActiveOn(c, this.store.today())).length;
    if (inactiveCount === 0) return active;
    const inactive = fill(this.i18n.translate('insurances.widget.inactive'), {
      count: inactiveCount,
    });
    return `${active} · ${inactive}`;
  });
  protected readonly gapCount = computed(() => this.store.gaps().missing.length);
  protected readonly gapText = computed(() =>
    fill(this.i18n.translate('insurances.widget.gaps'), { count: this.gapCount() }),
  );

  constructor() {
    this.store.ensureLoaded();
  }
}
