import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Popover, PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { hintTestId } from '@vaultfolio/frontend-hints';
import { HintsStore } from '../hints.store';

/**
 * T017: Panel that lists active hints (grouped), with a hidden section.
 * Desktop: p-popover anchored to the bell. Mobile (≤768 px): p-dialog modal.
 */
@Component({
  selector: 'app-hints-panel',
  imports: [
    ButtonModule,
    DialogModule,
    NgTemplateOutlet,
    PopoverModule,
    TooltipModule,
    TranslatePipe,
    IconComponent,
  ],
  templateUrl: './hints-panel.component.html',
})
export class HintsPanelComponent {
  @ViewChild('popover') protected popover?: Popover;

  protected readonly store = inject(HintsStore);
  protected readonly view = computed(() => this.store.view());
  protected readonly isMobile = signal(window.matchMedia('(max-width: 768px)').matches);
  protected readonly dialogVisible = signal(false);
  protected readonly showHidden = signal(false);

  protected readonly hintTestId = hintTestId;

  /** Called by HintsBellComponent's `toggled` output (wired in the header). */
  toggle(event: MouseEvent): void {
    if (this.isMobile()) {
      this.dialogVisible.update((v) => !v);
    } else {
      this.popover?.toggle(event);
    }
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
