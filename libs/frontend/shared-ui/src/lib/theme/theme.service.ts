import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vaultfolio-theme';
const DARK_CLASS = 'app-dark';

/**
 * Resolves and holds the visitor's light/dark theme preference (per-browser,
 * not account-bound — spec Assumptions) and drives PrimeNG's dark-mode
 * selector class on `<html>` (research.md #1).
 *
 * Resolution order (data-model.md "Lifecycle"): explicit `localStorage`
 * choice, else `prefers-color-scheme`, else light. Resolved and applied
 * synchronously at construction to avoid a flash of the wrong theme
 * (research.md #3).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.resolveInitialTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.applyTheme(this._theme());
  }

  /** Flips the active theme, applies it, and persists the explicit choice. */
  toggle(): void {
    const next: Theme = this._theme() === 'dark' ? 'light' : 'dark';
    this._theme.set(next);
    this.applyTheme(next);
    this.writeStoredTheme(next);
  }

  private resolveInitialTheme(): Theme {
    const stored = this.readStoredTheme();
    if (stored) {
      return stored;
    }
    return this.prefersDark() ? 'dark' : 'light';
  }

  private readStoredTheme(): Theme | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  private writeStoredTheme(theme: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Best-effort: a blocked/throwing storage API only affects persistence
      // across reloads, not the current in-memory theme or visual change.
    }
  }

  private prefersDark(): boolean {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      // Environments without matchMedia (some test runners, older browsers)
      // fall through to the light default, same as an unmatched query.
      return false;
    }
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle(DARK_CLASS, theme === 'dark');
  }
}
