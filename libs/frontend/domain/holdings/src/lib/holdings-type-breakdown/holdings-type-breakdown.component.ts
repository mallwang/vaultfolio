import { Component, computed, inject, input } from '@angular/core';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { holdingAssetName } from '../holding-display';
import { groupHoldingsByKey } from '../holdings-valuation';
import { ASSET_TYPE_COLORS, I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { HoldingsRankBarsComponent } from '../holdings-rank-bars/holdings-rank-bars.component';

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
 * Rendered as ranked bars (`HoldingsRankBarsComponent`) in the type's own color instead of a
 * donut: name, share and amount sit next to each bar rather than inside a ring.
 */
@Component({
  selector: 'app-holdings-type-breakdown',
  imports: [HoldingsRankBarsComponent, TranslatePipe],
  providers: [TranslatePipe],
  template: `
    @if (hasData()) {
      <app-holdings-rank-bars [rows]="rows()" />
    } @else {
      <p class="type-breakdown__empty">{{ 'holdingsDistribution.emptyState' | translate }}</p>
    }
  `,
  styles: `
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

  /** Signal inputs give `computed()` a real dependency on the parent's async-loaded list. */
  private readonly result = computed(() =>
    groupHoldingsByKey(
      this.holdings().filter((h) => h.assetType === this.assetType()),
      (h) => holdingAssetName(h, (key) => this.i18n.translate(key)) || null,
    ),
  );

  protected readonly hasData = computed(() => this.result().entries.length > 0);

  protected readonly rows = computed(() =>
    this.result().entries.map((entry) => ({
      key: entry.key,
      label: entry.key,
      value: entry.value.toNumber(),
      color: ASSET_TYPE_COLORS[this.assetType()],
    })),
  );
}
