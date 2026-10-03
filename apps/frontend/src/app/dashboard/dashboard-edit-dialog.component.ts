import { Component, computed, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { DashboardLayoutStore } from './dashboard-layout.store';

/**
 * Modal to switch individual Dashboard tiles on or off. A tile whose feature is disabled for the
 * account is still listed, but with a greyed-out switch and a pointer to the administrator —
 * the user cannot enable what the admin has not released.
 */
@Component({
  selector: 'app-dashboard-edit-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    ToggleSwitchModule,
    TranslatePipe,
    IconComponent,
  ],
  templateUrl: './dashboard-edit-dialog.component.html',
  styleUrl: './dashboard-edit-dialog.component.css',
})
export class DashboardEditDialogComponent {
  private readonly layout = inject(DashboardLayoutStore);

  readonly visible = model(false);

  protected readonly tiles = this.layout.tiles;
  protected readonly isCustomized = computed(() => this.layout.isCustomized());

  protected setVisible(id: string, visible: boolean): void {
    this.layout.setTileVisible(id, visible);
  }

  protected reset(): void {
    this.layout.reset();
  }
}
