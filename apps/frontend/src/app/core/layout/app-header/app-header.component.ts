import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { filter, map, startWith } from 'rxjs';
import { APPLICATION_AREAS } from '../application-areas';

/**
 * Shows a small "Vaultfolio" eyebrow/crumb plus the active area's title, with
 * a user-identity placeholder on the right (design.md "Header").
 */
@Component({
  selector: 'app-header',
  imports: [AvatarModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  private readonly router = inject(Router);

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
}
