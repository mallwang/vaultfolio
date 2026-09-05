import type { UserRole } from '@vaultfolio/api-contract';

/**
 * Single source of truth for the app's top-level Application Areas — the
 * navigation shell (sidebar + mobile top bar) and the route table both read
 * from this list, so an area is never registered in one without the other
 * (data-model.md "Application Area", contracts/application-areas.md).
 */
export interface ApplicationArea {
  /** Stable key, e.g. 'dashboard'. */
  id: string;
  /** Nav entry text, e.g. 'Dashboard'. */
  label: string;
  /**
   * i18n translation key for the nav label, e.g. `'nav.accountOverview'`
   * (matches `DomainDescriptor.labelKey`'s convention). Needed because
   * `area.id` is kebab-case but the `nav.*` translation keys are
   * camelCase, so the sidebar can't derive one from the other.
   */
  labelKey: string;
  /** Router path segment, e.g. 'dashboard' → /dashboard. */
  path: string;
  /** `vf-icon` semantic name (see `@vaultfolio/frontend-shared-ui`'s `icon-name.map.ts`), e.g. 'home'. */
  icon: string;
  /**
   * When present, the area is rendered only for a current user whose role is
   * included here; absent means visible to every authenticated role
   * (data-model.md "ApplicationArea").
   */
  roles?: UserRole[];
  /**
   * When present, points at a `DomainDescriptor.id`
   * (`@vaultfolio/frontend-domain-access`) — the area is rendered only when
   * `isDomainEntitled` says the current user has access to that domain
   * (020, FR-006), the same way `roles` already gates role-restricted areas.
   */
  domainId?: string;
}

export const APPLICATION_AREAS: ApplicationArea[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    labelKey: 'nav.dashboard',
    path: 'dashboard',
    icon: 'home',
  },
  {
    id: 'holdings',
    label: 'Holdings',
    labelKey: 'nav.holdings',
    path: 'holdings',
    icon: 'briefcase',
    domainId: 'holdings',
  },
  // The five placeholder domains (022-add-domain-placeholders, FR-001/FR-004),
  // inserted after Holdings and before Settings per research.md #3.
  {
    id: 'retirement',
    label: 'Retirement',
    labelKey: 'nav.retirement',
    path: 'retirement',
    icon: 'elderly',
    domainId: 'retirement',
  },
  {
    id: 'insurances',
    label: 'Insurances',
    labelKey: 'nav.insurances',
    path: 'insurances',
    icon: 'shield',
    domainId: 'insurances',
  },
  {
    id: 'haushaltsplaner',
    label: 'Haushaltsplaner',
    labelKey: 'nav.haushaltsplaner',
    path: 'haushaltsplaner',
    icon: 'receipt-long',
    domainId: 'haushaltsplaner',
  },
  {
    id: 'historic-wealth-development',
    label: 'Historic Wealth Development',
    labelKey: 'nav.historicWealthDevelopment',
    path: 'historic-wealth-development',
    icon: 'trending-up',
    domainId: 'historic-wealth-development',
  },
  {
    id: 'account-overview',
    label: 'Account Overview',
    labelKey: 'nav.accountOverview',
    path: 'account-overview',
    icon: 'account-balance',
    domainId: 'account-overview',
  },
  { id: 'settings', label: 'Settings', labelKey: 'nav.settings', path: 'settings', icon: 'cog' },
  {
    id: 'admin',
    label: 'Admin',
    labelKey: 'nav.admin',
    path: 'admin',
    icon: 'manage-accounts',
    roles: ['ADMIN'],
  },
];
