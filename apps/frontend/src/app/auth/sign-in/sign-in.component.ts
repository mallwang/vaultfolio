import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import type { AuthErrorResponse } from '@vaultfolio/api-contract';
import { AuthService } from '../auth.service';
import { CurrentUserStore } from '../current-user.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Sign-in page (contracts/auth-api.md): email/password form; shows the
 * generic `invalid_credentials`/`account_locked` message from the backend
 * verbatim rather than distinguishing them further client-side, so the
 * server's byte-for-byte-identical response (FR-008/SC-005) isn't
 * re-differentiated in the UI.
 */
@Component({
  selector: 'app-sign-in',
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    CardModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [TranslatePipe],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslatePipe);

  email = '';
  password = '';
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.signIn({ email: this.email, password: this.password }).subscribe({
      next: (user) => {
        this.currentUser.setAuthenticated(user);
        this.router.navigateByUrl('/app/dashboard');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const body = (error as { error?: AuthErrorResponse })?.error;
        this.errorMessage.set(body?.message ?? this.translate.transform('signIn.genericError'));
      },
    });
  }
}
