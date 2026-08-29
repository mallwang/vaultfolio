import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { filter, map, startWith } from 'rxjs';
import { APPLICATION_AREAS } from '../application-areas';
import { AuthService } from '../../../auth/auth.service';
import { CurrentUserStore } from '../../../auth/current-user.store';

/**
 * Shows a small "Vaultfolio" eyebrow/crumb plus the active area's title, with
 * the signed-in user's name/avatar and a sign-out action on the right
 * (design.md "Header").
 */
@Component({
  selector: 'app-header',
  imports: [AvatarModule, ButtonModule, TooltipModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserStore);

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
    const area = APPLICATION_AREAS.find((candidate) => url.startsWith(`/${candidate.path}`));
    return area?.label ?? 'Vaultfolio';
  });

  protected readonly user = this.currentUser.current;

  protected readonly userInitials = computed(() => {
    const name = this.user()?.displayName ?? '';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .slice(0, 2)
        .join('') || '?'
    );
  });

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
    this.currentUser.clear();
    this.router.navigateByUrl('/sign-in');
  }
}
