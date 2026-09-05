import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Holdings area (021-frontend-extension-points, US3): a "List" sub-tab (the
 * pre-existing `HoldingsComponent` page, unchanged) plus an "Imports"
 * sub-tab (the pre-existing `ImportsComponent`, moved here from its own
 * standalone `/app/imports` route/nav entry — FR-008/FR-009). Mirrors
 * `SettingsComponent`/`AdminComponent`'s existing PrimeNG tabs + child-
 * router-outlet container pattern exactly (research.md #5): `domainGuard
 * ('holdings')` stays on this component's own parent route only, and both
 * tabs inherit it the same way `adminGuard` already covers every Admin
 * sub-route (FR-011).
 *
 * Each tab is its own address (`/app/holdings/list`,
 * `/app/holdings/imports`) via child routes in `app.routes.ts` that
 * lazy-load the tab's component into the `<router-outlet>` below:
 * `activeTab` mirrors the active child segment so a direct visit opens the
 * right tab, and `onTabChange` navigates to the selected tab's route so the
 * URL stays in sync.
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is consumed cross-package (`apps/frontend/src/app.routes.ts`
 * lazy-loads it as the `/app/holdings` route's target), and
 * `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining there —
 * see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-holdings-area',
  imports: [TabsModule, RouterOutlet, TranslatePipe],
  template: `
    <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
      <p-tablist>
        <p-tab value="list">{{ 'holdingsArea.list' | translate }}</p-tab>
        <p-tab value="imports">{{ 'holdingsArea.imports' | translate }}</p-tab>
      </p-tablist>
      <p-tabpanels>
        <router-outlet />
      </p-tabpanels>
    </p-tabs>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  `,
})
export class HoldingsAreaComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.url[0]?.path ?? 'list'),
      startWith(this.route.snapshot.firstChild?.url[0]?.path ?? 'list'),
    ),
    { initialValue: 'list' },
  );

  protected onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    this.router.navigate([String(value)], { relativeTo: this.route });
  }
}
