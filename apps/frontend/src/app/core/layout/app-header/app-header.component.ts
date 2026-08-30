import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { filter, map, startWith } from 'rxjs';
import { APPLICATION_AREAS } from '../application-areas';
import { AuthService } from '../../../auth/auth.service';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { ThemeService } from '../../theme/theme.service';

/**
 * Shows a small "Vaultfolio" eyebrow/crumb plus the active area's title, with
 * the signed-in user's name and a sign-out action on the right
 * (design.md "Header").
 */
@Component({
  selector: 'app-header',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserStore);
  // Eagerly injected (research.md #3): this component is always rendered at
  // the app root, so constructing ThemeService here resolves/applies the
  // initial theme before any routed page content paints.
  private readonly themeService = inject(ThemeService);
  protected readonly theme = this.themeService.theme;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeAreaTitle = computed(() => {
    const url = this.currentUrl();
    const area = APPLICATION_AREAS.find((candidate) => url.startsWith(`/app/${candidate.path}`));
    return area?.label ?? 'Vaultfolio';
  });

  protected readonly isAuthenticated = computed(
    () => this.currentUser.status() === 'authenticated',
  );

  /**
   * data-model.md "Auth Status": resolves to "signed out" (no user) unless
   * status is `authenticated`, so a stale `SessionUser` from a prior session
   * can never surface identity content while status is `unknown` or
   * `unauthenticated` (no flash of the wrong state).
   */
  protected readonly user = computed(() =>
    this.isAuthenticated() ? this.currentUser.current() : null,
  );

  /** FR-004 (008): reflects role next to the display name — `SessionUser.role` already exists. */
  protected readonly roleLabel = computed(() =>
    this.user()?.role === 'ADMIN' ? 'Admin' : 'Member',
  );

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected signOut(): void {
    this.authService.signOut().subscribe({
      next: () => this.completeSignOut(),
      // Even if the request fails (e.g. session already expired), clear
      // local state and send the user to sign-in rather than leaving them
      // stuck on a page that thinks they're still authenticated.
      error: () => this.completeSignOut(),
    });
  }

  private completeSignOut(): void {
    this.currentUser.setUnauthenticated();
    this.router.navigateByUrl('/sign-in');
  }
}
