import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProfileService } from '../../settings/profile/profile.service';

type ViewState = 'loading' | 'ready' | 'invalid';

/**
 * Email-change verification landing page (User Story 1, FR-002 Acceptance
 * Scenario 5): shell-less (see `App`'s route-based shell toggle in app.ts),
 * may have no session — looks up the token to show the target address
 * read-only, then confirms on click. Any "no longer valid" outcome (at
 * lookup or at confirm) routes to the shared link-invalid page rather than
 * distinguishing the cause client-side (SC-002), mirroring `invite/accept`.
 */
@Component({
  selector: 'app-verify-email',
  imports: [ButtonModule, CardModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);

  private token = '';

  protected readonly state = signal<ViewState>('loading');
  protected readonly newEmail = signal('');
  protected readonly confirming = signal(false);
  protected readonly confirmedEmail = signal<string | null>(null);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.goToInvalid();
      return;
    }
    this.profileService.lookupEmailChangeToken(this.token).subscribe({
      next: (lookup) => {
        this.newEmail.set(lookup.newEmail);
        this.state.set('ready');
      },
      error: () => this.goToInvalid(),
    });
  }

  private goToInvalid(): void {
    this.router.navigateByUrl('/account/link-invalid');
  }

  protected confirm(): void {
    if (this.confirming()) {
      return;
    }
    this.confirming.set(true);
    this.profileService.confirmEmailChange(this.token).subscribe({
      next: (result) => {
        this.confirming.set(false);
        this.confirmedEmail.set(result.email);
      },
      error: () => {
        this.confirming.set(false);
        this.goToInvalid();
      },
    });
  }
}
