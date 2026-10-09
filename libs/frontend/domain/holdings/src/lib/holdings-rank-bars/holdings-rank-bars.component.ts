import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@vaultfolio/frontend-shared-ui';

export interface RankBarRow {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Ranked horizontal bars (largest first) with name, share and amount next to the bar — replaces
 * the donut charts, whose in-ring percentages did not fit small segments. Plain HTML/CSS, so it
 * has no resize handling; a long list scrolls inside `--holdings-chart-height`.
 */
@Component({
  selector: 'app-holdings-rank-bars',
  template: `
    <div class="rank">
      <ul class="rank__list" [style.max-height]="'var(--holdings-chart-height, 18rem)'">
        @for (row of ranked(); track row.key) {
          <li class="rank__row" [attr.title]="row.label + ': ' + row.amount">
            <span class="rank__name">{{ row.label }}</span>
            <span class="rank__track"
              ><span
                class="rank__fill"
                [style.width.%]="row.width"
                [style.background]="row.color"
              ></span
            ></span>
            <b class="rank__share">{{ row.share }}</b>
            <span class="rank__amount">{{ row.amount }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    /* One line per row; the list owns the columns (subgrid) so names, bars and figures align. */
    .rank__list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      display: grid;
      grid-template-columns: minmax(3rem, max-content) minmax(3rem, 1fr) auto auto;
      column-gap: 0.5rem;
      row-gap: 0.5rem;
      align-content: start;
    }
    .rank__row {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      align-items: center;
      font-size: 0.8125rem;
    }
    .rank__name {
      max-width: 8rem;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rank__share,
    .rank__amount {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .rank__amount {
      color: var(--p-text-muted-color);
      text-align: right;
    }
    .rank__track {
      height: 0.5rem;
      border-radius: 0.25rem;
      background: var(--p-content-border-color);
      overflow: hidden;
    }
    .rank__fill {
      display: block;
      height: 100%;
      border-radius: 0.25rem;
    }
  `,
})
export class HoldingsRankBarsComponent {
  readonly rows = input.required<RankBarRow[]>();

  private readonly i18n = inject(I18nService);

  protected readonly ranked = computed(() => {
    const locale = this.i18n.language();
    const money = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    const sorted = [...this.rows()].sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, r) => sum + r.value, 0);
    const max = sorted[0]?.value ?? 0;
    return sorted.map((r) => ({
      ...r,
      share: pct.format(total > 0 ? r.value / total : 0),
      amount: money.format(r.value),
      width: max > 0 ? (r.value / max) * 100 : 0,
    }));
  });
}
