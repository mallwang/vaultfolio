import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { catchError, of, tap } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { authInterceptor } from './auth/auth.interceptor';
import { CurrentUserStore } from './auth/current-user.store';
import { VaultfolioTitleStrategy } from './core/title.strategy';

/**
 * Swaps Aura's default emerald primary palette for teal, and pins the
 * accent itself (not just the palette) to teal.700 — #0f766e, the exact
 * color of the app icon (vaultfolio-logo.png) — rather than Aura's usual
 * 500/400 shade, so buttons/links/focus rings match the icon precisely.
 */
const VaultfolioPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{teal.50}',
      100: '{teal.100}',
      200: '{teal.200}',
      300: '{teal.300}',
      400: '{teal.400}',
      500: '{teal.500}',
      600: '{teal.600}',
      700: '{teal.700}',
      800: '{teal.800}',
      900: '{teal.900}',
      950: '{teal.950}',
      color: '{teal.700}',
      hoverColor: '{teal.800}',
      activeColor: '{teal.900}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: VaultfolioTitleStrategy },
    // `domainGuard`/`isDomainEntitled` (`@vaultfolio/frontend-domain-access`,
    // `scope:shared`) may not import `CurrentUserStore` directly (it lives
    // in `scope:frontend`, contracts/module-boundaries.md) — this binding is
    // the one place that wires the concrete store to the shared token.
    { provide: CURRENT_USER_SOURCE, useExisting: CurrentUserStore },
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
      theme: { preset: VaultfolioPreset, options: { darkModeSelector: '.app-dark' } },
      // Prefer the runtime value written by docker/frontend-entrypoint.sh
      // (from PRIMENG_LICENSE_KEY) over the build-time environment.ts value,
      // so a deployed image can be licensed via a container env var without
      // rebuilding. Falls back to environment.ts for `nx serve`/tests, where
      // env.js (see index.html) isn't present.
      license: window.__env?.primengLicenseKey || environment.primengLicenseKey,
    }),
  ],
};
