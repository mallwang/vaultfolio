import { Component, computed, inject, input } from '@angular/core';
import type { EChartsOption } from 'echarts';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { groupHoldingsByKey } from '../holdings-valuation';
import { EchartComponent, I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * FR-003–FR-011: one chart tile for a single `assetType`, grouping that
 * type's own holdings by their user-entered `name` (data-model.md, unlike
 * `HoldingsDistributionComponent`'s by-`assetType` grouping) and summing
 * same-named holdings into one segment. Always data-bound by the holdings
 * page (`HoldingsComponent`) with the full portfolio list — unlike
 * `HoldingsDistributionComponent`, this component never self-fetches
 * (research.md #2): it has no separate dashboard-widget consumer that would
 * need that fallback.
 *
 * No legend and no centered total (FR-007, research.md #3): a segment's
 * name, value, and percentage are revealed only via tooltip on hover/focus,
 * so the tile keeps the same visual footprint whether a type has 2 or 15
 * distinctly-named holdings (SC-002). Segment coloring is left to the
 * generic theme palette `app-echart` already applies (research.md #4) rather
 * than `ASSET_TYPE_COLORS`, which is keyed by type (5 entries), not name.
 */
@Component({
  selector: 'app-holdings-type-breakdown',
  imports: [EchartComponent, TranslatePipe],
  providers: [TranslatePipe],
  template: `
    @if (hasData()) {
      <div class="type-breakdown">
        <div class="type-breakdown__chart">
          <app-echart [option]="chartOption()" [loading]="false" />
        </div>
      </div>
    } @else {
      <p class="type-breakdown__empty">{{ 'holdingsDistribution.emptyState' | translate }}</p>
    }
  `,
  styles: `
    .type-breakdown {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 24rem;
      margin: 0 auto;
    }

    .type-breakdown__chart {
      width: 100%;
    }

    /* app-echart fills its parent (shared css); give it a concrete height
       here since .type-breakdown itself only sizes to its content — matches
       HoldingsDistributionComponent's own .distribution__chart rule. */
    .type-breakdown__chart app-echart {
      display: block;
      width: 100%;
      height: 18rem;
    }

    .type-breakdown__empty {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class HoldingsTypeBreakdownComponent {
  readonly assetType = input.required<AssetType>();
  readonly holdings = input<HoldingResponse[]>([]);

  private readonly i18n = inject(I18nService);

  /**
   * `computed()` only re-evaluates when a signal it read changes — plain
   * `@Input()` properties aren't signals, so a naive `computed()` over them
   * would read the initial (pre-fetch, empty) `holdings` value once and
   * cache it forever, never reflecting the parent's later async load
   * (`HoldingsComponent.refresh()`). Signal inputs (`input()`) fix that by
   * giving `computed()` a real reactive dependency.
   */
  private readonly result = computed(() =>
    groupHoldingsByKey(
      this.holdings().filter((h) => h.assetType === this.assetType()),
      (h) => h.name,
    ),
  );

  protected readonly hasData = computed(() => this.result().entries.length > 0);

  protected readonly chartOption = computed<EChartsOption>(() => {
    const entries = this.result().entries;
    const locale = this.i18n.language();
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          return `${p.name}: ${fmt.format(p.value)} (${p.percent}%)`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          padAngle: 2,
          itemStyle: { borderRadius: 9 },
          label: { position: 'inside', formatter: '{d}%', fontWeight: 'bold' },
          labelLine: { show: false },
          percentPrecision: 1,
          data: entries.map((entry) => ({
            name: entry.key,
            value: entry.value.toNumber(),
          })),
        },
      ],
    };
  });
}
