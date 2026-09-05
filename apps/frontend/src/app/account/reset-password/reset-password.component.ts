import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { IconComponent } from '@vaultfolio/frontend-shared-ui';
import { CurrentUserStore } from '../../auth/current-user.store';
import { ProfileService } from '../../settings/profile/profile.service';

/** Mirrors `libs/domain/auth/password-policy.ts` — a client-side hint only (scope:frontend can't depend on scope:domain libs). */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Password-reset landing page (User Story 2, FR-006 Acceptance Scenario 4):
 * shell-less, no session yet. Looks up the token to gate the form, then on
 * submit sets a new password and — since the confirm route signs the user
 * in (contracts/profile-api.md) — stores the returned session and navigates
 * to `/dashboard`. Any "no longer valid" outcome routes to the shared
 * link-invalid page (SC-002), mirroring `invite/accept`.
 */
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, ButtonModule, CardModule, InputTextModule, MessageModule, IconComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private readonly currentUser = inject(CurrentUserStore);

  private token = '';

  protected readonly loading = signal(true);
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.goToInvalid();
      return;
    }
    this.profileService.lookupResetToken(this.token).subscribe({
      next: () => this.loading.set(false),
      error: () => this.goToInvalid(),
    });
  }

  private goToInvalid(): void {
    this.router.navigateByUrl('/account/link-invalid');
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set(null);

    if (this.newPassword() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    const length = this.newPassword().length;
    if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
      this.errorMessage.set('Password must be 8–200 characters.');
      return;
    }

    this.submitting.set(true);
    this.profileService
      .confirmPasswordReset(this.token, { newPassword: this.newPassword() })
      .subscribe({
        next: (user) => {
          this.currentUser.setAuthenticated(user);
          this.router.navigateByUrl('/app/dashboard');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const httpError = error as { status?: number };
          if (httpError.status === 410) {
            this.goToInvalid();
            return;
          }
          this.errorMessage.set('Unable to reset your password. Please try again.');
        },
      });
  }
}
