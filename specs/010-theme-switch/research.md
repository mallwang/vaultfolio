# Research: Light/Dark Theme Switch

No `NEEDS CLARIFICATION` markers remain in the spec (clarified/finalized during `/speckit-specify`
and the design.md mockup review). This document records the technical decisions needed to
implement the approved design.

## 1. How to drive PrimeNG's dark mode from application state

- **Decision**: Configure `providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector:
'.app-dark' } } })` in `app.config.ts`, and have `ThemeService` add/remove the `app-dark` class on
  `document.documentElement` whenever the resolved theme changes.
- **Rationale**: PrimeNG v22's Aura preset (already wired in this app) ships CSS custom-property
  overrides scoped under a configurable dark-mode selector. Its default (`darkModeSelector:
'system'`) reacts only to the OS-level `prefers-color-scheme` media query and cannot be
  overridden by an explicit in-app user choice, which conflicts with FR-005 (persist an explicit
  choice that may differ from the OS setting). Pointing `darkModeSelector` at an app-controlled
  class (`.app-dark` on `<html>`) makes the toggle authoritative: the app decides when the class is
  present, using the OS preference only as the _initial_ default per FR-007.
- **Alternatives considered**:
  - Leaving `darkModeSelector: 'system'` and only ever following the OS setting — rejected, doesn't
    satisfy FR-005 (an explicit user choice must persist and win over the OS setting).
  - A third-party Angular theming library — rejected as an unjustified dependency (Principle V);
    PrimeNG already ships everything needed.

## 2. Where the toggle state lives

- **Decision**: A single injectable `ThemeService` (`providedIn: 'root'`) holding a
  `theme = signal<'light' | 'dark'>(...)`, computed at construction from: (1) `localStorage`
  key `vaultfolio-theme` if present and valid, else (2)
  `window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`, else (3)
  `'light'`. An `effect()` (or a subscription in the constructor) synchronizes `document
.documentElement.classList` and writes explicit choices back to `localStorage` whenever `toggle()`
  is called.
- **Rationale**: Matches the existing lightweight-singleton-service pattern already used for
  cross-cutting client state in this app (e.g. `CurrentUserStore` in `auth/`), avoiding a new state
  management dependency (Principle V, YAGNI). A signal-based service is trivial to inject into
  `AppHeaderComponent` for the icon/`aria-*` binding and needs no routing or backend awareness,
  matching FR-006 (applies consistently everywhere) since the header is the one always-rendered
  root component (`app.html`).
- **Alternatives considered**:
  - Storing theme in `CurrentUserStore` — rejected: theme is explicitly not account-bound (spec
    Assumptions: "not saved to a user's account"), and `CurrentUserStore` models auth/session
    state, a different concern.
  - A route resolver / `APP_INITIALIZER`-only approach — rejected: initial resolution still needs
    to happen before first paint (to avoid a flash of the wrong theme), but the _service_ itself
    doesn't need bootstrap wiring beyond being constructed early (it's referenced by the
    always-rendered header) — see Research #3 below for flash avoidance.

## 3. Avoiding a flash of the wrong theme on load

- **Decision**: `ThemeService` resolves and applies the initial theme class synchronously in its
  constructor (not inside an `effect()` alone, and not deferred to `ngOnInit`/`APP_INITIALIZER`),
  and is eagerly instantiated by injecting it directly in `AppHeaderComponent`'s constructor
  field initializer (`inject(ThemeService)`), since `AppHeaderComponent` is rendered
  unconditionally at the root (`app.html`) before any routed page content.
- **Rationale**: SC-001 requires the switch to feel instant; the same synchronous-class-toggle
  approach naturally avoids a flash on reload, since the class is applied during Angular's initial
  change detection pass, before the router outlet renders routed content. No SSR is in play here
  (this is a client-rendered Angular app per `main.ts`/`bootstrapApplication`), so there's no
  server-render mismatch to reconcile.
- **Alternatives considered**: An inline `<script>` in `index.html` that sets the class before
  Angular bootstraps at all (the common SSR-safe pattern) — considered but not adopted: this app
  has no SSR, and the residual flash window (Angular bootstrap is already fast, and PrimeNG's CSS
  variables apply per-element, not via a blocking initial paint) doesn't justify hand-maintained
  bootstrap-time JS outside the Angular app; can be revisited if a visible flash is observed during
  implementation/testing.

## 4. Icon-only toggle button implementation

- **Decision**: A `p-button` with `[icon]` bound to `theme() === 'dark' ? 'pi pi-moon' :
'pi pi-sun'`, `text` and `rounded` (or `severity="secondary" text`) to match the existing
  sign-out button's ghost styling, `[attr.aria-pressed]="theme() === 'dark'"`, and
  `[attr.aria-label]` bound to `` `Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme` ``,
  placed immediately before the sign-out button inside `app-header__meta`, and also rendered
  outside/independent of the `@if (isAuthenticated())` block so unauthenticated visitors see it in
  the equivalent position (FR-003).
- **Rationale**: Directly implements the approved design.md layout and FR-008/FR-009 using
  existing dependencies (`ButtonModule`, PrimeIcons `pi-sun`/`pi-moon`, already available via
  `primeicons.css` import in `styles.css`) — no new icon set needed.
- **Alternatives considered**: A custom SVG toggle switch component — rejected, inconsistent with
  the rest of the header (which is built entirely from PrimeNG components) and an unjustified
  extra abstraction (Principle V).
