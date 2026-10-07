import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  RouterOutlet,
  Router,
  RoutesRecognized,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { DOMAIN_REGISTRY, isDomainEntitled } from '@vaultfolio/frontend-domain-access';
import { MaintenanceNoticeComponent } from '@vaultfolio/frontend-shared-ui';
import { CurrentUserStore } from '../../auth/current-user.store';
import { DomainMaintenanceStore } from './domain-maintenance.store';

/**
 * Wraps the shell's `<router-outlet>`: for a domain in maintenance, members see the orange notice
 * instead of the domain page (the page is never created, so it makes no API calls) and admins see
 * a banner above it. The domain comes from the `/app/<path>` URL segment, resolved when the route
 * is recognised — before guards and activation — so a domain page never renders for a moment.
 * Until the maintenance list has loaded nothing renders, so no member request goes out early.
 */
@Component({
  selector: 'app-domain-maintenance-gate',
  imports: [RouterOutlet, MaintenanceNoticeComponent],
  template: `
    @if (store.loaded()) {
      @if (blocked()) {
        <app-maintenance-notice />
      } @else {
        @if (adminBanner()) {
          <app-maintenance-notice mode="banner" />
        }
        <router-outlet />
      }
    }
  `,
  styles: `
    app-maintenance-notice[mode='banner'] {
      display: block;
      margin-bottom: 1rem;
    }
  `,
})
export class DomainMaintenanceGateComponent {
  protected readonly store = inject(DomainMaintenanceStore);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof RoutesRecognized ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) =>
        event instanceof RoutesRecognized ? event.urlAfterRedirects : this.router.url,
      ),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly domainId = computed(() => {
    const [, app, path] = this.url().split(/[?#]/)[0].split('/');
    return app === 'app' ? DOMAIN_REGISTRY.find((d) => d.path === path)?.id : undefined;
  });

  private readonly inMaintenance = computed(() => {
    const id = this.domainId();
    return id !== undefined && this.store.isInMaintenance(id);
  });

  private readonly isAdmin = computed(() => this.currentUser.current()?.role === 'ADMIN');

  protected readonly blocked = computed(() => {
    const id = this.domainId();
    return (
      this.inMaintenance() &&
      !this.isAdmin() &&
      id !== undefined &&
      isDomainEntitled(this.currentUser.current(), id)
    );
  });

  protected readonly adminBanner = computed(() => this.inMaintenance() && this.isAdmin());

  constructor() {
    this.store.ensureLoaded();
  }
}
