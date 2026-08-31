import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CreateSignupRequest, SignupsErrorResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { IconComponent } from '../shared/icon/icon.component';
import { SignupService } from './signup.service';

/** Mirrors `libs/domain/auth/password-policy.ts` (spec 005) — a client-side
 * hint only, not imported directly since `scope:frontend` can't depend on
 * `scope:domain` libs (eslint.config.mjs module boundaries); the server
 * remains the authoritative check. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Public self-service sign-up form (User Story 1, FR-001): shell-less (App
 * conditionally hides `app-shell` for `/signup*`, see app.ts), no session.
 * Submitting shows a "check your email" confirmation in place — there's no
 * auto-sign-in here (unlike invite-accept), since a sign-up still needs
 * email verification and admin approval before the account is usable.
 */
@Component({
  selector: 'app-signup',
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    RouterLink,
    IconComponent,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent {
  private readonly signupService = inject(SignupService);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set(null);

    const email = this.email().trim();
    if (!email) {
      this.errorMessage.set('Please enter your email.');
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    const passwordLength = this.password().length;
    if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
      this.errorMessage.set('Password must be 8–200 characters.');
      return;
    }

    this.submitting.set(true);
    const body: CreateSignupRequest = { email, password: this.password() };
    this.signupService.submit(body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const httpError = error as { status?: number; error?: SignupsErrorResponse };
        if (httpError.status === 403 && httpError.error?.error === 'signup_disabled') {
          this.errorMessage.set('Sign-up is not available right now.');
          return;
        }
        if (httpError.status === 409) {
          this.errorMessage.set("This email can't be used to sign up right now.");
          return;
        }
        this.errorMessage.set(
          httpError.error?.message ?? 'Unable to submit your sign-up. Please try again.',
        );
      },
    });
  }
}
