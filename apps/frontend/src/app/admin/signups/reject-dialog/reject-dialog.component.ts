import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SignupsAdminService } from '../signups.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * "Reject sign-up" dialog: an optional reason, kept admin-side only — never
 * exposed to the visitor's rejection email (FR-009). Mirrors
 * `invite-dialog.component.ts`'s structure.
 */
@Component({
  selector: 'app-reject-dialog',
  imports: [DialogModule, ButtonModule, InputTextModule, MessageModule, FormsModule, TranslatePipe],
  providers: [TranslatePipe],
  templateUrl: './reject-dialog.component.html',
  styleUrl: './reject-dialog.component.css',
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
