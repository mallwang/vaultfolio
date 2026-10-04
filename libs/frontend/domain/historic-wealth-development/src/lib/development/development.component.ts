import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { fill, formatDate } from '../wealth-format';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';
import { SnapshotTableComponent } from './snapshot-table.component';
import { WealthChartPanelComponent } from './wealth-chart-panel.component';
import { WealthKpisComponent } from './wealth-kpis.component';
import { WealthSingleComponent } from './wealth-single.component';
import { WealthEmptyStateComponent } from './wealth-empty-state.component';

/**
 * "Entwicklung" tab: the snapshot table with row actions and the delete confirmation. The empty
 * state invites the first snapshot.
 */
@Component({
  selector: 'app-wealth-development',
  imports: [
    ButtonModule,
    DialogModule,
    MessageModule,
    TranslatePipe,
    SnapshotTableComponent,
    WealthChartPanelComponent,
    WealthEmptyStateComponent,
    WealthKpisComponent,
    WealthSingleComponent,
  ],
  styles: `
    .stack {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .panel {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
  `,
  template: `
    @if (store.loaded()) {
      @if (store.snapshots().length === 0) {
        <app-wealth-empty-state />
      } @else {
        <div class="stack">
          <app-wealth-kpis [snapshots]="store.periodSnapshots()" />
          @if (store.periodSnapshots().length > 1) {
            <app-wealth-chart-panel [snapshots]="store.periodSnapshots()" />
          } @else {
            <app-wealth-single [snapshot]="store.periodSnapshots()[0]" />
          }
          <section class="panel">
            <h2>{{ 'wealth.table.title' | translate }}</h2>
            <app-wealth-snapshot-table
              [snapshots]="store.periodSnapshots()"
              (remove)="askDelete($event)"
            />
          </section>
        </div>
      }
    }

    <p-dialog
      [visible]="!!pending()"
      (visibleChange)="$event || cancelDelete()"
      [modal]="true"
      [header]="'wealth.table.deleteTitle' | translate"
      [style]="{ width: '28rem' }"
    >
      <p data-testid="wealth-delete-body">{{ deleteBody() }}</p>
      @if (deleteFailed()) {
        <p-message severity="error" data-testid="wealth-delete-error">{{
          'wealth.table.deleteFailed' | translate
        }}</p-message>
      }
      <ng-template #footer>
        <button
          type="button"
          pButton
          severity="secondary"
          [outlined]="true"
          data-testid="wealth-delete-cancel"
          (click)="cancelDelete()"
        >
          {{ 'wealth.table.deleteCancel' | translate }}
        </button>
        <button
          type="button"
          pButton
          severity="danger"
          data-testid="wealth-delete-confirm"
          (click)="confirmDelete()"
        >
          {{ 'wealth.table.deleteConfirm' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class DevelopmentComponent {
  protected readonly store = inject(WealthStore);
  private readonly service = inject(WealthService);
  private readonly i18n = inject(I18nService);

  protected readonly pending = signal<WealthSnapshot | null>(null);
  protected readonly deleteFailed = signal(false);

  protected askDelete(snapshot: WealthSnapshot): void {
    this.deleteFailed.set(false);
    this.pending.set(snapshot);
  }

  protected cancelDelete(): void {
    this.pending.set(null);
  }

  protected deleteBody(): string {
    const snapshot = this.pending();
    return snapshot
      ? fill(this.i18n.translate('wealth.table.deleteBody'), {
          date: formatDate(snapshot.snapshotDate, this.i18n.language()),
        })
      : '';
  }

  protected confirmDelete(): void {
    const snapshot = this.pending();
    if (!snapshot) return;
    this.service.delete(snapshot.id).subscribe({
      next: () => {
        this.pending.set(null);
        this.store.refresh();
      },
      error: () => this.deleteFailed.set(true),
    });
  }
}
