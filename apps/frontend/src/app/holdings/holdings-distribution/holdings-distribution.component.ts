import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import Decimal from 'decimal.js';
import type { EChartsOption } from 'echarts';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { ASSET_TYPE_LABELS } from '../asset-type-fields';
import { EchartComponent } from '../../shared/chart/echart.component';
import { resolveChartPalette } from '../../shared/chart/chart-palette';
import { ThemeService } from '../../core/theme/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** data-model.md "Holdings Distribution Chart Data" — replaces the previous Chart.js `DoughnutChartData` shape. */
interface HoldingsDistributionEntry {
  /** Localized asset-type label (ASSET_TYPE_LABELS). */
  name: string;
  /** Decimal total, converted via `.toNumber()` at the presentation boundary only. */
  value: number;
}

/**
 * FR-012a: each holding's share of total portfolio value, computed
 * client-side from the already-fetched `GET /holdings` list (research.md
 * #6) — no dedicated backend endpoint. Value is `quantity × purchasePrice`
 * for Share/Bitcoin/ETF, `currentValue` for Gold; holdings with no
 * computable value are excluded from the percentage base entirely, never
 * counted as zero.
 */
@Component({
  selector: 'app-holdings-distribution',
  imports: [EchartComponent, TranslatePipe],
  templateUrl: './holdings-distribution.component.html',
  styleUrl: './holdings-distribution.component.css',
})
export class HoldingsDistributionComponent implements OnChanges {
  @Input({ required: true }) holdings: HoldingResponse[] = [];

  private readonly themeService = inject(ThemeService);

  private readonly entries = signal<HoldingsDistributionEntry[] | null>(null);
  protected readonly excludedCount = signal(0);
  protected readonly hasData = computed(() => this.entries() != null);

  protected readonly chartOption = computed<EChartsOption>(() => {
    const entries = this.entries() ?? [];
    const palette = resolveChartPalette(this.themeService.theme());
    return {
      color: palette.seriesColors,
      legend: { orient: 'horizontal', bottom: 0, left: 'center' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '42%'],
          padAngle: 2,
          itemStyle: { borderRadius: 9 },
          data: entries.map(({ name, value }) => ({ name, value })),
        },
      ],
    };
  });

  ngOnChanges(): void {
    this.recompute();
  }

  private recompute(): void {
    const totalsByType = new Map<string, Decimal>();
    let excluded = 0;

    for (const holding of this.holdings) {
      const value = HoldingsDistributionComponent.computeValue(holding);
      if (value == null) {
        excluded += 1;
        continue;
      }
      const running = totalsByType.get(holding.assetType) ?? new Decimal(0);
      totalsByType.set(holding.assetType, running.plus(value));
    }

    this.excludedCount.set(excluded);

    if (totalsByType.size === 0) {
      this.entries.set(null);
      return;
    }

    this.entries.set(
      [...totalsByType.entries()].map(([assetType, total]) => ({
        name: ASSET_TYPE_LABELS[assetType as keyof typeof ASSET_TYPE_LABELS],
        value: total.toNumber(),
      })),
    );
  }

  private static computeValue(holding: HoldingResponse): Decimal | null {
    if (holding.assetType === 'GOLD') {
      return holding.currentValue != null ? new Decimal(holding.currentValue) : null;
    }
    if (holding.quantity != null && holding.purchasePrice != null) {
      return new Decimal(holding.quantity).times(holding.purchasePrice);
    }
    return null;
  }
}
