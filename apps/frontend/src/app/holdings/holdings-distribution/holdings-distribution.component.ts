import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import Decimal from 'decimal.js';
import type { EChartsOption } from 'echarts';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ASSET_TYPE_LABEL_KEYS } from '../asset-type-fields';
import { EchartComponent } from '../../shared/chart/echart.component';
import { ASSET_TYPE_COLORS, resolveChartPalette } from '../../shared/chart/chart-palette';
import { ThemeService } from '../../core/theme/theme.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** data-model.md "Holdings Distribution Chart Data" — replaces the previous Chart.js `DoughnutChartData` shape. */
interface HoldingsDistributionEntry {
  /**
   * Either a fixed display name (Precious metal/Crypto holdings, grouped by
   * their own `name`) or an `assetType.*` translation key (every other
   * group) — resolved to the localized label in `chartOption`, not here, so
   * a language switch relabels the chart without recomputing the totals.
   */
  name: string;
  isTranslationKey: boolean;
  /** Decimal total, converted via `.toNumber()` at the presentation boundary only. */
  value: number;
  /** Drives the slice's fixed color (`ASSET_TYPE_COLORS`) — every holding in a group shares one type. */
  assetType: AssetType;
}

/**
 * FR-012a: each holding's share of total portfolio value, computed
 * client-side from the already-fetched `GET /holdings` list (research.md
 * #6) — no dedicated backend endpoint. Value is `quantity × purchasePrice`
 * for Share/Crypto/ETF, `currentValue` for Precious metal; holdings with no
 * computable value are excluded from the percentage base entirely, never
 * counted as zero. Precious metal/Crypto holdings are grouped per-name
 * (research.md #3, FR-010) — "Gold" and "Silver" are separate slices, two
 * same-named Crypto lots sum into one.
 */
@Component({
  selector: 'app-holdings-distribution',
  imports: [EchartComponent, TranslatePipe],
  providers: [TranslatePipe],
  templateUrl: './holdings-distribution.component.html',
  styleUrl: './holdings-distribution.component.css',
})
export class HoldingsDistributionComponent implements OnChanges {
  @Input({ required: true }) holdings: HoldingResponse[] = [];

  private readonly themeService = inject(ThemeService);
  private readonly i18n = inject(I18nService);
  private readonly translate = inject(TranslatePipe);

  private readonly entries = signal<HoldingsDistributionEntry[] | null>(null);
  protected readonly excludedCount = signal(0);
  protected readonly hasData = computed(() => this.entries() != null);

  protected readonly chartOption = computed<EChartsOption>(() => {
    const entries = this.entries() ?? [];
    const locale = this.i18n.language();
    // The pie's outer "pointer" labels/lines have their own `label`/
    // `labelLine` style, independent of `EchartComponent`'s global
    // `textStyle` fragment (which only themes component text — legend,
    // tooltip, axes) — left unset, ECharts falls back to a fixed dark-gray
    // default that's nearly invisible on the dark card background.
    const palette = resolveChartPalette(this.themeService.theme());
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    const resolveName = (entry: HoldingsDistributionEntry): string =>
      entry.isTranslationKey ? this.translate.transform(entry.name) : entry.name;
    const pieCenter: [string, string] = ['50%', '42%'];
    return {
      legend: { orient: 'horizontal', bottom: 0, left: 'center' },
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
          label: { color: palette.textColor },
          labelLine: { lineStyle: { color: palette.textColor } },
          data: entries.map((entry) => ({
            name: resolveName(entry),
            value: entry.value,
            itemStyle: { color: ASSET_TYPE_COLORS[entry.assetType] },
          })),
        },
      ],
    };
  });

  /**
   * Rendered as an HTML overlay (holdings-distribution.component.html)
   * rather than an ECharts `graphic` element — echarts' graphic-component
   * positioning always anchors a text element's own bounding box at
   * (left, top) and ignores `align`/`verticalAlign` when doing so
   * (component/graphic/GraphicView.js `_relocate`), so it cannot be
   * centered on a point that way. A CSS-centered overlay is exact and
   * far simpler.
   */
  protected readonly centerLabel = computed<string>(() => {
    const entries = this.entries() ?? [];
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const locale = this.i18n.language();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(total);
  });

  ngOnChanges(): void {
    this.recompute();
  }

  private recompute(): void {
    const totals = new Map<
      string,
      { name: string; isTranslationKey: boolean; assetType: AssetType; total: Decimal }
    >();
    let excluded = 0;

    for (const holding of this.holdings) {
      const value = HoldingsDistributionComponent.computeValue(holding);
      if (value == null) {
        excluded += 1;
        continue;
      }
      const isNamedGroup =
        holding.assetType === 'PRECIOUS_METAL' ||
        holding.assetType === 'CRYPTO' ||
        holding.assetType === 'DEPOSIT_MONEY';
      const key = isNamedGroup ? `${holding.assetType}::${holding.name}` : holding.assetType;
      const name = isNamedGroup
        ? (holding.name as string)
        : ASSET_TYPE_LABEL_KEYS[holding.assetType];
      const existing = totals.get(key);
      totals.set(key, {
        name,
        isTranslationKey: !isNamedGroup,
        assetType: holding.assetType,
        total: (existing?.total ?? new Decimal(0)).plus(value),
      });
    }

    this.excludedCount.set(excluded);

    if (totals.size === 0) {
      this.entries.set(null);
      return;
    }

    this.entries.set(
      [...totals.values()].map(({ name, isTranslationKey, assetType, total }) => ({
        name,
        isTranslationKey,
        assetType,
        value: total.toNumber(),
      })),
    );
  }

  private static computeValue(holding: HoldingResponse): Decimal | null {
    if (holding.assetType === 'PRECIOUS_METAL' || holding.assetType === 'DEPOSIT_MONEY') {
      return holding.currentValue != null ? new Decimal(holding.currentValue) : null;
    }
    if (holding.quantity != null && holding.purchasePrice != null) {
      return new Decimal(holding.quantity).times(holding.purchasePrice);
    }
    return null;
  }
}
