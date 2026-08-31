import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { AcceptInvitationRequest, InvitationsErrorResponse } from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { IconComponent } from '../../shared/icon/icon.component';
import { InvitationsService } from '../../admin/invitations/invitations.service';

const ROLE_LABEL: Record<'ADMIN' | 'MEMBER', string> = {
  ADMIN: 'an Administrator',
  MEMBER: 'a Member',
};

/** Mirrors `libs/domain/auth/password-policy.ts` (spec 005) — a client-side
 * hint only, not imported directly since `scope:frontend` can't depend on
 * `scope:domain` libs (eslint.config.mjs module boundaries); the server
 * remains the authoritative check. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Invitee-facing accept page (design.md "Accept-invite page"): shell-less
 * (App conditionally hides `app-shell` for `/invite/*`, see app.ts), no
 * session yet. Looks up the token to show the invited email/role read-only,
 * then submits a chosen password to activate the account and sign in. Any
 * "no longer valid" outcome (FR-012) — at lookup or at submit — routes to
 * the neutral expired page rather than distinguishing the cause client-side.
 */
@Component({
  selector: 'app-invite-accept',
  imports: [FormsModule, ButtonModule, CardModule, InputTextModule, MessageModule, IconComponent],
  templateUrl: './accept.component.html',
  styleUrl: './accept.component.css',
})
export class AcceptComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invitationsService = inject(InvitationsService);

  private token = '';

  protected readonly loading = signal(true);
  protected readonly email = signal('');
  protected readonly roleLabel = signal('');
  protected readonly displayName = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.goToExpired();
      return;
    }
    this.invitationsService.lookupToken(this.token).subscribe({
      next: (lookup) => {
        this.email.set(lookup.email);
        this.roleLabel.set(ROLE_LABEL[lookup.role]);
        this.loading.set(false);
      },
      error: () => this.goToExpired(),
    });
  }

  private goToExpired(): void {
    this.router.navigateByUrl('/invite/expired');
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set(null);

    if (!this.displayName().trim()) {
      this.errorMessage.set('Please enter your name.');
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
    const body: AcceptInvitationRequest = {
      password: this.password(),
      displayName: this.displayName().trim(),
    };
    this.invitationsService.accept(this.token, body).subscribe({
      next: () => {
        this.router.navigateByUrl('/app/dashboard');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const httpError = error as { status?: number; error?: InvitationsErrorResponse };
        if (httpError.status === 410) {
          this.goToExpired();
          return;
        }
        this.errorMessage.set(
          httpError.error?.message ?? 'Unable to activate this account. Please try again.',
        );
      },
    });
  }
}
