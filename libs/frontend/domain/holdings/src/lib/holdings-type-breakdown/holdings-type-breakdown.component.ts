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
 * No legend (FR-007, research.md #3): a segment's name and percentage are
 * revealed only via tooltip on hover/focus, so the tile keeps the same
 * visual footprint whether a type has 2 or 15 distinctly-named holdings
 * (SC-002). The centered total mirrors `HoldingsDistributionComponent`'s own
 * `centerLabel` (same donut `center`/overlay position, so every tile in the
 * grid lines up) but at a smaller font — these per-type tiles are one of six
 * in a row rather than the single wider main chart. Segment coloring is left
 * to the generic theme palette `app-echart` already applies (research.md #4)
 * rather than `ASSET_TYPE_COLORS`, which is keyed by type (5 entries), not
 * name.
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
          <span class="type-breakdown__center-label">{{ centerLabel() }}</span>
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
      position: relative;
      width: 100%;
    }

    /* app-echart fills its parent (shared css); give it a concrete height
       here since .type-breakdown itself only sizes to its content — matches
       HoldingsDistributionComponent's own .distribution__chart rule. The
       custom property (inherited, so it crosses this component's style
       encapsulation boundary) lets a denser host layout — the 6-tile row on
       HoldingsComponent's own page — shrink every tile at once without
       affecting this component's other consumer, the Dashboard widget,
       which keeps the 18rem default. */
    .type-breakdown__chart app-echart {
      display: block;
      width: 100%;
      height: var(--holdings-chart-height, 18rem);
    }

    /* Matches the pie series' own \`center\` (chartOption's \`pieCenter\`) and
       HoldingsDistributionComponent's identical overlay — see that
       component's \`centerLabel\` doc comment for why an HTML overlay rather
       than an ECharts \`graphic\` element. Smaller than that component's own
       label: six of these share a row, each a fraction of the main chart's
       width, so the donut hole they must fit inside is smaller too. */
    .type-breakdown__center-label {
      position: absolute;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%);
      font-weight: bold;
      font-size: 0.75rem;
      color: var(--p-text-color);
      pointer-events: none;
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
    // Matches HoldingsDistributionComponent's own `pieCenter`/overlay
    // position exactly, so every tile in the grid's donut sits at the same
    // height instead of this one defaulting to dead-center ['50%', '50%'].
    const pieCenter: [string, string] = ['50%', '42%'];
    return {
      // See holdings-distribution.component.ts's identical `legend` note:
      // `EchartComponent`'s shared theming fragment merges in a `legend`
      // object on every theme change, which would otherwise resurrect a
      // default-visible legend even though this option has no `legend` key
      // of its own.
      legend: { show: false },
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
          center: pieCenter,
          padAngle: 2,
          itemStyle: { borderRadius: 9 },
          // A smaller-than-default fontSize keeps the label legible inside
          // even the narrowest slices instead of overflowing them.
          label: { position: 'inside', formatter: '{d}%', fontWeight: 'bold', fontSize: 10 },
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

  /**
   * Rendered as an HTML overlay, matching `HoldingsDistributionComponent`'s
   * own `centerLabel` — see that component's doc comment for why (echarts'
   * `graphic` element can't be centered on a point via left/top).
   */
  protected readonly centerLabel = computed<string>(() => {
    const entries = this.result().entries;
    const total = entries.reduce((sum, entry) => sum + entry.value.toNumber(), 0);
    const locale = this.i18n.language();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(total);
  });
}
