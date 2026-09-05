import type { DashboardWidgetContribution } from '@vaultfolio/frontend-domain-access';

/**
 * Every Dashboard widget contributed by a domain library (FR-001, SC-001).
 * Adding a domain's dashboard widget means adding one entry here — no other
 * change to `DashboardComponent`'s own template or class logic
 * (contracts/dashboard-settings-extension-points.md, research.md #1).
 */
export const DASHBOARD_WIDGET_CONTRIBUTIONS: DashboardWidgetContribution[] = [
  {
    domainId: 'holdings',
    titleKey: 'dashboard.allocation',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsDistributionComponent),
  },
];
