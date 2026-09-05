import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { IconComponent } from '@vaultfolio/frontend-shared-ui';
import { ProfileService } from '../../settings/profile/profile.service';

/**
 * Forgot-password page (User Story 2, FR-006): shell-less, no session.
 * Shows an identical "sent" confirmation regardless of whether the address
 * has an account (SC-003) — there is deliberately no error branch to render
 * differently (contracts/profile-api.md's `POST /profile/forgot-password`
 * always returns `200 { accepted: true }`).
 */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, ButtonModule, CardModule, InputTextModule, RouterLink, IconComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly profileService = inject(ProfileService);

  protected readonly email = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);

  protected submit(): void {
    const email = this.email().trim();
    if (!email || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.profileService.requestPasswordReset({ email }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      // Even a network/server error still shows the same confirmation — the
      // request has already been fired, and this page must never reveal
      // whether it succeeded differently per account (SC-003).
      error: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
    });
  }
}
