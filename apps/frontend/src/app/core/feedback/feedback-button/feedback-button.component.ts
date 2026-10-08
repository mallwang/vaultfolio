import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { FeedbackStore } from '../feedback.store';

/** Header icon button that opens the feedback dialog. */
@Component({
  selector: 'app-feedback-button',
  imports: [ButtonModule, TooltipModule, TranslatePipe, IconComponent],
  template: `
    <button
      pButton
      data-testid="feedback-button"
      type="button"
      iconOnly
      severity="secondary"
      [text]="true"
      [attr.aria-label]="'feedback.button' | translate"
      [pTooltip]="'feedback.button' | translate"
      tooltipPosition="bottom"
      appendTo="body"
      (click)="store.openDialog()"
    >
      <app-icon name="feedback" />
    </button>
  `,
})
export class FeedbackButtonComponent {
  protected readonly store = inject(FeedbackStore);
}
