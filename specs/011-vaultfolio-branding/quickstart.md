# Quickstart: Validating Vaultfolio Branding

## Prerequisites

- Node.js + npm installed (per repo convention — use `npm`/`npx` for this repo's Nx commands, not
  `pnpm`).
- Dependencies installed: `npm install` at the repo root.

## Run the frontend

```bash
npx nx serve frontend
```

Open the printed local URL (typically `http://localhost:4200`).

## Validate User Story 1 — per-route tab titles (SC-001, SC-002)

1. Navigate to `/sign-in` (or wherever unauthenticated users land) → confirm the browser tab reads
   **"Vaultfolio - Sign In"**.
2. Sign in, then click through Dashboard, Holdings, Imports, Settings in the sidebar/header nav →
   confirm the tab title updates to `"Vaultfolio - Dashboard"`, `"Vaultfolio - Holdings"`,
   `"Vaultfolio - Imports"`, `"Vaultfolio - Settings"` respectively, without a full page reload.
3. Navigate to an unknown path (e.g. `/does-not-exist`) → confirm the tab reads
   **"Vaultfolio - Not Found"**.
4. Automated check: `npx nx test frontend --testFile=title.strategy.spec.ts` (or run the full
   `npx nx test frontend`) — `title.strategy.spec.ts` already asserts both the prefixed and the
   bare-fallback behavior.

## Validate User Story 2 — logo across favicon, touch icon, header (SC-003)

1. With the app open in a browser tab, inspect the tab icon → confirm it is the Vaultfolio logo,
   not a generic/default icon.
2. Inspect `apps/frontend/src/index.html` → confirm an `apple-touch-icon` `<link>` points at
   `vaultfolio-logo.png`.
3. On any authenticated page, look at the app header → confirm the Vaultfolio logo renders next
   to the "Vaultfolio" wordmark and current page title.
4. Resize the viewport to a narrow/mobile width (sidebar collapses to a bottom nav) → confirm no
   separate brand mark/wordmark appears in the sidebar/bottom-nav area (`app-sidebar.component.html`
   should contain no `app-brand*` markup).

## Validate User Story 3 — brand accent color (SC-004)

1. On the sign-in page, inspect the primary "Sign In" button's color → confirm it matches the
   logo's teal (`#0f766e` / `teal.700`), not the previous default green.
2. Tab into a focusable form field → confirm the focus ring uses the same teal.
3. Toggle dark mode (existing header theme toggle) → repeat the above checks; the accent should
   still read as the same teal family, just theme-appropriate shading.
4. Hover/press the primary button → confirm the hover/active shades are visibly darker teal
   (`teal.800` / `teal.900`), not a different hue.

## Validate User Story 4 — branded README (SC-003)

1. Open `README.md` in a Markdown preview (or on the repository's web UI) → confirm the Vaultfolio
   logo renders centered, above the introductory description paragraph.

## Full regression check

```bash
npx nx test frontend
npx nx lint frontend
npx nx build frontend
```

All three should pass with no new failures attributable to this feature.
