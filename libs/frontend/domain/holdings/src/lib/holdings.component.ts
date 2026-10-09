import Decimal from 'decimal.js';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import {
  ExportControlComponent,
  IconComponent,
  TranslatePipe,
  LocaleNumberPipe,
} from '@vaultfolio/frontend-shared-ui';
import { ASSET_TYPES } from '@vaultfolio/domain-holdings';
import { ASSET_TYPE_ICONS, ASSET_TYPE_LABEL_KEYS, holdingAssetName } from './holding-display';
import { HoldingFormComponent } from './holding-form/holding-form.component';
import { HoldingsDistributionComponent } from './holdings-distribution/holdings-distribution.component';
import { HoldingsTypeBreakdownComponent } from './holdings-type-breakdown/holdings-type-breakdown.component';
import { HoldingsService } from './holdings.service';
import { computeHoldingValue } from './holdings-valuation';

/**
 * Holdings area (FR-001–FR-016, User Stories 1–4): the holdings list and the
 * add/edit/delete flows, per design.md. The value-distribution view
 * (FR-012a) also appears here (FR-013) — restored alongside its existing
 * Dashboard placement (dashboard/dashboard.component.ts) — both consume the
 * same `app-holdings-distribution` component.
 *
 * Inline `template`/`styles`, not `templateUrl`/`styleUrl` (020): this
 * component is the `/app/holdings` route's lazily-loaded target
 * (`apps/frontend/src/app/app.routes.ts`), and `@angular/build:unit-test`
 * externalizes every workspace-linked package during its build step,
 * skipping Angular's own resource-inlining for such packages — a route
 * table test that actually navigates here (`app.routes.spec.ts`) would
 * otherwise fail with "Did you run and wait for resolveComponentResources()?"
 * — see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
type SortKey = 'assetType' | 'name' | 'management' | 'quantity' | 'purchasePrice' | 'total';

const CHARTS_OPEN_KEY = 'vaultfolio.holdings.chartsOpen';

@Component({
  selector: 'app-holdings',
  imports: [
    ButtonModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TooltipModule,
    HoldingFormComponent,
    HoldingsDistributionComponent,
    HoldingsTypeBreakdownComponent,
    TranslatePipe,
    LocaleNumberPipe,
    IconComponent,
    ExportControlComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  template: `
    <p-toast />
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'holdings-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'holdings-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    <div class="holdings-charts-bar">
      <button
        type="button"
        class="holdings-charts-toggle"
        data-testid="holdings-charts-toggle"
        [attr.aria-expanded]="chartsOpen()"
        (click)="toggleCharts()"
      >
        <app-icon name="chevron-down" [class.holdings-charts-toggle--closed]="!chartsOpen()" />
        {{ (chartsOpen() ? 'holdings.chartsHide' : 'holdings.chartsShow') | translate }}
      </button>
    </div>
    @if (chartsOpen()) {
      <div class="holdings-charts-grid" data-testid="holdings-charts">
        <p-card [header]="'holdingsDistribution.title' | translate" class="distribution-card">
          <app-holdings-distribution [holdings]="holdings()" />
        </p-card>
        @for (assetType of assetTypes; track assetType) {
          <p-card [header]="labelFor(assetType)" class="distribution-card">
            <app-holdings-type-breakdown [assetType]="assetType" [holdings]="holdings()" />
          </p-card>
        }
      </div>
    }

    <section class="holdings-panel">
      <div class="holdings-panel__header">
        <h2>
          {{ holdings().length }}
          {{
            (holdings().length === 1 ? 'holdings.countSingular' : 'holdings.countPlural')
              | translate
          }}
        </h2>
        <div class="holdings-panel__header-actions">
          <app-export-control featureId="holdings" />
          <button
            pButton
            data-testid="holdings-add-holding"
            type="button"
            (click)="openAddDialog()"
          >
            <app-icon name="plus" /> {{ 'holdings.addHolding' | translate }}
          </button>
        </div>
      </div>

      @if (loadError()) {
        <p class="error-state">{{ loadError() }}</p>
      } @else {
        <div class="holdings-panel__filter">
          @if (typeCounts().length > 1) {
            <div
              class="filter-chips"
              role="group"
              [attr.aria-label]="'holdings.columnType' | translate"
            >
              <button
                type="button"
                class="filter-chip"
                [class.filter-chip--active]="typeFilter() === 'ALL'"
                [attr.aria-pressed]="typeFilter() === 'ALL'"
                data-testid="holdings-filter-type-ALL"
                (click)="typeFilter.set('ALL')"
              >
                {{ 'accountOverview.filterAll' | translate }}
                <span class="filter-chip__count">{{ holdings().length }}</span>
              </button>
              @for (entry of typeCounts(); track entry.assetType) {
                <button
                  type="button"
                  class="filter-chip"
                  [class.filter-chip--active]="typeFilter() === entry.assetType"
                  [attr.aria-pressed]="typeFilter() === entry.assetType"
                  [attr.data-testid]="'holdings-filter-type-' + entry.assetType"
                  (click)="typeFilter.set(entry.assetType)"
                >
                  <app-icon size="1rem" [name]="iconFor(entry.assetType)" />
                  {{ labelFor(entry.assetType) }}
                  <span class="filter-chip__count">{{ entry.count }}</span>
                </button>
              }
            </div>
          }
          <p-iconfield iconPosition="left">
            <p-inputicon>
              <app-icon name="search" />
            </p-inputicon>
            <input
              pInputText
              type="text"
              data-testid="holdings-filter"
              [attr.aria-label]="'holdings.filterPlaceholder' | translate"
              [placeholder]="'holdings.filterPlaceholder' | translate"
              (input)="filter.set($any($event.target).value)"
            />
          </p-iconfield>
        </div>
        <div class="scroll">
          <table data-testid="holdings-table">
            <thead>
              <tr>
                <th scope="col" [attr.aria-sort]="ariaSort('assetType')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('assetType')"
                    data-testid="holdings-column-assetType"
                  >
                    {{ 'holdings.columnType' | translate }} {{ arrow('assetType') }}
                  </button>
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('name')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('name')"
                    data-testid="holdings-column-name"
                  >
                    {{ 'holdings.columnAsset' | translate }} {{ arrow('name') }}
                  </button>
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('management')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('management')"
                    data-testid="holdings-column-management"
                  >
                    {{ 'holdings.columnManagement' | translate }} {{ arrow('management') }}
                  </button>
                </th>
                <th scope="col" class="num" [attr.aria-sort]="ariaSort('quantity')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('quantity')"
                    data-testid="holdings-column-quantity"
                  >
                    {{ 'holdings.columnQuantity' | translate }} {{ arrow('quantity') }}
                  </button>
                </th>
                <th scope="col" class="num" [attr.aria-sort]="ariaSort('purchasePrice')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('purchasePrice')"
                    data-testid="holdings-column-purchasePrice"
                  >
                    {{ 'holdings.columnPrice' | translate }} {{ arrow('purchasePrice') }}
                  </button>
                </th>
                <th scope="col" class="num" [attr.aria-sort]="ariaSort('total')">
                  <button
                    type="button"
                    class="sort"
                    (click)="sortBy('total')"
                    data-testid="holdings-column-total"
                  >
                    {{ 'holdings.columnTotal' | translate }} {{ arrow('total') }}
                  </button>
                </th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (holding of rows(); track holding.id) {
                <tr>
                  <td [attr.data-testid]="'holdings-row-' + holding.id + '-type'">
                    {{ labelFor(holding.assetType) }}
                  </td>
                  <td>
                    {{ assetName(holding) }}
                    @if (holding.note) {
                      <button
                        type="button"
                        class="note-btn"
                        [attr.data-testid]="'holdings-row-' + holding.id + '-note'"
                        [attr.aria-label]="'holdings.showNote' | translate"
                        [pTooltip]="holding.note"
                        tooltipPosition="top"
                      >
                        <app-icon name="sticky-note" size="1rem" />
                      </button>
                    }
                  </td>
                  <td>{{ holding.management }}</td>
                  <td class="num" [attr.data-testid]="'holdings-row-' + holding.id + '-quantity'">
                    {{ holding.quantity ?? '—'
                    }}{{ holding.unit ? ' ' + unitLabel(holding.unit) : '' }}
                  </td>
                  <td class="num">
                    {{
                      holding.purchasePrice ?? holding.currentValue
                        | localeNumber: { style: 'currency', currency: 'EUR' }
                    }}
                  </td>
                  <td class="num" [attr.data-testid]="'holdings-row-' + holding.id + '-total'">
                    {{ rowTotal(holding) | localeNumber: { style: 'currency', currency: 'EUR' } }}
                  </td>
                  <td class="row-actions">
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="secondary"
                      [text]="true"
                      [attr.data-testid]="'holdings-row-' + holding.id + '-edit'"
                      [attr.aria-label]="'holdings.editHolding' | translate"
                      [pTooltip]="'holdings.editHolding' | translate"
                      tooltipPosition="top"
                      (click)="openEditDialog(holding)"
                    >
                      <app-icon name="pencil" />
                    </button>
                    <button
                      pButton
                      type="button"
                      iconOnly
                      severity="danger"
                      [text]="true"
                      [attr.data-testid]="'holdings-row-' + holding.id + '-delete'"
                      [attr.aria-label]="'holdings.deleteHolding' | translate"
                      [pTooltip]="'holdings.deleteHolding' | translate"
                      tooltipPosition="top"
                      (click)="confirmDelete(holding, $event)"
                    >
                      <app-icon name="contract-delete" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
            @if (rows().length > 0) {
              <tfoot>
                <tr data-testid="holdings-footer-total">
                  <td colspan="5">
                    {{
                      (isFiltered() ? 'holdings.footerTotalFiltered' : 'holdings.footerTotal')
                        | translate
                    }}
                  </td>
                  <td class="num">
                    {{ visibleTotal() | localeNumber: { style: 'currency', currency: 'EUR' } }}
                    @if (isFiltered()) {
                      <div class="footer-of" data-testid="holdings-footer-of-total">
                        {{ 'holdings.footerOfTotal' | translate }}
                        {{ grandTotal() | localeNumber: { style: 'currency', currency: 'EUR' } }}
                      </div>
                    }
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
        @if (!loading() && holdings().length === 0) {
          <div class="empty-state">
            <app-icon name="briefcase" class="empty-state__icon" />
            <h2>{{ 'holdings.emptyStateTitle' | translate }}</h2>
            <p>{{ 'holdings.emptyStateBody' | translate }}</p>
            <button
              pButton
              data-testid="holdings-add-first-holding"
              type="button"
              (click)="openAddDialog()"
            >
              {{ 'holdings.addFirstHolding' | translate }}
            </button>
          </div>
        }
      }
    </section>

    <p-dialog
      [(visible)]="dialogVisible"
      [header]="(editingHolding() ? 'holdings.editHolding' : 'holdings.addHolding') | translate"
      [modal]="true"
      [dismissableMask]="false"
      [pt]="{ pcCloseButton: { root: { 'data-testid': 'holdings-dialog-close' } } }"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      @if (dialogVisible()) {
        <app-holding-form
          [holding]="editingHolding()"
          (saved)="onSaved($event)"
          (cancelled)="onCancelled()"
        />
      }
    </p-dialog>
  `,
  styles: `
    /* 2 rows x 3 columns (main chart + 5 per-type tiles), 1 column on narrow screens. */
    .holdings-charts-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.85rem;
      margin-bottom: 1.5rem;
      /* Height cap of the ranked-bar lists in every tile. */
      --holdings-chart-height: 12rem;
    }

    @media (max-width: 768px) {
      .holdings-charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .holdings-charts-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-primary-color);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .holdings-charts-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.5rem;
    }

    .holdings-charts-toggle--closed {
      transform: rotate(-90deg);
    }

    .note-btn {
      all: unset;
      cursor: help;
      margin-left: 0.4rem;
      vertical-align: middle;
      color: var(--p-text-muted-color);
    }
    .note-btn:focus-visible {
      outline: 2px solid var(--p-primary-color);
    }

    .distribution-card {
      margin-bottom: 0;
    }

    /* PrimeNG's p-card header is left-aligned by default; these chart tiles
       read better with a centered title. \`::ng-deep\` crosses into p-card's
       own template since \`.p-card-title\` isn't part of this component's DOM. */
    .distribution-card ::ng-deep .p-card-title {
      text-align: center;
    }

    .holdings-panel {
      margin-bottom: 1.5rem;
    }

    .holdings-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    /* design.md: the Export control sits immediately left of "Add holding" — both grouped in
       one actions cluster so the header's own space-between above still only splits the
       heading from this whole group, not from each individual button. */
    .holdings-panel__header-actions {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .holdings-panel__filter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    /* PrimeNG centers .p-inputicon by offsetting it half of the \`icon.size\`
   design token (top: 50%; margin-top: -icon.size/2) — a size that assumes a
   PrimeIcons font glyph. Our app-icon renders a Material Symbols glyph at a
   different natural size, so that assumed offset leaves it a few pixels off
   center. Stretching the icon box to the full input height and centering
   its content with flexbox sidesteps the mismatch instead of matching a
   number to a font metric. */
    .holdings-panel__filter .p-inputicon {
      top: 0;
      bottom: 0;
      margin-top: 0;
      display: flex;
      align-items: center;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      background: var(--p-content-background);
      color: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .filter-chip--active {
      border-color: var(--p-primary-color);
      background: var(--p-highlight-background);
      color: var(--p-primary-color);
    }

    .filter-chip__count {
      font-variant-numeric: tabular-nums;
      opacity: 0.75;
    }

    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      font-size: 0.85rem;
    }
    th,
    td {
      padding: 0.45rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--p-content-border-color);
      vertical-align: middle;
    }
    th {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      font-weight: 600;
    }
    tbody tr:hover {
      background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
    }
    .footer-of {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--p-text-muted-color);
    }
    tfoot td {
      font-weight: 600;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sort {
      all: unset;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }
    .sort:focus-visible {
      outline: 2px solid var(--p-primary-color);
    }

    /* Not display:flex — that would pull the cell out of the table row's alignment. */
    .row-actions {
      white-space: nowrap;
      text-align: right;
    }

    .error-state {
      color: var(--p-red-500);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      text-align: center;
    }

    .empty-state__icon {
      font-size: 2rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class HoldingsComponent implements OnInit {
  private readonly holdingsService = inject(HoldingsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  protected readonly holdings = signal<HoldingResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly assetTypes = ASSET_TYPES;

  protected readonly chartsOpen = signal(localStorage.getItem(CHARTS_OPEN_KEY) !== 'false');

  protected toggleCharts(): void {
    this.chartsOpen.update((open) => !open);
    localStorage.setItem(CHARTS_OPEN_KEY, String(this.chartsOpen()));
  }

  protected readonly filter = signal('');
  protected readonly typeFilter = signal<AssetType | 'ALL'>('ALL');
  protected readonly typeCounts = computed(() =>
    this.assetTypes
      .map((assetType) => ({
        assetType,
        count: this.holdings().filter((h) => h.assetType === assetType).length,
      }))
      .filter((entry) => entry.count > 0),
  );
  protected readonly sort = signal<SortKey | null>(null);
  protected readonly dir = signal<'asc' | 'desc'>('asc');

  protected readonly rows = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const type = this.typeFilter();
    const byType =
      type === 'ALL' ? this.holdings() : this.holdings().filter((h) => h.assetType === type);
    const filtered = q
      ? byType.filter((h) =>
          [h.assetType, h.name, h.management].some((v) => (v ?? '').toLowerCase().includes(q)),
        )
      : byType;
    const key = this.sort();
    if (!key) return filtered;
    const sign = this.dir() === 'asc' ? 1 : -1;
    const value = (h: HoldingResponse): string | number | null => {
      if (key === 'total') return computeHoldingValue(h)?.toNumber() ?? null;
      const raw = h[key];
      return raw !== null && (key === 'quantity' || key === 'purchasePrice') ? Number(raw) : raw;
    };
    return [...filtered].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      // Empty values stay last in both directions.
      if (x === null || y === null) {
        if (x === y) return 0;
        return x === null ? 1 : -1;
      }
      if (typeof x === 'number' && typeof y === 'number') return sign * (x - y);
      return sign * String(x).localeCompare(String(y));
    });
  });

  protected sortBy(key: SortKey): void {
    if (this.sort() === key) {
      this.dir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sort.set(key);
    this.dir.set('asc');
  }

  protected arrow(key: SortKey): string {
    if (this.sort() !== key) return '';
    return this.dir() === 'asc' ? '▲' : '▼';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  protected readonly dialogVisible = signal(false);
  protected readonly editingHolding = signal<HoldingResponse | null>(null);

  /** Sum of every computable row total (rows without one are skipped, as in the charts). */
  protected readonly grandTotal = computed(() =>
    this.holdings()
      .reduce((sum, h) => sum.plus(computeHoldingValue(h) ?? 0), new Decimal(0))
      .toNumber(),
  );

  protected readonly isFiltered = computed(
    () => this.typeFilter() !== 'ALL' || this.filter().trim() !== '',
  );

  /** Sum of the rows currently shown (follows the type chip and the search text). */
  protected readonly visibleTotal = computed(() =>
    this.rows()
      .reduce((sum, h) => sum.plus(computeHoldingValue(h) ?? 0), new Decimal(0))
      .toNumber(),
  );

  protected rowTotal(holding: HoldingResponse): number | null {
    return computeHoldingValue(holding)?.toNumber() ?? null;
  }

  protected iconFor(assetType: AssetType): string {
    return ASSET_TYPE_ICONS[assetType];
  }

  protected unitLabel(unit: string): string {
    return unit === 'OZT' ? 'oz t' : 'g';
  }

  protected assetName(holding: HoldingResponse): string {
    return holdingAssetName(holding, (key) => this.translate.transform(key));
  }

  protected labelFor(assetType: AssetType): string {
    return this.translate.transform(ASSET_TYPE_LABEL_KEYS[assetType]);
  }

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.holdingsService.list().subscribe({
      next: (holdings) => {
        this.holdings.set(holdings);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(this.translate.transform('holdings.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected openAddDialog(): void {
    this.editingHolding.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(holding: HoldingResponse): void {
    this.editingHolding.set(holding);
    this.dialogVisible.set(true);
  }

  protected onSaved(holding: HoldingResponse): void {
    this.dialogVisible.set(false);
    const current = this.holdings();
    const index = current.findIndex((existing) => existing.id === holding.id);
    if (index === -1) {
      this.holdings.set([...current, holding]);
    } else {
      this.holdings.set(
        current.map((existing) => (existing.id === holding.id ? holding : existing)),
      );
    }
  }

  protected onCancelled(): void {
    this.dialogVisible.set(false);
  }

  protected confirmDelete(holding: HoldingResponse, event: Event): void {
    const template = this.translate.transform('holdings.deleteConfirmMessage');
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: template
        .replace('{{assetType}}', this.labelFor(holding.assetType))
        .replace('{{management}}', holding.management),
      header: this.translate.transform('holdings.deleteConfirmHeader'),
      acceptButtonProps: { severity: 'danger', label: this.translate.transform('holdings.delete') },
      rejectButtonProps: {
        severity: 'secondary',
        label: this.translate.transform('common.cancel'),
      },
      accept: () => this.deleteHolding(holding),
    });
  }

  private deleteHolding(holding: HoldingResponse): void {
    this.holdingsService.delete(holding.id).subscribe({
      next: () => {
        this.holdings.set(this.holdings().filter((existing) => existing.id !== holding.id));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('holdings.deleted'),
        });
      },
      error: (error: unknown) => {
        const httpError = error as { status?: number };
        if (httpError.status === 404) {
          // Already gone — treat as success (Edge Case: deleted elsewhere).
          this.holdings.set(this.holdings().filter((existing) => existing.id !== holding.id));
          this.messageService.add({
            severity: 'info',
            summary: this.translate.transform('holdings.alreadyDeleted'),
            detail: this.translate.transform('holdings.alreadyDeletedDetail'),
          });
          this.refresh();
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('holdings.deleteError'),
        });
      },
    });
  }
}
