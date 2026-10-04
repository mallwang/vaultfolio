import { Component, computed, inject, input } from '@angular/core';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { changesOf, sortedByDate, totalsOf } from '@vaultfolio/wealth';
import { changeTone, fill, formatDate, formatMoney, formatPct } from '../wealth-format';

/**
 * Four KPI tiles (design.md "Entwicklung"): net worth of the latest snapshot in the period (hero,
 * with its date), change versus the previous snapshot (absolute and percent; "n/a" percent when the
 * previous net worth is not positive), assets and liabilities.
 */
@Component({
  selector: 'app-wealth-kpis',
  imports: [TranslatePipe],
  template: `
    <div class="kpis">
      <section class="tile tile--hero" data-testid="wealth-kpi-net">
        <h3>{{ 'wealth.kpi.net' | translate }}</h3>
        <p class="value" data-testid="wealth-kpi-net-value">{{ figures().net }}</p>
        <p class="sub">{{ figures().asOf }}</p>
      </section>
      <section class="tile" data-testid="wealth-kpi-change">
        <h3>{{ 'wealth.kpi.change' | translate }}</h3>
        <p class="value" [class]="figures().tone" data-testid="wealth-kpi-change-value">
          {{ figures().delta }}
        </p>
        <p class="value value--pct" [class]="figures().tone" data-testid="wealth-kpi-change-pct">
          {{ figures().pct }}
        </p>
        <p class="sub" data-testid="wealth-kpi-change-since">{{ figures().since }}</p>
      </section>
      <section class="tile" data-testid="wealth-kpi-assets">
        <h3>{{ 'wealth.kpi.assets' | translate }}</h3>
        <p class="value" data-testid="wealth-kpi-assets-value">{{ figures().assets }}</p>
      </section>
      <section class="tile" data-testid="wealth-kpi-liabilities">
        <h3>{{ 'wealth.kpi.liabilities' | translate }}</h3>
        <p class="value liability" data-testid="wealth-kpi-liabilities-value">
          {{ figures().liabilities }}
        </p>
      </section>
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .tile {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 0.875rem 1rem;
    }
    .tile--hero {
      border-color: var(--p-primary-color);
    }
    h3 {
      margin: 0;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--p-text-muted-color);
    }
    .value {
      margin: 0.25rem 0 0;
      font-size: 1.4rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .tile--hero .value {
      font-size: 1.7rem;
    }
    .sub {
      margin: 0.125rem 0 0;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }
    .liability,
    .down {
      color: var(--p-red-600);
    }
    .up {
      color: var(--p-green-600);
    }
    .flat {
      color: var(--p-text-muted-color);
    }
    .value {
      overflow-wrap: anywhere;
    }
    @media (max-width: 760px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .tile--hero .value {
        font-size: 1.3rem;
      }
      .value {
        font-size: 1.15rem;
      }
    }
  `,
})
export class WealthKpisComponent {
  private readonly i18n = inject(I18nService);

  /** Snapshots of the chosen period (non-empty), any order. */
  readonly snapshots = input.required<readonly WealthSnapshot[]>();

  protected readonly figures = computed(() => {
    const lang = this.i18n.language();
    const none = this.i18n.translate('wealth.kpi.none');
    const na = this.i18n.translate('wealth.kpi.notAvailable');
    const sorted = sortedByDate(this.snapshots());
    const latest = sorted[sorted.length - 1];
    const totals = totalsOf(latest);
    const change = changesOf(sorted)[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    return {
      net: formatMoney(totals.net, lang),
      asOf: fill(this.i18n.translate('wealth.kpi.asOf'), {
        date: formatDate(latest.snapshotDate, lang),
      }),
      delta: change.delta === null ? none : formatMoney(change.delta, lang, { signed: true }),
      pct: previous ? formatPct(change.pct, lang, na) : none,
      since: previous
        ? fill(this.i18n.translate('wealth.kpi.sincePrevious'), {
            date: formatDate(previous.snapshotDate, lang),
          })
        : '',
      tone: changeTone(change.delta),
      assets: formatMoney(totals.assets, lang),
      liabilities: formatMoney(totals.liabilities, lang),
    };
  });
}
