import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Admin area (012-restructure-admin-nav): the admin-only "Accounts",
 * "Sign-ups", and "Invitations" sub-tabs, plus a "General" tab hosting the
 * pre-existing health-status screen — relocated out of Settings and gated by
 * `adminGuard` at the route level (plan.md, research.md "Decision: Admin tab
 * container mirrors Settings' existing PrimeNG tabs pattern").
 *
 * Each tab is its own address (`/app/admin/accounts`,
 * `/app/admin/invitations`, etc. — 012 US4) via child routes in
 * `app.routes.ts` that lazy-load the tab's component into the
 * `<router-outlet>` below (inheriting `adminGuard` from this parent route):
 * `activeTab` mirrors the active child segment so a direct visit (e.g. an
 * email link) opens the right tab, and `onTabChange` navigates to the
 * selected tab's route so the URL stays in sync.
 */
@Component({
  selector: 'app-admin',
  imports: [TabsModule, RouterOutlet, TranslatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.url[0]?.path ?? 'accounts'),
      startWith(this.route.snapshot.firstChild?.url[0]?.path ?? 'accounts'),
    ),
    { initialValue: 'accounts' },
  );

  protected onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    this.router.navigate([String(value)], { relativeTo: this.route });
  }
}
