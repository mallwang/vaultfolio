/**
 * A frontend product domain (data-model.md "Domain (registry entry)").
 * Static, code-defined — one entry per domain library that exists in the
 * codebase; not persisted anywhere.
 */
export interface DomainDescriptor {
  /** Stable key, e.g. `'holdings'`. Matches a `SessionUser.domainScopes` entry. */
  id: string;
  /** i18n translation key for the nav label, e.g. `'nav.holdings'`. */
  labelKey: string;
  /** Router path segment under `/app`, e.g. `'holdings'`. */
  path: string;
  /** `vf-icon` semantic name, matching `ApplicationArea.icon`'s existing convention. */
  icon: string;
}

/**
 * Every domain library registered in the codebase (FR-004, SC-004). Adding a
 * new domain means adding one entry here — no other file needs to know the
 * full set of domains.
 */
export const DOMAIN_REGISTRY: DomainDescriptor[] = [
  { id: 'holdings', labelKey: 'nav.holdings', path: 'holdings', icon: 'briefcase' },
  { id: 'retirement', labelKey: 'nav.retirement', path: 'retirement', icon: 'elderly' },
  { id: 'insurances', labelKey: 'nav.insurances', path: 'insurances', icon: 'shield' },
  {
    id: 'haushaltsplaner',
    labelKey: 'nav.haushaltsplaner',
    path: 'haushaltsplaner',
    icon: 'receipt-long',
  },
  {
    id: 'historic-wealth-development',
    labelKey: 'nav.historicWealthDevelopment',
    path: 'historic-wealth-development',
    icon: 'trending-up',
  },
  {
    id: 'account-overview',
    labelKey: 'nav.accountOverview',
    path: 'account-overview',
    icon: 'account-balance',
  },
];
