# Phase 1 Data Model: Vaultfolio Branding

This feature introduces no persisted data, database entities, or API DTOs. The "entities" below
(carried over from spec.md's Key Entities) are static, compile-time/config-shaped structures that
live entirely in the frontend source tree — documented here for completeness, not as a schema.

## Route Page Title

Not a runtime object — a static property on each `Route` in `app.routes.ts`.

| Field   | Type     | Notes                                                                                                                                                                                                                                                                                                      |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` | `string` | Angular Router's built-in `Route.title` property. Short, human-readable (e.g. `'Dashboard'`, `'Sign In'`, `'Not Found'`). Optional per Angular's typing, but every route in this feature's scope sets it (FR-001); a route that omits it falls through to the `VaultfolioTitleStrategy` fallback (FR-002). |

**Validation rule**: no enforced runtime validation (it's a route config literal); the
completeness check is FR-001's success criterion (SC-001: 100% of routes produce a
"Vaultfolio"-prefixed title) plus manual/automated route-table inspection during review.

## Brand Asset (Logo)

A single static image file, not a database entity.

| Field     | Value                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source    | `apps/frontend/public/vaultfolio-logo.png`                                                                                                                                                                |
| Consumers | `index.html` (`apple-touch-icon` link), `favicon.ico` (regenerated from the same art), `app-header.component.html` (`<img class="app-header__logo">`), root `README.md` (via a repo-root copy `logo.png`) |

**Validation rule**: none at the type level; verified visually (User Story 2's acceptance
scenarios) — same file referenced everywhere, no orphaned/duplicate art per surface.

## Brand Accent Color

A PrimeNG theme preset object, not a runtime data model — see `research.md` §2 for the mechanism.

| Field                          | Value                                                          |
| ------------------------------ | -------------------------------------------------------------- |
| `semantic.primary.50`–`900`    | Mapped 1:1 to PrimeNG's `{teal.50}`–`{teal.900}` design tokens |
| `semantic.primary.color`       | Pinned to `{teal.700}` (`#0f766e`, the logo's icon color)      |
| `semantic.primary.hoverColor`  | Pinned to `{teal.800}`                                         |
| `semantic.primary.activeColor` | Pinned to `{teal.900}`                                         |

**Validation rule**: applies identically in both `darkModeSelector` (`.app-dark`) and default
(light) mode, since PrimeNG's semantic tokens are theme-mode-aware by construction — no separate
light/dark preset is defined (Edge Cases: "consistent across both light and dark theme modes").

## State Transitions

None — all of the above are static configuration, resolved once at build/bootstrap time (route
table, theme preset) or on each navigation (title string), with no stored state or lifecycle to
model.
