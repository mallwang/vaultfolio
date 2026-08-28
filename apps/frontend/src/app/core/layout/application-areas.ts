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
  /** PrimeIcons class name, e.g. 'pi pi-home'. */
  icon: string;
}

export const APPLICATION_AREAS: ApplicationArea[] = [
  { id: 'dashboard', label: 'Dashboard', path: 'dashboard', icon: 'pi pi-home' },
  { id: 'holdings', label: 'Holdings', path: 'holdings', icon: 'pi pi-briefcase' },
  { id: 'imports', label: 'Imports', path: 'imports', icon: 'pi pi-upload' },
  { id: 'settings', label: 'Settings', path: 'settings', icon: 'pi pi-cog' },
];
