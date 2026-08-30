import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TabsModule } from 'primeng/tabs';

/**
 * Settings area (012-restructure-admin-nav): a "Profile" sub-tab (008 —
 * every signed-in user, listed first per design.md) plus a "Preferences"
 * sub-tab, both visible to every signed-in user regardless of role. The
 * admin-only sections previously hosted here (Accounts, Sign-ups,
 * Invitations, General) have moved to the dedicated `/app/admin` area.
 *
 * Each tab is its own address (`/app/settings/profile`,
 * `/app/settings/preferences` — 012 US4) via child routes in
 * `app.routes.ts` that lazy-load the tab's component into the
 * `<router-outlet>` below: `activeTab` mirrors the active child segment so a
 * direct visit (e.g. an email link) opens the right tab, and `onTabChange`
 * navigates to the selected tab's route so the URL stays in sync.
 */
@Component({
  selector: 'app-settings',
  imports: [TabsModule, RouterOutlet],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.url[0]?.path ?? 'profile'),
      startWith(this.route.snapshot.firstChild?.url[0]?.path ?? 'profile'),
    ),
    { initialValue: 'profile' },
  );

  protected onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    this.router.navigate([String(value)], { relativeTo: this.route });
  }
}
