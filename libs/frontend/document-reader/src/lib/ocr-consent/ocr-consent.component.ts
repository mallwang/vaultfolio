import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * On-device text recognition, as the user sees it: the offer for a scan (consent) and the progress
 * of the running recognition. The parent owns the state machine; this block only renders it and
 * reports `allow` / `dismissed`. Wording comes from the shared `ocr.*` translation group.
 */
@Component({
  selector: 'vf-ocr-consent',
  imports: [ButtonModule, ProgressBarModule, IconComponent, TranslatePipe],
  template: `
    @if (state === 'offer') {
      <div class="ocr-offer" data-testid="ocr-offer" [attr.aria-label]="fileName || null">
        <p class="ocr-offer__text">{{ 'ocr.offerInfo' | translate }}</p>
        @if (pageCount !== null) {
          <p class="ocr-offer__pages muted" data-testid="ocr-page-count">
            {{ pageCountText }}
          </p>
        }
        <div class="ocr-offer__actions">
          <button
            pButton
            type="button"
            size="small"
            data-testid="ocr-accept"
            (click)="allow.emit()"
          >
            <app-icon name="scan" /> {{ 'ocr.accept' | translate }}
          </button>
          <button
            pButton
            type="button"
            size="small"
            severity="secondary"
            outlined
            data-testid="ocr-decline"
            (click)="dismissed.emit()"
          >
            {{ 'ocr.decline' | translate }}
          </button>
          <span class="muted"><app-icon name="lock" /> {{ 'ocr.lock' | translate }}</span>
        </div>
      </div>
    } @else {
      <div
        class="ocr-offer"
        role="status"
        aria-live="polite"
        data-testid="ocr-progress"
        [attr.aria-label]="fileName || null"
      >
        <p class="ocr-offer__text">{{ progressText }}</p>
        <p-progressbar
          [value]="progressPercent ?? 0"
          [showValue]="false"
          [mode]="progressPercent === null ? 'indeterminate' : 'determinate'"
        />
        <div class="ocr-offer__actions">
          <button
            pButton
            type="button"
            size="small"
            severity="secondary"
            outlined
            data-testid="ocr-cancel"
            (click)="dismissed.emit()"
          >
            {{ 'ocr.cancel' | translate }}
          </button>
          <span class="muted"><app-icon name="lock" /> {{ 'ocr.lock' | translate }}</span>
        </div>
      </div>
    }
  `,
  styles: `
    .ocr-offer {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .ocr-offer__text,
    .ocr-offer__pages {
      margin: 0;
      font-size: 0.875rem;
    }
    .ocr-offer__actions {
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
export class OcrConsentComponent {
  private readonly i18n = inject(I18nService);

  // Decorator inputs/outputs rather than `input()`/`output()`: consumers resolve this library through
  // node_modules, where the Angular compiler's signal transform is not applied (same as shared-ui).
  @Input() fileName = '';
  /** Pages of the document, when known; omitted → no page line. */
  @Input() pageCount: number | null = null;
  @Input() state: 'offer' | 'progress' = 'offer';
  /** Progress view: the status line (e.g. "Reading page 2 of 4"). */
  @Input() progressText = '';
  /** Progress view: 0–100, or `null` for an indeterminate bar. */
  @Input() progressPercent: number | null = null;
  @Output() readonly allow = new EventEmitter<void>();
  /** Offer: decline; progress: abort the running recognition. */
  @Output() readonly dismissed = new EventEmitter<void>();

  protected get pageCountText(): string {
    return this.i18n.translate('ocr.pageCount').replace('{{count}}', String(this.pageCount));
  }
}
