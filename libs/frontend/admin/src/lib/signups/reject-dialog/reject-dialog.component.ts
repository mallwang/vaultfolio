import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { SignupsAdminService } from '../signups.service';

/**
 * "Reject sign-up" dialog: an optional reason, kept admin-side only — never
 * exposed to the visitor's rejection email (FR-009). Mirrors
 * `invite-dialog.component.ts`'s structure.
 */
@Component({
  selector: 'app-reject-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    FormsModule,
    TranslatePipe,
    IconComponent,
  ],
  providers: [TranslatePipe],
  template: `
    <p-dialog
      [header]="'signups.rejectConfirmHeader' | translate"
      [modal]="true"
      [visible]="visible"
      [style]="{ width: '28rem' }"
      (visibleChange)="close()"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      @if (errorMessage()) {
        <p-message severity="error" styleClass="reject-dialog__error">{{
          errorMessage()
        }}</p-message>
      }

      <p class="reject-dialog__lede">
        {{ ('signups.rejectLede' | translate).replace('{{email}}', signupEmail) }}
      </p>

      <div class="field">
        <label for="reject-reason">{{ 'signups.rejectReasonLabel' | translate }}</label>
        <input
          pInputText
          id="reject-reason"
          [ngModel]="reason()"
          (ngModelChange)="reason.set($event)"
          autocomplete="off"
        />
      </div>

      <ng-template #footer>
        <button pButton type="button" severity="secondary" [text]="true" (click)="close()">
          {{ 'invitations.keepIt' | translate }}
        </button>
        <button pButton type="button" severity="danger" [loading]="submitting()" (click)="submit()">
          <app-icon name="close" /> {{ 'signups.rejectSignup' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-top: 1rem;
    }

    .reject-dialog__lede {
      color: var(--p-text-muted-color);
      margin: 0;
    }

    ::ng-deep .reject-dialog__error {
      display: block;
      margin-bottom: 1rem;
    }
  `,
})
export class RejectDialogComponent {
  @Input() visible = false;
  @Input() signupId: string | null = null;
  @Input() signupEmail = '';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() rejected = new EventEmitter<void>();

  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly signupsAdminService = inject(SignupsAdminService);
  private readonly translate = inject(TranslatePipe);

  protected close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.reset();
  }

  private reset(): void {
    this.reason.set('');
    this.errorMessage.set(null);
    this.submitting.set(false);
  }

  protected submit(): void {
    if (!this.signupId) {
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    const reason = this.reason().trim();
    this.signupsAdminService.reject(this.signupId, reason ? { reason } : {}).subscribe({
      next: () => {
        this.submitting.set(false);
        this.rejected.emit();
        this.close();
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set(this.translate.transform('signups.rejectError'));
      },
    });
  }
}
