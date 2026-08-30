import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { catchError, of, tap } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { authInterceptor } from './auth/auth.interceptor';
import { CurrentUserStore } from './auth/current-user.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    // research.md #2: resolve Auth Status once at bootstrap so the header
    // and shell never have to guess signed-in/signed-out before the
    // session check completes (data-model.md "Auth Status").
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      const currentUser = inject(CurrentUserStore);
      return authService.getSession().pipe(
        tap((user) => currentUser.setAuthenticated(user)),
        catchError(() => {
          currentUser.setUnauthenticated();
          return of(null);
        }),
      );
    }),
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
