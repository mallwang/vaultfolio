import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SignupService } from '../signup.service';

type ViewState = 'loading' | 'ready' | 'verified' | 'invalid';

/**
 * Verify-link landing page (User Story 1, FR-003): looks up the token first
 * (so a stale/used/expired link never triggers a mutating verify call), then
 * verifies on user action. Any "no longer valid" outcome — at lookup or at
 * verify — collapses to the same neutral `invalid` view (FR-010), mirroring
 * `invite/expired`'s no-distinguishing-detail approach.
 */
@Component({
  selector: 'app-signup-verify',
  imports: [ButtonModule, CardModule, RouterLink],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.css',
})
export class VerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly signupService = inject(SignupService);

  private token = '';

  protected readonly state = signal<ViewState>('loading');
  protected readonly email = signal('');
  protected readonly verifying = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    this.signupService.lookupToken(this.token).subscribe({
      next: (lookup) => {
        this.email.set(lookup.email);
        this.state.set('ready');
      },
      error: () => this.state.set('invalid'),
    });
  }

  protected confirm(): void {
    if (this.verifying()) {
      return;
    }
    this.verifying.set(true);
    this.signupService.verify(this.token).subscribe({
      next: () => {
        this.verifying.set(false);
        this.state.set('verified');
      },
      error: () => {
        this.verifying.set(false);
        this.state.set('invalid');
      },
    });
  }
}
