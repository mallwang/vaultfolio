import { Component, computed, inject, output } from '@angular/core';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { HintsStore } from '../hints.store';

/**
 * T016: Bell button + badge shown in the authenticated header. Emits
 * `toggled` when clicked so the parent can open/close the panel.
 */
@Component({
  selector: 'app-hints-bell',
  imports: [BadgeModule, ButtonModule, TooltipModule, TranslatePipe, IconComponent],
  templateUrl: './hints-bell.component.html',
})
export class HintsBellComponent {
  protected readonly store = inject(HintsStore);
  protected readonly badge = computed(() => this.store.view().badge);

  readonly toggled = output<MouseEvent>();

  protected toggle(event: MouseEvent): void {
    this.toggled.emit(event);
  }
}
