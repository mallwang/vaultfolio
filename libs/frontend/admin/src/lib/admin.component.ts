import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TranslatePipe, routeTabs } from '@vaultfolio/frontend-shared-ui';
import { RequestsService } from './requests/requests.service';

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
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is consumed cross-package (`apps/frontend/src/app.routes.ts`
 * lazy-loads it as the `/app/admin` route's target), and
 * `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining there —
 * see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-admin',
  imports: [TabsModule, TagModule, RouterOutlet, TranslatePipe],
  template: `
    <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
      <p-tablist>
        <p-tab value="accounts" data-testid="admin-tab-accounts">{{
          'nav.accounts' | translate
        }}</p-tab>
        <p-tab value="signups" data-testid="admin-tab-signups">{{
          'nav.signups' | translate
        }}</p-tab>
        <p-tab value="invitations" data-testid="admin-tab-invitations">{{
          'nav.invitations' | translate
        }}</p-tab>
        <p-tab value="requests" data-testid="admin-tab-requests">
          {{ 'nav.requests' | translate }}
          @if (openRequests() > 0) {
            <p-tag
              severity="warn"
              [rounded]="true"
              [value]="'' + openRequests()"
              data-testid="admin-tab-requests-count"
            />
          }
        </p-tab>
        <p-tab value="general" data-testid="admin-tab-general">{{
          'admin.general' | translate
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
export class AdminComponent implements OnInit {
  private readonly requests = inject(RequestsService);
  protected readonly openRequests = this.requests.openCount;

  private readonly tabs = routeTabs('accounts');
  protected readonly activeTab = this.tabs.activeTab;
  protected readonly onTabChange = this.tabs.onTabChange;

  ngOnInit(): void {
    this.requests.refreshOpenCount();
  }
}
