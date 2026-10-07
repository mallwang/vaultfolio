import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { hintTestId } from '@vaultfolio/frontend-hints';
import { HintsStore } from '../hints.store';

/**
 * T017: Panel that lists active hints (grouped), with a hidden section.
 * Rendered as a modal right-hand side drawer with a backdrop.
 */
@Component({
  selector: 'app-hints-panel',
  imports: [ButtonModule, DrawerModule, RouterLink, TooltipModule, TranslatePipe, IconComponent],
  templateUrl: './hints-panel.component.html',
  styleUrl: './hints-panel.component.css',
})
export class HintsPanelComponent {
  protected readonly store = inject(HintsStore);
  protected readonly view = computed(() => this.store.view());
  protected readonly visible = signal(false);
  protected readonly showHidden = signal(false);

  protected readonly hintTestId = hintTestId;

  /** Called by HintsBellComponent's `toggled` output (wired in the header). */
  toggle(): void {
    this.visible.update((v) => !v);
    this.store.forceRefresh();
  }

  protected hide(id: string): void {
    this.store.hide(id);
  }

  protected restore(id: string): void {
    this.store.restore(id);
  }

  protected toggleHidden(): void {
    this.showHidden.update((v) => !v);
  }
}
