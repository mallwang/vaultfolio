import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, OnChanges, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { EChartsOption } from 'echarts';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { ASSET_TYPE_LABEL_KEYS } from '../holding-display';
import { HoldingsRankBarsComponent } from '../holdings-rank-bars/holdings-rank-bars.component';
import { HoldingsService } from '../holdings.service';
import { groupHoldingsByKey } from '../holdings-valuation';
import {
  ASSET_TYPE_COLORS,
  DashboardTileComponent,
  EmptyTileComponent,
  I18nService,
  TileDetailsDirective,
  TileValueComponent,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import {
  buildDistributionChartOption,
  type HoldingsDistributionEntry,
} from './distribution-chart-option';

export { contrastTextColor } from './distribution-chart-option';
export type { HoldingsDistributionEntry } from './distribution-chart-option';

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
  imports: [
    HoldingsRankBarsComponent,
    NgTemplateOutlet,
    EmptyTileComponent,
    TranslatePipe,
    DashboardTileComponent,
    TileDetailsDirective,
    TileValueComponent,
  ],
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
    @if (framed()) {
      <app-dashboard-tile
        tileId="holdings-distribution"
        testIdPrefix="holdings-distribution-widget"
        [title]="'dashboard.allocation' | translate"
        [link]="area"
        linkTestId="holdings-distribution-link"
        [linkLabel]="'holdingsTile.open' | translate"
      >
        @if (loadError(); as err) {
          <p class="distribution__empty" data-testid="holdings-distribution-error">
            {{
              (err === 'unavailable' ? 'holdingsTile.unavailable' : 'holdingsTile.error')
                | translate
            }}
          </p>
        } @else if (hasData()) {
          <app-tile-value data-testid="holdings-distribution-total">{{
            centerLabel()
          }}</app-tile-value>
          <span class="distribution__note">{{ 'holdingsDistribution.title' | translate }}</span>
          <span class="distribution__note" data-testid="holdings-distribution-caption">{{
            'holdingsTile.caption' | translate
          }}</span>
        } @else if (loaded()) {
          <app-empty-tile
            link="/app/holdings"
            testId="holdings-distribution-empty"
            [title]="'holdingsTile.emptyTitle' | translate"
            [body]="'holdingsTile.emptyBody' | translate"
            [ctaLabel]="'holdingsTile.emptyCta' | translate"
          />
        }
        @if (hasData()) {
          <div tileChart class="distribution__chart-zone">
            <div class="distribution__bar" data-testid="holdings-distribution-bar">
              @for (slice of slices(); track slice.assetType) {
                <span
                  class="distribution__bar-part"
                  [style.flex-grow]="slice.value"
                  [style.background]="slice.color"
                  [title]="slice.label + ': ' + slice.amount + ' (' + slice.share + ')'"
                ></span>
              }
            </div>
            <ul class="distribution__legend" data-testid="holdings-distribution-top">
              @for (slice of topSlices(); track slice.assetType) {
                <ng-container *ngTemplateOutlet="legendRow; context: { $implicit: slice }" />
              }
            </ul>
          </div>
        }
        @if (hasData()) {
          <div tileDetails class="distribution">
            @if (restSlices().length > 0) {
              <ul class="distribution__legend" data-testid="holdings-distribution-legend">
                @for (slice of restSlices(); track slice.assetType) {
                  <ng-container *ngTemplateOutlet="legendRow; context: { $implicit: slice }" />
                }
              </ul>
            }
          </div>
        }
      </app-dashboard-tile>
      <ng-template #legendRow let-slice>
        <li>
          <span class="distribution__swatch" [style.background]="slice.color"></span>
          <span class="distribution__name">{{ slice.label }}</span>
          <span class="distribution__share">{{ slice.amount }} ({{ slice.share }})</span>
        </li>
      </ng-template>
    } @else if (hasData()) {
      <div class="distribution">
        <app-holdings-rank-bars [rows]="slices()" />
      </div>
    } @else {
      <p class="distribution__empty">{{ 'holdingsDistribution.emptyState' | translate }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
    }

    .distribution__chart-zone {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
    }

    .distribution__bar {
      display: flex;
      width: 100%;
      height: 1rem;
      border-radius: 0.375rem;
      overflow: hidden;
    }

    .distribution__bar-part {
      flex-basis: 0;
    }

    .distribution__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
    }

    .distribution__legend li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .distribution__swatch {
      flex: none;
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 0.15rem;
    }

    .distribution__name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .distribution__share {
      flex: none;
      font-variant-numeric: tabular-nums;
      color: var(--p-text-muted-color);
    }

    .distribution {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .distribution__note,
    .distribution__empty {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class HoldingsDistributionComponent implements OnChanges, OnInit {
  protected readonly area = '/app/holdings';
  @Input() holdings: HoldingResponse[] = [];

  private readonly holdingsService = inject(HoldingsService);
  private readonly i18n = inject(I18nService);
  private readonly translate = inject(TranslatePipe);

  /** Set by `ngOnChanges`, which Angular only calls when `holdings` is actually data-bound. */
  private inputBound = false;

  private readonly entries = signal<HoldingsDistributionEntry[] | null>(null);

  /** The dashboard tile (no `[holdings]` bound) renders inside the shared tile frame. */
  protected readonly framed = signal(false);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal<'error' | 'unavailable' | null>(null);
  protected readonly slices = computed(() => {
    const entries = this.entries() ?? [];
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    const locale = this.i18n.language();
    const money = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    return entries
      .map((entry) => ({
        ...entry,
        key: entry.assetType,
        label: this.translate.transform(ASSET_TYPE_LABEL_KEYS[entry.assetType]),
        color: ASSET_TYPE_COLORS[entry.assetType],
        amount: money.format(entry.value),
        share: pct.format(total > 0 ? entry.value / total : 0),
      }))
      .sort((a, b) => b.value - a.value);
  });
  /** Like the net-worth tile: the three largest types always, the rest under "details". */
  protected readonly topSlices = computed(() => this.slices().slice(0, 3));
  protected readonly restSlices = computed(() => this.slices().slice(3));
  protected readonly hasData = computed(() => this.entries() != null);

  protected readonly chartOption = computed<EChartsOption>(() =>
    buildDistributionChartOption(this.entries() ?? [], this.i18n.language(), (entry) =>
      this.translate.transform(ASSET_TYPE_LABEL_KEYS[entry.assetType]),
    ),
  );

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

  /**
   * Export seam (029-export-data, research.md §3): exposes the exact same `EChartsOption` the
   * page renders, so the off-screen chart-image capture used by the PDF export can reproduce
   * this chart without touching the visible DOM. Callers that need the export to reflect a
   * feature's own dataset (rather than whatever `[holdings]` happens to be bound at capture
   * time) should ensure `holdings`/`recompute()` has already run — see
   * `holdings-export.definition.ts`.
   */
  getChartOption(): EChartsOption {
    return this.chartOption();
  }

  ngOnChanges(): void {
    this.inputBound = true;
    this.recompute();
  }

  ngOnInit(): void {
    if (this.inputBound) {
      return;
    }
    this.framed.set(true);
    this.holdingsService.list().subscribe({
      next: (holdings) => {
        this.holdings = holdings;
        this.recompute();
        this.loaded.set(true);
      },
      // A failed load is its own state, never shown as "no holdings".
      error: (e: unknown) => {
        this.holdings = [];
        this.recompute();
        this.loadError.set(
          e instanceof HttpErrorResponse && e.status === 503 ? 'unavailable' : 'error',
        );
      },
    });
  }

  private recompute(): void {
    const result = groupHoldingsByKey(this.holdings, (h) => h.assetType);

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
