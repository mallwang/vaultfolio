# Contract: `ThemeService`

No external/network API is introduced by this feature (Principle II is not applicable — see
plan.md Constitution Check). This is the internal contract between `ThemeService` and the
component that consumes it (`AppHeaderComponent`, and any future component that needs theme
awareness), so the boundary is documented rather than skipped.

```ts
export type Theme = 'light' | 'dark';

export class ThemeService {
  /** Currently active theme; resolved at construction per data-model.md "Lifecycle". */
  readonly theme: Signal<Theme>;

  /** Flips the active theme, applies it, and persists the explicit choice. */
  toggle(): void;
}
```

## Behavioral guarantees

- `theme()` is synchronously correct immediately after `ThemeService` is constructed — no
  asynchronous resolution, no flash-of-wrong-theme window (research.md #3).
- Calling `toggle()`:
  1. Updates `theme()` to the other value.
  2. Reflects the new value on `document.documentElement` (adds/removes the `app-dark` class
     consumed by PrimeNG's `darkModeSelector`, research.md #1) before the next paint.
  3. Persists the new value to `localStorage['vaultfolio-theme']`.
  4. Never throws, even if `localStorage` is unavailable/blocked (writes are best-effort; a failed
     write only affects persistence across reloads, not the current in-memory `theme()` value or
     the visual change).
- `ThemeService` never reads from or writes to the network, the backend API, or `CurrentUserStore`.

## Consumer contract (`AppHeaderComponent`)

- Renders one icon-only toggle button, unconditionally (both authenticated and unauthenticated
  states), bound to `themeService.theme()` for its icon and `aria-*` attributes, calling
  `themeService.toggle()` on click.
- Authenticated state: button appears inside `app-header__meta`, immediately before the sign-out
  button.
- Unauthenticated state: button appears alone, in the equivalent right-hand header position.
