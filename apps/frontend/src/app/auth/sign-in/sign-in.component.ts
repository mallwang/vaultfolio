import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
 *
 * On success, returns the user to the deep link they were headed for
 * (`?redirect=`, set by `authGuard`/`authInterceptor`) rather than always
 * to the dashboard. Only a same-origin, in-app path (`/app/...`) is
 * honored — anything else falls back to the dashboard, so the query param
 * can't be abused as an open redirect.
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
  private readonly route = inject(ActivatedRoute);
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
        this.router.navigateByUrl(this.redirectTarget());
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const body = (error as { error?: AuthErrorResponse })?.error;
        this.errorMessage.set(body?.message ?? this.translate.transform('signIn.genericError'));
      },
    });
  }

  private redirectTarget(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    return redirect?.startsWith('/app/') ? redirect : '/app/dashboard';
  }
}
