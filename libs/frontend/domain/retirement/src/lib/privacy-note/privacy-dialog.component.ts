import { Component, model } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { PrivacyNoteComponent } from './privacy-note.component';

/** The privacy note (FR-016) as a modal, so it never takes over the page it is opened from. */
@Component({
  selector: 'app-retirement-privacy-dialog',
  imports: [DialogModule, IconComponent, TranslatePipe, PrivacyNoteComponent],
  template: `
    <p-dialog
      [header]="'retirement.privacy.title' | translate"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [visible]="visible()"
      [style]="{ width: '48rem' }"
      [breakpoints]="{ '960px': '90vw' }"
      [pt]="{ pcCloseButton: { root: { 'data-testid': 'retirement-privacy-dialog-close' } } }"
      (visibleChange)="visible.set($event)"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      <app-retirement-privacy-note />
    </p-dialog>
  `,
})
export class PrivacyDialogComponent {
  readonly visible = model(false);
}
