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
  /** Router path segment, e.g. 'dashboard' → /dashboard. */
  path: string;
  /** `vf-icon` semantic name (see `shared/icon/icon-name.map.ts`), e.g. 'home'. */
  icon: string;
  /**
   * When present, the area is rendered only for a current user whose role is
   * included here; absent means visible to every authenticated role
   * (data-model.md "ApplicationArea").
   */
  roles?: UserRole[];
}

export const APPLICATION_AREAS: ApplicationArea[] = [
  { id: 'dashboard', label: 'Dashboard', path: 'dashboard', icon: 'home' },
  { id: 'holdings', label: 'Holdings', path: 'holdings', icon: 'briefcase' },
  { id: 'imports', label: 'Imports', path: 'imports', icon: 'upload' },
  { id: 'settings', label: 'Settings', path: 'settings', icon: 'cog' },
  { id: 'admin', label: 'Admin', path: 'admin', icon: 'shield', roles: ['ADMIN'] },
];
