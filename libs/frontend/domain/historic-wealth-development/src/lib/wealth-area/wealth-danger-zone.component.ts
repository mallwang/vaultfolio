import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { WealthStore } from '../wealth-store';
import { WealthService } from '../wealth.service';

/**
 * Danger zone (FR-021): deletes every snapshot and the balance group settings after a
 * confirmation; the page and the dashboard tile return to their empty states.
 */
@Component({
  selector: 'app-wealth-danger-zone',
  imports: [ButtonModule, DialogModule, MessageModule, TranslatePipe],
  template: `
    <section class="danger" data-testid="wealth-danger-zone">
      <div>
        <h2>{{ 'wealth.danger.title' | translate }}</h2>
        <p>{{ 'wealth.danger.body' | translate }}</p>
      </div>
      <button
        type="button"
        pButton
        severity="danger"
        [outlined]="true"
        data-testid="wealth-delete-all"
        (click)="open.set(true)"
      >
        {{ 'wealth.danger.button' | translate }}
      </button>
    </section>
    <p-dialog
      [visible]="open()"
      (visibleChange)="$event || close()"
      [modal]="true"
      [header]="'wealth.danger.confirmTitle' | translate"
      [style]="{ width: '28rem' }"
    >
      <p>{{ 'wealth.danger.confirmBody' | translate }}</p>
      @if (failed()) {
        <p-message severity="error" data-testid="wealth-delete-all-error">{{
          'wealth.danger.failed' | translate
        }}</p-message>
      }
      <ng-template #footer>
        <button
          type="button"
          pButton
          severity="secondary"
          [outlined]="true"
          data-testid="wealth-delete-all-cancel"
          (click)="close()"
        >
          {{ 'wealth.danger.cancel' | translate }}
        </button>
        <button
          type="button"
          pButton
          severity="danger"
          data-testid="wealth-delete-all-confirm"
          (click)="confirm()"
        >
          {{ 'wealth.danger.confirm' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .danger {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.5rem;
      padding: 1rem;
      border: 1px solid color-mix(in srgb, var(--p-red-500) 40%, transparent);
      border-radius: var(--p-content-border-radius, 0.5rem);
    }
    h2 {
      margin: 0;
      font-size: 1rem;
    }
    p {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class WealthDangerZoneComponent {
  private readonly service = inject(WealthService);
  private readonly store = inject(WealthStore);

  protected readonly open = signal(false);
  protected readonly failed = signal(false);

  protected close(): void {
    this.open.set(false);
    this.failed.set(false);
  }

  protected confirm(): void {
    this.service.deleteAll().subscribe({
      next: () => {
        this.close();
        this.store.refresh();
      },
      error: () => this.failed.set(true),
    });
  }
}
