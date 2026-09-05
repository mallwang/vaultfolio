import { Component, Input, OnChanges, OnInit, computed, inject, signal } from '@angular/core';
import type { EChartsOption } from 'echarts';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ASSET_TYPE_LABEL_KEYS } from '../asset-type-fields';
import { HoldingsService } from '../holdings.service';
import { groupHoldingsByKey } from '../holdings-valuation';
import {
  EchartComponent,
  ASSET_TYPE_COLORS,
  I18nService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';

/**
 * Picks black or white for a segment's inside label based on the fill
 * color's perceived brightness (YIQ formula), so plain text — no
 * border/glow — stays legible against every fixed `ASSET_TYPE_COLORS`
 * value, including the light gold "precious metal" slice.
 */
export function contrastTextColor(hexColor: string): string {
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1f2937' : '#ffffff';
}

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
       since .distribution itself only sizes to its content. The custom
       property (inherited, so it crosses this component's style
       encapsulation boundary) lets HoldingsComponent's denser 6-tile row
       shrink this tile along with the others without affecting this
       component's other consumer, the Dashboard widget, which keeps the
       18rem default — see HoldingsTypeBreakdownComponent's identical rule. */
    .distribution__chart app-echart {
      display: block;
      width: 100%;
      height: var(--holdings-chart-height, 18rem);
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
      /* Matches HoldingsTypeBreakdownComponent's own \`__center-label\` size:
         every tile in the holdings-page grid shares the same width and
         height (var(--holdings-chart-height)), so this chart's donut hole
         is no bigger than theirs — the default (ambient) font size used to
         overflow it. */
      font-size: 0.75rem;
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
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    const resolveName = (entry: HoldingsDistributionEntry): string =>
      this.translate.transform(ASSET_TYPE_LABEL_KEYS[entry.assetType]);
    const pieCenter: [string, string] = ['50%', '42%'];
    return {
      // `EchartComponent`'s shared theming fragment merges in its own
      // `legend: { textStyle }` on every theme change (to keep legend text
      // readable for charts that DO show one) — since that's a merge, not a
      // replace, it would otherwise resurrect a default-visible legend here
      // even though this option has no `legend` key of its own. Explicit
      // `show: false` survives that merge.
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
          // Name is redundant with the legend and would otherwise get
          // clipped for longer localized asset-type labels in this small a
          // chart — percentage only avoids that entirely. Placed inside
          // each segment (vs. the previous outside label + pointer line)
          // so there's no separate `labelLine` to configure or clip. Each
          // data point overrides `label.color` below with whichever of
          // black/white contrasts with its own fixed `ASSET_TYPE_COLORS`
          // fill (a single series-level color can't stay legible against
          // both the light gold "precious metal" slice and the darker
          // ones) — plain, no text border/glow. One decimal place keeps
          // the label short enough to fit even the narrowest segment. A
          // smaller-than-default fontSize keeps the label legible inside
          // even the narrowest slices instead of overflowing them.
          label: { position: 'inside', formatter: '{d}%', fontWeight: 'bold', fontSize: 10 },
          labelLine: { show: false },
          percentPrecision: 1,
          data: entries.map((entry) => {
            const color = ASSET_TYPE_COLORS[entry.assetType];
            return {
              name: resolveName(entry),
              value: entry.value,
              itemStyle: { color },
              label: { color: contrastTextColor(color) },
            };
          }),
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
    const result = groupHoldingsByKey(this.holdings, (h) => h.assetType);

    this.excludedCount.set(result.excludedCount);

    if (result.entries.length === 0) {
      this.entries.set(null);
      return;
    }

    this.entries.set(
      result.entries.map((entry) => ({
        assetType: entry.key,
        value: entry.value.toNumber(),
      })),
    );
  }
}
