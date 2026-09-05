import type { Type } from '@angular/core';

/**
 * An optional piece of Dashboard content a domain library supplies
 * (FR-001, data-model.md "Dashboard Widget Contribution"). Declared here
 * (`scope:shared`) as a shape only — `loadComponent` is a dynamic import
 * factory, never an eagerly-imported component reference, so declaring this
 * interface does not give `domain-access` a dependency on any domain
 * library (FR-007, research.md #2).
 */
export interface DashboardWidgetContribution {
  /** Matches a `DomainDescriptor.id` (`DOMAIN_REGISTRY`) — the domain this widget belongs to. */
  domainId: string;
  /** i18n translation key for the widget's own `p-card` header, matching `SettingsTabContribution.labelKey`'s existing convention. */
  titleKey: string;
  /** Dynamic import factory, e.g. `() => import('@vaultfolio/frontend-domain-holdings').then(m => m.HoldingsDistributionComponent)`. Never imported eagerly (research.md #3). */
  loadComponent: () => Promise<Type<unknown>>;
}
