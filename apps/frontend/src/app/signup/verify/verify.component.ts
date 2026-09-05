import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { IconComponent } from '@vaultfolio/frontend-shared-ui';
import { SignupService } from '../signup.service';

type ViewState = 'loading' | 'verified' | 'invalid';

/**
 * Verify-link landing page (User Story 1, FR-003): opening the link is
 * itself the verification — the token already carries the challenge, so
 * there's no separate user action to wait for. Any "no longer valid"
 * outcome collapses to the same neutral `invalid` view (FR-010), mirroring
 * `invite/expired`'s no-distinguishing-detail approach.
 */
@Component({
  selector: 'app-signup-verify',
  imports: [ButtonModule, CardModule, RouterLink, IconComponent],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.css',
})
export class VerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly signupService = inject(SignupService);

  protected readonly state = signal<ViewState>('loading');

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.signupService.verify(token).subscribe({
      next: () => this.state.set('verified'),
      error: () => this.state.set('invalid'),
    });
  }
}
