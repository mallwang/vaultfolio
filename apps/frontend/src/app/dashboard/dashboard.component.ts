import { Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import {
  DASHBOARD_TILE_EXPANSION,
  DashboardTileComponent,
  IconComponent,
  I18nService,
  TranslatePipe,
  DynamicOutletComponent,
  MaintenanceTileComponent,
} from '@vaultfolio/frontend-shared-ui';
import { CurrentUserStore } from '../auth/current-user.store';
import { DomainMaintenanceStore } from '../core/maintenance/domain-maintenance.store';
import { DashboardEditDialogComponent } from './dashboard-edit-dialog.component';
import { DashboardLayoutStore } from './dashboard-layout.store';
import { tileDomainOf } from './dashboard-tile-domain';

/**
 * Dashboard area (FR-005): a `p-card` per `DASHBOARD_WIDGET_CONTRIBUTIONS` entry of a domain the
 * current user has access to (FR-001, FR-004, 021-frontend-extension-points), via the generic
 * `DynamicOutletComponent`; the widget renders its own tile frame (header, main content,
 * collapsible details). Without any domain there
 * are no tiles. A domain in maintenance replaces its tiles' content (041).
 *
 * The user can drag the cards into their own order and switch individual
 * ones off ("Edit dashboard"); both live in `DashboardLayoutStore`
 * (browser-local).
 *
 * `DashboardComponent` itself has no domain-specific knowledge — it neither
 * imports a domain's widget component nor fetches that domain's data
 * (contrast the pre-021 version's direct `HoldingsDistributionComponent`
 * import + `HoldingsService` fetch, moved onto the generic mechanism as
 * proof, research.md #3). Adding a new domain's widget means adding one
 * entry to `DASHBOARD_WIDGET_CONTRIBUTIONS` — nothing here changes (SC-001).
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CardModule,
    TagModule,
    TranslatePipe,
    IconComponent,
    DynamicOutletComponent,
    MaintenanceTileComponent,
    DashboardTileComponent,
    DashboardEditDialogComponent,
  ],
  providers: [{ provide: DASHBOARD_TILE_EXPANSION, useExisting: DashboardLayoutStore }],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly layout = inject(DashboardLayoutStore);
  protected readonly maintenance = inject(DomainMaintenanceStore);
  private readonly currentUser = inject(CurrentUserStore);

  protected readonly isAdmin = computed(() => this.currentUser.current()?.role === 'ADMIN');

  protected readonly tiles = this.layout.visibleTiles;
  protected readonly editOpen = signal(false);
  private readonly i18n = inject(I18nService);

  protected readonly domainOf = tileDomainOf;

  protected domainHint(labelKey: string): string {
    return `${this.i18n.translate('dashboard.tile.domain')}: ${this.i18n.translate(labelKey)}`;
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.layout.moveVisible(event.previousIndex, event.currentIndex);
  }

  /** Keyboard alternative to dragging: arrow keys on the focused handle move the tile. */
  protected onHandleKeydown(event: KeyboardEvent, index: number): void {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    this.layout.moveVisible(index, index + step);
  }
}
