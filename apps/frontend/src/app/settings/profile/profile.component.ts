import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { ProfileErrorResponse, ProfileSummary } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CurrentUserStore } from '../../auth/current-user.store';
import { ProfileService } from './profile.service';

/** Mirrors `libs/domain/auth/password-policy.ts` — a client-side hint only (scope:frontend can't depend on scope:domain libs). */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

type DangerStep = 'closed' | 'advisory' | 'confirm' | 'blocked';

function errorOf(error: unknown): { status?: number; body?: ProfileErrorResponse } {
  const httpError = error as { status?: number; error?: ProfileErrorResponse };
  return { status: httpError.status, body: httpError.error };
}

/**
 * Profile sub-tab (design.md): identity/display-name card (FR-001, FR-004 —
 * saves update `CurrentUserStore` so the header reflects it with no reload),
 * email card (FR-002/FR-003), password card (FR-005/FR-007), and the Danger
 * Zone (FR-008–FR-010). Every mutation re-fetches the profile from the
 * server rather than reconciling local state by hand (YAGNI, Principle V,
 * mirrors `AccountsComponent`'s convention).
 */
@Component({
  selector: 'app-profile',
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly profile = signal<ProfileSummary | null>(null);

  // Display name
  protected readonly displayName = signal('');
  protected readonly savingName = signal(false);

  // Email change
  protected readonly newEmail = signal('');
  protected readonly requestingEmailChange = signal(false);
  protected readonly emailErrorMessage = signal<string | null>(null);

  // Password
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmNewPassword = signal('');
  protected readonly changingPassword = signal(false);
  protected readonly currentPasswordError = signal(false);
  protected readonly passwordErrorMessage = signal<string | null>(null);

  // Danger Zone
  protected readonly dangerStep = signal<DangerStep>('closed');
  protected readonly deleteConfirmText = signal('');
  protected readonly deleting = signal(false);
  protected readonly deleteErrorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.displayName.set(profile.displayName);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected saveDisplayName(): void {
    const displayName = this.displayName().trim();
    if (!displayName || this.savingName()) {
      return;
    }
    this.savingName.set(true);
    this.profileService.updateDisplayName({ displayName }).subscribe({
      next: (profile) => {
        this.savingName.set(false);
        this.profile.set(profile);
        this.displayName.set(profile.displayName);
        // FR-004: the header reflects the change immediately, no reload.
        const current = this.currentUser.current();
        if (current) {
          this.currentUser.set({ ...current, displayName: profile.displayName });
        }
        this.messageService.add({ severity: 'success', summary: 'Display name updated' });
      },
      error: () => {
        this.savingName.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to update your display name.',
        });
      },
    });
  }

  protected requestEmailChange(): void {
    const newEmail = this.newEmail().trim();
    if (!newEmail || this.requestingEmailChange()) {
      return;
    }
    this.emailErrorMessage.set(null);
    this.requestingEmailChange.set(true);
    this.profileService.requestEmailChange({ newEmail }).subscribe({
      next: () => {
        this.requestingEmailChange.set(false);
        this.newEmail.set('');
        this.refresh();
        this.messageService.add({ severity: 'success', summary: 'Verification link sent' });
      },
      error: (error: unknown) => {
        this.requestingEmailChange.set(false);
        const { status, body } = errorOf(error);
        if (status === 409) {
          this.emailErrorMessage.set("This email can't be used right now.");
          return;
        }
        if (status === 502) {
          this.emailErrorMessage.set(
            body?.message ?? 'Request saved, but the email could not be sent.',
          );
          this.refresh();
          return;
        }
        this.emailErrorMessage.set('Unable to request an email change. Please try again.');
      },
    });
  }

  protected cancelEmailChange(): void {
    this.profileService.cancelEmailChange().subscribe({
      next: () => this.refresh(),
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to cancel the pending request.',
        }),
    });
  }

  protected changePassword(): void {
    if (this.changingPassword()) {
      return;
    }
    this.currentPasswordError.set(false);
    this.passwordErrorMessage.set(null);

    if (this.newPassword() !== this.confirmNewPassword()) {
      this.passwordErrorMessage.set('Passwords do not match.');
      return;
    }
    const length = this.newPassword().length;
    if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
      this.passwordErrorMessage.set('Password must be 8–200 characters.');
      return;
    }

    this.changingPassword.set(true);
    this.profileService
      .changePassword({
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword(),
      })
      .subscribe({
        next: () => {
          this.changingPassword.set(false);
          this.currentPassword.set('');
          this.newPassword.set('');
          this.confirmNewPassword.set('');
          this.messageService.add({
            severity: 'success',
            summary: 'Password changed',
            detail: 'Your other active sessions were signed out.',
          });
        },
        error: (error: unknown) => {
          this.changingPassword.set(false);
          const { status } = errorOf(error);
          if (status === 401) {
            this.currentPasswordError.set(true);
            this.passwordErrorMessage.set("That's not your current password. Nothing was changed.");
            return;
          }
          if (status === 400) {
            this.passwordErrorMessage.set('Password must be 8–200 characters.');
            return;
          }
          this.passwordErrorMessage.set('Unable to change your password. Please try again.');
        },
      });
  }

  protected openDangerZone(): void {
    this.deleteErrorMessage.set(null);
    this.deleteConfirmText.set('');
    this.dangerStep.set('advisory');
  }

  protected closeDangerZone(): void {
    this.dangerStep.set('closed');
    this.deleteConfirmText.set('');
    this.deleteErrorMessage.set(null);
  }

  protected proceedToConfirm(): void {
    this.dangerStep.set('confirm');
  }

  protected confirmDeleteAccount(): void {
    if (this.deleteConfirmText() !== 'DELETE' || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.deleteErrorMessage.set(null);
    this.profileService.deleteAccount().subscribe({
      next: () => {
        this.currentUser.clear();
        this.router.navigateByUrl('/sign-in');
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        const { status } = errorOf(error);
        if (status === 409) {
          this.dangerStep.set('blocked');
          return;
        }
        this.deleteErrorMessage.set('Something went wrong. Your account was not changed.');
      },
    });
  }
}
