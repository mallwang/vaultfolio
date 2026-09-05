import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { InvitationsErrorResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { InvitationsService } from '../invitations.service';

type UserRole = 'ADMIN' | 'MEMBER';

interface RoleOption {
  label: string;
  value: UserRole;
}

const ROLE_OPTIONS: RoleOption[] = [
  { label: 'Member', value: 'MEMBER' },
  { label: 'Administrator', value: 'ADMIN' },
];

/**
 * "Invite a member" dialog (design.md "Invite dialog" / "Invite dialog —
 * already exists"): email + role, with an inline error banner for the
 * account-already-exists case rather than a generic toast, since the copy
 * needs to distinguish active vs. archived accounts (mockup.html).
 */
@Component({
  selector: 'app-invite-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    MessageModule,
    FormsModule,
    TranslatePipe,
    IconComponent,
  ],
  providers: [TranslatePipe],
  template: `
    <p-dialog
      [header]="'invitations.inviteAMember' | translate"
      [modal]="true"
      [visible]="visible"
      [style]="{ width: '28rem' }"
      (visibleChange)="close()"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      @if (errorMessage()) {
        <p-message severity="error" styleClass="invite-dialog__error">{{
          errorMessage()
        }}</p-message>
      }

      <div class="field">
        <label for="invite-email">{{ 'signIn.email' | translate }}</label>
        <input
          pInputText
          id="invite-email"
          type="email"
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
          autocomplete="off"
        />
      </div>

      <div class="field">
        <label for="invite-role">{{ 'accounts.columnRole' | translate }}</label>
        <p-select
          id="invite-role"
          [options]="roleOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="role()"
          (ngModelChange)="role.set($event)"
        >
          <ng-template #dropdownicon><app-icon name="chevron-down" /></ng-template>
        </p-select>
      </div>

      <p class="invite-dialog__hint">{{ 'invitations.dialogHint' | translate }}</p>

      <ng-template #footer>
        <button pButton type="button" severity="secondary" [text]="true" (click)="close()">
          {{ 'common.cancel' | translate }}
        </button>
        <button
          pButton
          type="button"
          [loading]="submitting()"
          [disabled]="!email().trim()"
          (click)="submit()"
        >
          <app-icon name="send" /> {{ 'invitations.sendInvitation' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 1rem;
    }

    .field label {
      font-weight: 600;
    }

    .invite-dialog__hint {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      margin: 0 0 0.5rem;
    }

    ::ng-deep .invite-dialog__error {
      display: block;
      margin-bottom: 1rem;
    }
  `,
})
export class InviteDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() created = new EventEmitter<void>();

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly email = signal('');
  protected readonly role = signal<UserRole>('MEMBER');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly invitationsService = inject(InvitationsService);
  private readonly translate = inject(TranslatePipe);

  protected close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.reset();
  }

  private reset(): void {
    this.email.set('');
    this.role.set('MEMBER');
    this.errorMessage.set(null);
    this.submitting.set(false);
  }

  protected submit(): void {
    const email = this.email().trim();
    if (!email) {
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    this.invitationsService.create({ email, role: this.role() }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.created.emit();
        this.close();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const httpError = error as { status?: number; error?: InvitationsErrorResponse };
        if (httpError.status === 409 && httpError.error?.error === 'account_exists') {
          this.errorMessage.set(
            this.translate.transform('invitations.accountExists').replace('{{email}}', email),
          );
          return;
        }
        this.errorMessage.set(this.translate.transform('invitations.sendError'));
      },
    });
  }
}
