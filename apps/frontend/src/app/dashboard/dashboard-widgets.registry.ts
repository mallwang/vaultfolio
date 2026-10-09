import type { DashboardWidgetContribution } from '@vaultfolio/frontend-domain-access';

/**
 * Every Dashboard widget contributed by a domain library (FR-001, SC-001).
 * Adding a domain's dashboard widget means adding one entry here — no other
 * change to `DashboardComponent`'s own template or class logic
 * (contracts/dashboard-settings-extension-points.md, research.md #1).
 */
export const DASHBOARD_WIDGET_CONTRIBUTIONS: DashboardWidgetContribution[] = [
  {
    id: 'holdings-distribution',
    domainId: 'holdings',
    titleKey: 'dashboard.allocation',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsDistributionComponent),
  },
  {
    id: 'earnings',
    domainId: 'earnings',
    titleKey: 'dashboard.earnings',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-earnings').then(
        (m) => m.EarningsDashboardWidgetComponent,
      ),
  },
  {
    id: 'retirement',
    domainId: 'retirement',
    titleKey: 'dashboard.retirement',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-retirement').then(
        (m) => m.RetirementDashboardWidgetComponent,
      ),
  },
  {
    id: 'insurances',
    domainId: 'insurances',
    titleKey: 'dashboard.insurances',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-insurances').then(
        (m) => m.InsurancesDashboardWidgetComponent,
      ),
  },
  {
    id: 'historic-wealth-development',
    domainId: 'historic-wealth-development',
    titleKey: 'dashboard.wealth',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-historic-wealth-development').then(
        (m) => m.WealthDashboardWidgetComponent,
      ),
  },
  {
    id: 'account-overview',
    domainId: 'account-overview',
    titleKey: 'dashboard.accounts',
    loadComponent: () =>
      import('@vaultfolio/frontend-domain-account-overview').then(
        (m) => m.AccountOverviewDashboardWidgetComponent,
      ),
  },
];
