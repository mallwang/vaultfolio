import { Component, computed, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import {
  IconComponent,
  TranslatePipe,
  DynamicOutletComponent,
} from '@vaultfolio/frontend-shared-ui';
import { isDomainEntitled } from '@vaultfolio/frontend-domain-access';
import { CurrentUserStore } from '../auth/current-user.store';
import { DASHBOARD_WIDGET_CONTRIBUTIONS } from './dashboard-widgets.registry';

/**
 * Dashboard area (FR-005): total value and today's change remain placeholder
 * shells; the "Allocation" card renders every `DASHBOARD_WIDGET_CONTRIBUTIONS`
 * entry the current user is entitled to (FR-001, FR-004,
 * 021-frontend-extension-points), via the generic `DynamicOutletComponent`.
 *
 * `DashboardComponent` itself has no domain-specific knowledge — it neither
 * imports a domain's widget component nor fetches that domain's data
 * (contrast the pre-021 version's direct `HoldingsDistributionComponent`
 * import + `HoldingsService` fetch, moved onto the generic mechanism as
 * proof, research.md #3). Adding a new domain's widget means adding one
 * entry to `DASHBOARD_WIDGET_CONTRIBUTIONS` — nothing here changes (SC-001).
 */
@Component({
  selector: 'app-dashboard',
  imports: [CardModule, TagModule, TranslatePipe, IconComponent, DynamicOutletComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly currentUserStore = inject(CurrentUserStore);

  protected readonly visibleWidgets = computed(() => {
    const user = this.currentUserStore.current();
    return DASHBOARD_WIDGET_CONTRIBUTIONS.filter((widget) =>
      isDomainEntitled(user, widget.domainId),
    );
  });
}
