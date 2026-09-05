import { Injectable, signal } from '@angular/core';
import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '@vaultfolio/api-contract';
import type { LanguageCode } from '@vaultfolio/api-contract';

const STORAGE_KEY = 'vaultfolio-language';

/**
 * Resolves and holds the visitor's display-language preference (per-device,
 * not account-bound — spec Assumptions, FR-004). Mirrors `ThemeService`'s
 * shape (research.md #1): a signal, resolved synchronously at construction
 * from `localStorage` (else the catalog default) to avoid a flash of the
 * wrong language, with a `setLanguage()` method that updates the signal and
 * best-effort persists the explicit choice.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _language = signal<LanguageCode>(this.resolveInitialLanguage());
  readonly language = this._language.asReadonly();

  /** Switches the active language immediately (FR-003) and persists the choice (FR-004). */
  setLanguage(code: LanguageCode): void {
    if (!isSupportedLanguageCode(code)) {
      return;
    }
    this._language.set(code);
    this.writeStoredLanguage(code);
  }

  private resolveInitialLanguage(): LanguageCode {
    const stored = this.readStoredLanguage();
    return stored ?? DEFAULT_LANGUAGE_CODE;
  }

  private readStoredLanguage(): LanguageCode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      // A stored-but-no-longer-supported code (e.g. a removed language)
      // falls back to the catalog default, same treatment as "no explicit
      // choice" (mirrors ThemeService's invalid-value handling).
      return isSupportedLanguageCode(value) ? value : null;
    } catch {
      return null;
    }
  }

  private writeStoredLanguage(code: LanguageCode): void {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Best-effort: a blocked/throwing storage API only affects
      // persistence across reloads, not the current in-memory language.
    }
  }
}
