import { Component, Input, OnChanges, computed, signal } from '@angular/core';
import Decimal from 'decimal.js';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { ChartModule } from 'primeng/chart';
import { ASSET_TYPE_LABELS } from '../asset-type-fields';

interface ChartDataset {
  data: number[];
  backgroundColor: string[];
}

interface DoughnutChartData {
  labels: string[];
  datasets: ChartDataset[];
}

const SLICE_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#8b5cf6', '#ec4899'];

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
  imports: [ChartModule],
  templateUrl: './holdings-distribution.component.html',
  styleUrl: './holdings-distribution.component.css',
})
export class HoldingsDistributionComponent implements OnChanges {
  @Input({ required: true }) holdings: HoldingResponse[] = [];

  protected readonly chartData = signal<DoughnutChartData | null>(null);
  protected readonly excludedCount = signal(0);
  protected readonly hasData = computed(() => this.chartData() != null);

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
      this.chartData.set(null);
      return;
    }

    const entries = [...totalsByType.entries()];
    this.chartData.set({
      labels: entries.map(
        ([assetType]) => ASSET_TYPE_LABELS[assetType as keyof typeof ASSET_TYPE_LABELS],
      ),
      datasets: [
        {
          data: entries.map(([, total]) => total.toNumber()),
          backgroundColor: entries.map((_, index) => SLICE_COLORS[index % SLICE_COLORS.length]),
        },
      ],
    });
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
