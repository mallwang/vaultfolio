import { Component, Input, OnChanges, OnInit, computed, inject, signal } from '@angular/core';
import Decimal from 'decimal.js';
import type { EChartsOption } from 'echarts';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ASSET_TYPE_LABEL_KEYS } from '../asset-type-fields';
import { HoldingsService } from '../holdings.service';
import {
  EchartComponent,
  ASSET_TYPE_COLORS,
  resolveChartPalette,
  ThemeService,
  I18nService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';

/** data-model.md "Holdings Distribution Chart Entry (revised)" — one aggregate per `AssetType`. */
interface HoldingsDistributionEntry {
  /** The sole grouping key — also drives the slice's fixed color (`ASSET_TYPE_COLORS`). */
  assetType: AssetType;
  /** Decimal total, converted via `.toNumber()` at the presentation boundary only. */
  value: number;
}

/**
 * FR-012a: each holding's share of total portfolio value, computed
 * client-side from the already-fetched `GET /holdings` list (research.md
 * #6) — no dedicated backend endpoint. Value is `quantity × purchasePrice`
 * for Share/Crypto/ETF, `currentValue` for Precious metal/Deposit money;
 * holdings with no computable value are excluded from the percentage base
 * entirely, never counted as zero. Every holding is grouped by its
 * `assetType` only (research.md #1, FR-001/FR-005) — at most one slice per
 * type, labeled with the type's localized `assetType.*` name, regardless of
 * how many differently-named holdings of that type exist.
 *
 * `holdings` is optional (021-frontend-extension-points): when rendered
 * directly with an explicit `[holdings]` binding (its original call site,
 * `HoldingsComponent`'s own page), that data is used as-is and this
 * component never fetches anything itself. When rendered with no binding at
 * all — its second call site, `apps/frontend`'s
 * `DASHBOARD_WIDGET_CONTRIBUTIONS` entry via the generic `DynamicOutletComponent`,
 * which has no way to plumb page-specific data into a dynamically-loaded
 * component — it fetches its own data via `HoldingsService`, keeping the
 * Dashboard's own code free of any holdings-specific wiring (FR-003,
 * research.md #3).
 */
@Component({
  selector: 'app-holdings-distribution',
  imports: [EchartComponent, TranslatePipe],
  providers: [TranslatePipe],
  // Inline template/styles, not templateUrl/styleUrl (020): this component
  // is consumed cross-package (`apps/frontend/src/app/dashboard`, behind an
  // `@defer` block), and `@angular/build:unit-test` externalizes every
  // workspace-linked package during its build step, skipping Angular's own
  // resource-inlining there — see `IconComponent`'s identical note in
  // `@vaultfolio/frontend-shared-ui`. `HoldingsComponent`/
  // `HoldingFormComponent` keep `templateUrl`/`styleUrl` since nothing
  // outside this library renders them in a unit test (only via the lazily
  // routed `/app/holdings` page).
  template: `
    @if (hasData()) {
      <div class="distribution">
        <div class="distribution__chart">
          <app-echart [option]="chartOption()" [loading]="false" />
          <span class="distribution__center-label">{{ centerLabel() }}</span>
        </div>
        @if (excludedCount() > 0) {
          <p class="distribution__note">
            {{ excludedCount() }} holding{{ excludedCount() === 1 ? '' : 's' }} excluded — no value
            entered.
          </p>
        }
      </div>
    } @else {
      <p class="distribution__empty">{{ 'holdingsDistribution.emptyState' | translate }}</p>
    }
  `,
  styles: `
    .distribution {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      max-width: 24rem;
      margin: 0 auto;
    }

    .distribution__chart {
      position: relative;
      width: 100%;
    }

    /* app-echart fills its parent (shared css); give it a concrete height here
       since .distribution itself only sizes to its content. */
    .distribution__chart app-echart {
      display: block;
      width: 100%;
      height: 18rem;
    }

    /* Matches the pie series' own \`center\` (chartOption's \`pieCenter\`) — an
       HTML overlay rather than an ECharts \`graphic\` element, since echarts'
       graphic-component positioning ignores text align when placed via
       left/top (see the component's \`centerLabel\` doc comment). */
    .distribution__center-label {
      position: absolute;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%);
      font-weight: bold;
      color: var(--p-text-color);
      pointer-events: none;
    }

    .distribution__note,
    .distribution__empty {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class HoldingsDistributionComponent implements OnChanges, OnInit {
  @Input() holdings: HoldingResponse[] = [];

  private readonly holdingsService = inject(HoldingsService);
  private readonly themeService = inject(ThemeService);
  private readonly i18n = inject(I18nService);
  private readonly translate = inject(TranslatePipe);

  /** Set by `ngOnChanges`, which Angular only calls when `holdings` is actually data-bound. */
  private inputBound = false;

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
      this.translate.transform(ASSET_TYPE_LABEL_KEYS[entry.assetType]);
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
          // Name is redundant with the legend and would otherwise get
          // clipped for longer localized asset-type labels in this small a
          // chart — percentage only avoids that entirely.
          label: { color: palette.textColor, formatter: '{d}%' },
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
    this.inputBound = true;
    this.recompute();
  }

  ngOnInit(): void {
    if (this.inputBound) {
      return;
    }
    this.holdingsService.list().subscribe({
      next: (holdings) => {
        this.holdings = holdings;
        this.recompute();
      },
      // Falls back to the empty state on load failure, same as
      // `DashboardComponent`'s own pre-021 fetch did.
      error: () => {
        this.holdings = [];
        this.recompute();
      },
    });
  }

  private recompute(): void {
    const totals = new Map<AssetType, Decimal>();
    let excluded = 0;

    for (const holding of this.holdings) {
      const value = HoldingsDistributionComponent.computeValue(holding);
      if (value == null) {
        excluded += 1;
        continue;
      }
      const key = holding.assetType;
      totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(value));
    }

    this.excludedCount.set(excluded);

    if (totals.size === 0) {
      this.entries.set(null);
      return;
    }

    this.entries.set(
      [...totals.entries()].map(([assetType, total]) => ({
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
