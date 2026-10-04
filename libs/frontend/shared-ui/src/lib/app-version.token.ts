import { InjectionToken } from '@angular/core';

/**
 * The running app's release version (e.g. `0.0.13`), shown next to the logo in
 * the header and on the Admin "General" tab. Empty by default; the app-shell
 * binds the real value from `apps/frontend/package.json` (kept in sync by Nx
 * Release) in `app.config.ts`, so this library never depends on `apps/frontend`.
 */
export const APP_VERSION = new InjectionToken<string>('APP_VERSION', {
  providedIn: 'root',
  factory: () => '',
});
