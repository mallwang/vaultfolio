import { Component, OnInit, inject, signal } from '@angular/core';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import {
  ExportControlComponent,
  IconComponent,
  TranslatePipe,
  LocaleNumberPipe,
  LocaleDatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { ASSET_TYPE_LABEL_KEYS, ASSET_TYPES } from './asset-type-fields';
import { HoldingFormComponent } from './holding-form/holding-form.component';
import { HoldingsDistributionComponent } from './holdings-distribution/holdings-distribution.component';
import { HoldingsTypeBreakdownComponent } from './holdings-type-breakdown/holdings-type-breakdown.component';
import { HoldingsService } from './holdings.service';

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
@Component({
  selector: 'app-holdings',
  imports: [
    TableModule,
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
    LocaleDatePipe,
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

    <div class="holdings-charts-grid">
      <p-card [header]="'holdingsDistribution.title' | translate" class="distribution-card">
        <app-holdings-distribution [holdings]="holdings()" />
      </p-card>
      @for (assetType of assetTypes; track assetType) {
        <p-card [header]="labelFor(assetType)" class="distribution-card">
          <app-holdings-type-breakdown [assetType]="assetType" [holdings]="holdings()" />
        </p-card>
      }
    </div>

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
          <app-export-control featureId="holdings" severity="info" />
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
              (input)="dt.filterGlobal($any($event.target).value, 'contains')"
            />
          </p-iconfield>
        </div>
        <p-table
          #dt
          [value]="holdings()"
          [loading]="loading()"
          [tableStyle]="{ 'min-width': '50rem' }"
          [globalFilterFields]="['assetType', 'name', 'management', 'purchaseDate']"
          sortMode="single"
          removableSort
        >
          <ng-template #header>
            <tr>
              <th scope="col" pSortableColumn="assetType" data-testid="holdings-column-assetType">
                {{ 'holdings.columnType' | translate }}
                <p-sort-icon field="assetType" />
              </th>
              <th scope="col" pSortableColumn="name" data-testid="holdings-column-name">
                {{ 'holdings.columnAsset' | translate }}
                <p-sort-icon field="name" />
              </th>
              <th scope="col" pSortableColumn="management" data-testid="holdings-column-management">
                {{ 'holdings.columnManagement' | translate }}
                <p-sort-icon field="management" />
              </th>
              <th scope="col" pSortableColumn="quantity" data-testid="holdings-column-quantity">
                {{ 'holdings.columnQuantity' | translate }}
                <p-sort-icon field="quantity" />
              </th>
              <th
                scope="col"
                pSortableColumn="purchasePrice"
                data-testid="holdings-column-purchasePrice"
              >
                {{ 'holdings.columnPrice' | translate }}
                <p-sort-icon field="purchasePrice" />
              </th>
              <th
                scope="col"
                pSortableColumn="purchaseDate"
                data-testid="holdings-column-purchaseDate"
              >
                {{ 'holdings.columnPurchaseDate' | translate }}
                <p-sort-icon field="purchaseDate" />
              </th>
              <th scope="col"></th>
            </tr>
          </ng-template>
          <ng-template #body let-holding>
            <tr>
              <td>{{ labelFor(holding.assetType) }}</td>
              <td>{{ holding.name }}</td>
              <td>{{ holding.management }}</td>
              <td>{{ holding.quantity ?? holding.weightGrams | localeNumber }}</td>
              <td>
                {{
                  holding.purchasePrice ?? holding.currentValue
                    | localeNumber: { style: 'currency', currency: 'EUR' }
                }}
              </td>
              <td>{{ holding.purchaseDate | localeDate }}</td>
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
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="7">
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
              </td>
            </tr>
          </ng-template>
        </p-table>
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
    /* FR-009/FR-010: 6 tiles (main chart + 5 per-type) all in one row so the
       datatable below never needs an extra scroll to reach — reflowing to
       3-per-row, then 1-per-row, as the viewport narrows (same breakpoint
       pattern as apps/frontend/src/app/dashboard/dashboard.component.css's
       .card-row, just with an extra step for the wider 6-tile row). */
    .holdings-charts-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      /* Shrinks every tile's chart at once (both chart components read this
         inherited custom property) — see their own .*__chart app-echart
         rules for why this crosses the style-encapsulation boundary safely. */
      --holdings-chart-height: 11rem;
    }

    @media (max-width: 1200px) {
      .holdings-charts-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 0.85rem;
        --holdings-chart-height: 15rem;
      }
    }

    @media (max-width: 768px) {
      .holdings-charts-grid {
        grid-template-columns: 1fr;
        --holdings-chart-height: 18rem;
      }
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
      gap: 0.5rem;
    }

    .holdings-panel__filter {
      display: flex;
      justify-content: flex-end;
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

    .row-actions {
      display: flex;
      gap: 0.25rem;
      justify-content: flex-end;
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

  protected readonly dialogVisible = signal(false);
  protected readonly editingHolding = signal<HoldingResponse | null>(null);

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
