# Quickstart: Light/Dark Theme Switch

Validates the feature end-to-end once implemented, per spec.md's Acceptance Scenarios and Success
Criteria.

## Prerequisites

- Dependencies installed (`npm install` at the repo root — see `vaultfolio-uses-npm` project
  convention).
- Frontend served locally: `npm exec nx serve frontend`.

## Manual validation

1. **Unauthenticated visitor sees and can use the toggle** (US1, FR-003):
   - Open the app while signed out (e.g. `/sign-in`).
   - Confirm an icon-only sun/moon button is visible in the header's right-hand position (no
     sign-out button present).
   - Click it; confirm the page's colors switch immediately, with no page reload (check the
     browser's network/console — no navigation event).

2. **Authenticated visitor sees the toggle next to sign-out** (US1, FR-002):
   - Sign in, land on `/app/dashboard`.
   - Confirm the toggle appears in `app-header__meta`, immediately before the "Sign out" button.
   - Click it; confirm the same immediate, no-reload switch.

3. **Theme persists across reloads** (US2, FR-005):
   - Switch to dark theme, then reload the page (or open a new tab to the app).
   - Confirm dark theme is still applied without re-clicking the toggle.
   - Clear `localStorage` (e.g. DevTools → Application → Local Storage → delete
     `vaultfolio-theme`) and reload; confirm the app falls back to the OS preference (or light, if
     no OS preference is set/detectable) without erroring.

4. **First-time default follows OS preference** (US2, FR-007):
   - With `localStorage` cleared, set the OS/browser to prefer dark
     (e.g. DevTools → Rendering → "Emulate CSS media feature prefers-color-scheme: dark").
   - Reload the app fresh; confirm it opens in dark theme with no prior explicit choice.

5. **Theme applies consistently everywhere** (US3, FR-006):
   - Switch to dark on a public page (e.g. `/sign-in`), then sign in and navigate to
     `/app/dashboard`, `/app/holdings`, `/app/settings`.
   - Confirm every page renders in dark theme.
   - Switch to light while signed in, sign out, confirm the public page is also light.

6. **Accessibility** (FR-008, SC-004):
   - Tab to the toggle using keyboard only; confirm it receives visible focus and activates via
     Enter/Space.
   - Inspect the button's `aria-pressed` and `aria-label` in DevTools; confirm both update after
     each toggle (e.g. `aria-label="Switch to light theme"` while dark is active).

## Automated tests (implementation phase)

- `apps/frontend/src/app/core/theme/theme.service.spec.ts`: covers the resolution order in
  data-model.md (explicit `localStorage` value → `prefers-color-scheme` → light default), the
  `toggle()` behavioral guarantees in contracts/theme-service.md, and the "storage blocked/throws"
  edge case.
- `apps/frontend/src/app/core/layout/app-header/app-header.component.spec.ts`: covers the toggle
  rendering in both authenticated and unauthenticated states, its position relative to the
  sign-out button, and its `aria-pressed`/`aria-label` bindings.

Run with: `npm exec nx test frontend`.
