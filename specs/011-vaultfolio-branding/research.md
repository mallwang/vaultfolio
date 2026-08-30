# Phase 0 Research: Vaultfolio Branding

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this section documents the
decisions behind the choices already reflected in the working tree, for traceability.

## 1. Per-route browser tab titles

**Decision**: Add a static `title: string` to every route object in `app.routes.ts`, and provide
a custom `TitleStrategy` (`VaultfolioTitleStrategy`) that reads Angular Router's resolved title
via `TitleStrategy.buildTitle(snapshot)` and calls `Title.setTitle()` with a
`"Vaultfolio - <title>"` format, falling back to plain `"Vaultfolio"` when `buildTitle` returns
`undefined`.

**Rationale**: Angular Router has a first-class extension point for exactly this
(`TitleStrategy`), so no manual subscription to router events or `NavigationEnd` is needed — it's
called automatically on every successful navigation. Declaring `title` per route keeps the label
next to the route definition (discoverable, and enforced implicitly — a route without a `title`
is a visible gap in `app.routes.ts`) rather than in a separate lookup map that can drift out of
sync with the route list.

**Alternatives considered**:

- _Set `document.title` manually in each page component's `ngOnInit`_: rejected — duplicates the
  concern across every component, easy to forget on new pages, doesn't compose with route-level
  guards/resolvers the way `TitleStrategy` does.
- _A `Map<path, title>` consulted from a router-event subscription_: rejected — reinvents what
  `TitleStrategy` already provides, and detaches the title from the route definition it describes.

## 2. Brand accent color (teal, pinned to `teal.700`)

**Decision**: Use PrimeNG's `definePreset(Aura, { semantic: { primary: {...} } })` to override
just the `primary` semantic color group, mapping every shade (50–950) to the corresponding
`{teal.*}` PrimeNG design token, but pinning `color`/`hoverColor`/`activeColor` explicitly to
`teal.700`/`teal.800`/`teal.900` rather than Aura's default `500/400` shade selection — so the
base interactive color is an exact match to the logo's icon color (`#0f766e`, `teal.700`).

**Rationale**: `definePreset` is PrimeNG's documented, supported mechanism for palette
customization without forking the whole Aura theme; it keeps every component's existing
color-token usage (buttons, links, focus rings, etc.) working unchanged since they all reference
the `primary` semantic tokens, not literal color values. Pinning `color` separately from the
50–950 scale is necessary because Aura's own default picks 500 for light mode / 400 for dark mode
off the scale — using the scale alone would not guarantee the _exact_ icon color is what user
actually sees on a button.

**Alternatives considered**:

- _Hand-write a full custom color palette in CSS variables_: rejected — bypasses PrimeNG's theming
  system entirely, would require duplicating dark-mode variants and hover/active states that
  `definePreset` already generates from the scale.
- _Use PrimeNG's built-in `teal` preset primary color option (if configured only via
  `options.primaryColor` sugar) without pinning `color`_: considered, but Aura's default shade
  selection (500/400) does not equal `teal.700`; pinning was required to match the logo exactly,
  per FR-008.

## 3. Single logo asset reused across favicon / touch-icon / header / README

**Decision**: One raster asset, `apps/frontend/public/vaultfolio-logo.png`, is referenced from
four places: `index.html`'s `<link rel="apple-touch-icon">`, the app header's `<img>`, and
(copied to the repo root as `logo.png`) the root `README.md`. `favicon.ico` is regenerated from
the same source art rather than referencing the PNG directly, since `.ico` remains the most
broadly compatible favicon format across browsers/bookmarks.

**Rationale**: A single source asset avoids drift between brand surfaces (spec Assumption: "logo
asset already exists and its dominant/icon color is the intended source"). `.ico` for the
favicon specifically follows the pre-existing pattern already in `index.html`
(`rel="icon" type="image/x-icon" href="favicon.ico"`), so only the icon's _content_ changes, not
the delivery mechanism — minimizing risk of breaking cached favicon references.

**Alternatives considered**:

- _Generate a full multi-resolution favicon/icon set (16x16, 32x32, 192x192, 512x512, SVG,
  manifest icons, etc.)_: rejected for this iteration — out of scope per spec Assumptions
  ("does not require multiple resolutions beyond what a single logo asset provides"); can be a
  follow-up if PWA/manifest support is added later.

## 4. Removing the sidebar brand mark instead of keeping both

**Decision**: Delete the sidebar's `.app-brand` / `.app-brand__mark` / `.app-brand__name` markup
and CSS (including its collapsed/mobile-specific rules) entirely, rather than keeping it alongside
the new header brand mark.

**Rationale**: The app header is visible on every authenticated page regardless of viewport
(unlike the sidebar, which collapses to a bottom nav on narrow viewports), so it is the correct
single home for brand identity. Keeping both would duplicate the brand mark on wide viewports and
create visual noise without adding information (User Story 2, Acceptance Scenario 4).

**Alternatives considered**:

- _Keep the sidebar brand mark for wide viewports, hide it only on mobile (status quo before this
  change)_: rejected — this is literally the prior state that prompted the "consistent, not
  duplicated" requirement (FR-007).
