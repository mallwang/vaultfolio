import { Component, OnInit, inject, signal } from '@angular/core';
import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { IconComponent } from '../shared/icon/icon.component';
import { ASSET_TYPE_LABELS } from './asset-type-fields';
import { HoldingFormComponent } from './holding-form/holding-form.component';
import { HoldingsDistributionComponent } from './holdings-distribution/holdings-distribution.component';
import { HoldingsService } from './holdings.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';

/**
 * Holdings area (FR-001–FR-016, User Stories 1–4): the value-distribution
 * view, the holdings list, and the add/edit/delete flows, per design.md.
 */
@Component({
  selector: 'app-holdings',
  imports: [
    TableModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    HoldingFormComponent,
    HoldingsDistributionComponent,
    TranslatePipe,
    IconComponent,
  ],
  providers: [ConfirmationService, MessageService, TranslatePipe],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.css',
})
export class HoldingsComponent implements OnInit {
  private readonly holdingsService = inject(HoldingsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  protected readonly holdings = signal<HoldingResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly dialogVisible = signal(false);
  protected readonly editingHolding = signal<HoldingResponse | null>(null);

  protected readonly assetTypeLabels = ASSET_TYPE_LABELS;

  protected labelFor(assetType: AssetType): string {
    return ASSET_TYPE_LABELS[assetType];
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
        .replace('{{assetType}}', this.assetTypeLabels[holding.assetType])
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
