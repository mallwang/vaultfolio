import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    providePrimeNG({
      theme: { preset: Aura },
      // Prefer the runtime value written by docker/frontend-entrypoint.sh
      // (from PRIMENG_LICENSE_KEY) over the build-time environment.ts value,
      // so a deployed image can be licensed via a container env var without
      // rebuilding. Falls back to environment.ts for `nx serve`/tests, where
      // env.js (see index.html) isn't present.
      license: window.__env?.primengLicenseKey || environment.primengLicenseKey,
    }),
  ],
};
