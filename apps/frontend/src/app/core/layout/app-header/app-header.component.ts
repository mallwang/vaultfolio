import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import {
  IconComponent,
  ThemeService,
  I18nService,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';
import { SUPPORTED_LANGUAGES } from '@vaultfolio/api-contract';
import type { LanguageCode } from '@vaultfolio/api-contract';
import { filter, map, startWith } from 'rxjs';
import { APPLICATION_AREAS } from '../application-areas';
import { AuthService } from '../../../auth/auth.service';
import { CurrentUserStore } from '../../../auth/current-user.store';

/**
 * design.md's "Header language switcher" — CSS class per language, not part
 * of the shared catalog (display-only concern). Matches the flag-icons
 * naming convention (`fi-<ISO code>`); the actual SVGs are inlined as data
 * URIs in app-header.component.css (see the comment there for why). Flag
 * *emoji* were tried first, but most Linux/Windows browsers have no
 * color-flag font glyphs and fall back to showing the raw two-letter region
 * code (e.g. "GB"), so we render actual SVG flags instead.
 */
const LANGUAGE_FLAGS: Record<LanguageCode, string> = { en: 'fi-gb', de: 'fi-de' };

interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
}

/**
 * Shows a small "Vaultfolio" eyebrow/crumb plus the active area's title, with
 * the signed-in user's name and a sign-out action on the right
 * (design.md "Header").
 */
@Component({
  selector: 'app-header',
  imports: [ButtonModule, FormsModule, SelectModule, TooltipModule, TranslatePipe, IconComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserStore);
  // Eagerly injected (research.md #3): this component is always rendered at
  // the app root, so constructing ThemeService here resolves/applies the
  // initial theme before any routed page content paints.
  private readonly themeService = inject(ThemeService);
  protected readonly theme = this.themeService.theme;
  private readonly i18nService = inject(I18nService);
  protected readonly language = this.i18nService.language;
  protected readonly languageOptions: LanguageOption[] = SUPPORTED_LANGUAGES.map((language) => ({
    code: language.code,
    label: language.label,
    flag: LANGUAGE_FLAGS[language.code] ?? '',
  }));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Translation key for the active area's nav label, e.g. `nav.dashboard`; falls back to the brand key outside any known area. */
  protected readonly activeAreaTitleKey = computed(() => {
    const url = this.currentUrl();
    const area = APPLICATION_AREAS.find((candidate) => url.startsWith(`/app/${candidate.path}`));
    return area ? area.labelKey : 'header.brand';
  });

  protected readonly isAuthenticated = computed(
    () => this.currentUser.status() === 'authenticated',
  );

  /**
   * data-model.md "Auth Status": resolves to "signed out" (no user) unless
   * status is `authenticated`, so a stale `SessionUser` from a prior session
   * can never surface identity content while status is `unknown` or
   * `unauthenticated` (no flash of the wrong state).
   */
  protected readonly user = computed(() =>
    this.isAuthenticated() ? this.currentUser.current() : null,
  );

  /** FR-004 (008): reflects role next to the display name — `SessionUser.role` already exists. */
  protected readonly roleLabelKey = computed(() =>
    this.user()?.role === 'ADMIN' ? 'header.roleAdmin' : 'header.roleMember',
  );

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  /** FR-003/T010: switching re-renders every `translate`-piped string on screen immediately. */
  protected setLanguage(code: LanguageCode): void {
    this.i18nService.setLanguage(code);
  }

  protected signOut(): void {
    this.authService.signOut().subscribe({
      next: () => this.completeSignOut(),
      // Even if the request fails (e.g. session already expired), clear
      // local state and send the user to sign-in rather than leaving them
      // stuck on a page that thinks they're still authenticated.
      error: () => this.completeSignOut(),
    });
  }

  private completeSignOut(): void {
    this.currentUser.setUnauthenticated();
    this.router.navigateByUrl('/sign-in');
  }
}
