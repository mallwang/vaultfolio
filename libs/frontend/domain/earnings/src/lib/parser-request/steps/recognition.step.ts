import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { ParserRequestStore } from '../parser-request.store';
import { wizardText } from './wizard-text';

/**
 * A scan chosen for a parser request (034 FR-010): the same per-file consent and progress as in the
 * import. Nothing starts before the user agrees; declining ends in the usual refusal.
 */
@Component({
  selector: 'app-request-recognition-step',
  imports: [ButtonModule, MessageModule, ProgressBarModule, TranslatePipe, IconComponent],
  template: `
    @if (store.recognitionState() === 'offer') {
      <p-message severity="info" data-testid="ocr-offer">
        <div class="box">
          <strong>{{ 'ocr.noText' | translate }}</strong>
          <span>{{ 'ocr.offerInfo' | translate }}</span>
          <div class="actions">
            <button
              pButton
              type="button"
              data-testid="ocr-accept"
              (click)="store.acceptRecognition()"
            >
              <app-icon name="scan" /> {{ 'ocr.accept' | translate }}
            </button>
            <button
              pButton
              type="button"
              severity="secondary"
              outlined
              data-testid="ocr-decline"
              (click)="store.declineRecognition()"
            >
              {{ 'ocr.decline' | translate }}
            </button>
            <span class="muted"><app-icon name="lock" /> {{ 'ocr.lock' | translate }}</span>
          </div>
        </div>
      </p-message>
    } @else {
      <div class="box" role="status" aria-live="polite" data-testid="ocr-progress">
        <span>{{ progressText() }}</span>
        <p-progressbar
          [value]="percent()"
          [showValue]="false"
          [mode]="store.recognitionProgress() ? 'determinate' : 'indeterminate'"
        />
        <div class="actions">
          <button
            pButton
            type="button"
            severity="secondary"
            outlined
            data-testid="ocr-cancel"
            (click)="store.cancelRecognition()"
          >
            {{ 'ocr.cancel' | translate }}
          </button>
          <span class="muted"><app-icon name="lock" /> {{ 'ocr.lock' | translate }}</span>
        </div>
      </div>
    }
  `,
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class RecognitionStepComponent {
  protected readonly store = inject(ParserRequestStore);
  private readonly t = wizardText();

  protected progressText(): string {
    const p = this.store.recognitionProgress();
    if (!p) return this.t('ocr.waiting');
    if (p.phase === 'LOADING') return this.t('ocr.loading');
    return this.t(p.phase === 'RENDERING' ? 'ocr.rendering' : 'ocr.page', {
      page: p.page,
      total: p.pageCount,
    });
  }

  protected percent(): number {
    const p = this.store.recognitionProgress();
    return p ? Math.round(((p.page - 1 + p.fraction) / p.pageCount) * 100) : 0;
  }
}
