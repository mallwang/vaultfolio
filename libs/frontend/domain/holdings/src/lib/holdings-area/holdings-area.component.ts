import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe, routeTabs } from '@vaultfolio/frontend-shared-ui';

/**
 * Holdings area (021-frontend-extension-points, US3): a "List" sub-tab (the
 * `HoldingsComponent` page). Mirrors
 * `SettingsComponent`/`AdminComponent`'s existing PrimeNG tabs + child-
 * router-outlet container pattern exactly (research.md #5): `domainGuard
 * ('holdings')` stays on this component's own parent route only, and the
 * tab inherits it the same way `adminGuard` already covers every Admin
 * sub-route (FR-011).
 *
 * The tab is its own address (`/app/holdings/list`) via a child route in `app.routes.ts` that
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
        <p-tab value="list" data-testid="holdings-area-tab-list">{{
          'holdingsArea.list' | translate
        }}</p-tab>
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
  private readonly tabs = routeTabs('list');
  protected readonly activeTab = this.tabs.activeTab;
  protected readonly onTabChange = this.tabs.onTabChange;
}
