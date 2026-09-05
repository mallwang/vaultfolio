import type { Type } from '@angular/core';

/**
 * An optional additional Settings tab a domain library supplies (FR-002,
 * data-model.md "Settings Tab Contribution"), alongside the standard
 * Profile/Preferences tabs every signed-in user always has. Declared here
 * (`scope:shared`) as a shape only — see `DashboardWidgetContribution`'s
 * identical rationale (research.md #2).
 */
export interface SettingsTabContribution {
  /** Matches a `DomainDescriptor.id`. */
  domainId: string;
  /** Router path segment under `/app/settings`, e.g. `'holdings'`. */
  path: string;
  /** i18n translation key for the tab label, matching `DomainDescriptor.labelKey`'s existing convention. */
  labelKey: string;
  /** Dynamic import factory for the tab's content component. */
  loadComponent: () => Promise<Type<unknown>>;
}
