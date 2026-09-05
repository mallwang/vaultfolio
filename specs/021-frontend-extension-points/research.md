# Research: Frontend Shell Extension Points

**Feature**: 021-frontend-extension-points | **Date**: 2026-09-05

All items below resolve unknowns from the spec and Technical Context. No item is left as NEEDS
CLARIFICATION.

## 1. Where do the dashboard-widget / settings-tab contribution lists live?

- **Decision**: Two plain, code-defined arrays in `apps/frontend` — mirroring the existing
  `DOMAIN_REGISTRY` (`libs/frontend/domain-access`) and `APPLICATION_AREAS`
  (`apps/frontend/src/app/core/layout/application-areas.ts`) convention:
  - `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` → `DASHBOARD_WIDGET_CONTRIBUTIONS`
  - `apps/frontend/src/app/settings/settings-tabs.registry.ts` → `SETTINGS_TAB_CONTRIBUTIONS`

  Each entry holds only a `domainId` plus a lazy `loadComponent` factory (and, for settings tabs, a
  router `path` + `labelKey`) — never an eagerly-imported component. This is the "one well-known
  registration point" SC-001 requires: adding a domain's contribution means adding one array entry
  in `apps/frontend` that imports the domain's already-published public entry point (the same thing
  `app.routes.ts` already does for the Holdings route today), plus the domain library's own code —
  nothing else changes.

- **Rationale**: FR-007 forbids `domain-access` (`scope:shared`) from depending on any individual
  domain library. Since rendering a widget/tab ultimately requires an eager or dynamic `import()` of
  that domain's component, that import must live somewhere already allowed to depend on
  `scope:frontend-domain` libraries — which is `scope:frontend` (`apps/frontend`) today, per the
  existing `depConstraints` (contracts/module-boundaries.md, 020). Putting the registries in
  `apps/frontend` keeps `domain-access` domain-agnostic while still giving the mechanism exactly one
  file per shell area to edit per new contribution.
- **Alternatives considered**:
  - Put the registries (with live component references) inside `domain-access` itself — rejected:
    would force `domain-access` to depend on every domain library that ever contributes a widget or
    tab, directly violating FR-007 and reintroducing the coupling 020 already removed from routing.
  - Angular DI multi-provider tokens (`provide: DASHBOARD_WIDGETS, multi: true`) registered from each
    domain library's own providers — rejected as premature ceremony (Principle V, YAGNI): a plain
    array read directly by `DashboardComponent`/`SettingsComponent` does the same job with the same
    file-touch cost as the existing `DOMAIN_REGISTRY`/`APPLICATION_AREAS` pattern, without adding a
    second registration mechanism (DI + array) to a codebase that already has one.

## 2. Where do the contribution _type_ definitions live?

- **Decision**: `DashboardWidgetContribution` and `SettingsTabContribution` interfaces live in
  `libs/frontend/domain-access` (`scope:shared`), alongside the existing `DomainDescriptor`. They
  hold no component references — only a `domainId: string` and a `loadComponent: () =>
Promise<Type<unknown>>` factory type (plus `path`/`labelKey` for settings tabs) — so declaring
  them here does not give `domain-access` a dependency on any domain library (FR-007 stays
  satisfied; only _shapes_, never values, are shared).
- **Rationale**: `isDomainEntitled`/`domainGuard` already live here and are exactly what both
  registries need to filter by (FR-004: "the same shared entitlements mechanism"). Declaring the
  contribution shapes next to that mechanism, rather than duplicating an interface definition in two
  places under `apps/frontend`, keeps one source of truth for "what a contribution looks like",
  consistent with `DomainDescriptor` already living here for the same reason.
- **Alternatives considered**: Define the interfaces locally in each `apps/frontend` registry file —
  rejected: two independently-drifting copies of "domainId + loadComponent" for no benefit, when a
  `scope:shared` library already exists as the natural single home.

## 3. How does the Dashboard render a dynamically-registered widget without an eager import?

- **Decision**: A small, generic `DynamicOutletComponent` in `libs/frontend/shared-ui`
  (`scope:shared`), wrapping Angular's `NgComponentOutlet`: given a `loader: () =>
Promise<Type<unknown>>` input, it awaits the loader once and renders the resolved component. Every
  Dashboard widget contribution renders through one `<app-dynamic-outlet [loader]="c.loadComponent"
/>` per entitled entry, `@for`-looped over `DASHBOARD_WIDGET_CONTRIBUTIONS` filtered by
  `isDomainEntitled`.
- **Rationale**: This is the exact mechanism `DashboardComponent` already uses today for
  `HoldingsDistributionComponent` (a dynamic `import()` inside a `@defer` block, chosen specifically
  so the eagerly-loaded initial bundle doesn't pull in the whole `@vaultfolio/frontend-domain-holdings`
  package — see the class doc comment in `dashboard.component.ts`). Generalizing that one-off pattern
  into a reusable host component means the Dashboard's own code doesn't grow per domain (FR-003,
  SC-001) and every future widget gets the same code-splitting behavior for free. Living in
  `shared-ui` (already `scope:shared`, already the home for other generic presentation primitives
  like `IconComponent`/`EchartComponent`) needs no new library.
- **Alternatives considered**:
  - Keep using an inline `@defer` block per widget directly in `dashboard.component.html` — rejected:
    that requires `DashboardComponent`'s own template to grow one `@defer` block per domain,
    violating FR-003 ("no change to the Dashboard's own feature logic" to add a domain).
  - A full Angular structural directive instead of a component — rejected as unnecessary indirection
    for a one-shot "load and render" job; a component input/output surface is simpler here.

## 4. How does a settings-tab contribution get its own deep-linkable, entitlement-guarded address?

- **Decision**: Reuse the existing Profile/Preferences child-route pattern exactly.
  `SETTINGS_TAB_CONTRIBUTIONS` entries are spread into the `settings` route's `children` array in
  `app.routes.ts`, each with `canActivate: [domainGuard(entry.domainId)]` — the same guard factory
  already used for the top-level Holdings route (020). `SettingsComponent`'s tab list becomes the
  fixed Profile/Preferences tabs plus `SETTINGS_TAB_CONTRIBUTIONS` filtered by `isDomainEntitled`,
  computed the same way `AppSidebarComponent` already filters `APPLICATION_AREAS`.
- **Rationale**: FR-002's "own settings tab" and Acceptance Scenario 4 ("denied the same way an
  unentitled user is denied a domain's main route") are both satisfied by literally reusing the
  guard already proven for exactly that purpose (FR-004: "the same shared entitlements mechanism"),
  rather than inventing a second access-control path for settings tabs specifically.
- **Alternatives considered**: Guard only at the tab-selection UI level (hide the tab, no route
  guard) — rejected: fails Acceptance Scenario 4 (direct URL visit must be denied, not just hidden).

## 5. How does Imports move into Holdings without breaking deep links or the domain guard?

- **Decision**: A new `HoldingsAreaComponent` (in `libs/frontend/domain/holdings`) becomes the
  `/app/holdings` route's target, using the same `p-tabs` + child-`router-outlet` container pattern
  `SettingsComponent`/`AdminComponent` already establish. Its children: `{ path: '', pathMatch:
'full', redirectTo: 'list' }`, `{ path: 'list', ... HoldingsComponent }` (existing list/distribution
  page, unchanged), `{ path: 'imports', ... }` (the existing `ImportsComponent`, moved into the
  holdings library unchanged). `domainGuard('holdings')` stays on the parent `holdings` route only —
  both children inherit it automatically, the same way `adminGuard` already covers every Admin
  sub-route today. `/imports` and `/app/imports` become `redirectTo: 'app/holdings/imports'` /
  `redirectTo: 'holdings/imports'` respectively (FR-010).
- **Rationale**: Reusing an already-proven container pattern (rather than inventing a new one for
  Holdings specifically) keeps this User Story's risk low, as the spec's "Why this priority" notes.
  Naming the list tab's segment `list` (rather than leaving it path `''`) keeps both children
  explicitly named, consistent with how Settings/Admin name every one of their tabs (`profile`,
  `preferences`, `accounts`, …) rather than mixing a nameless default with named siblings.
- **Alternatives considered**: Keep `/app/holdings` itself as the list's own address with `imports`
  as a sibling (no shared parent route) — rejected: PrimeNG's tab-plus-outlet pattern needs one
  parent component hosting the `<p-tabs>` shell, and a shared parent is also what makes
  `domainGuard('holdings')` cover both tabs from a single declaration (FR-011).

## 6. How does Admin become its own module without being mistaken for a product domain?

- **Decision**: `apps/frontend/src/app/admin/**` moves, file-for-file, into a new Nx library
  `libs/frontend/admin` (`@vaultfolio/frontend-admin`), tagged with a **new** tag,
  `scope:frontend-admin` — deliberately distinct from `scope:frontend-domain` — with its own
  `depConstraints` entry (`onlyDependOnLibsWithTags: ['scope:shared']`, no self-reference needed
  since Admin is a single library, not a family). `scope:frontend`'s allow-list gains
  `scope:frontend-admin` alongside its existing `scope:frontend-domain` entry. `adminGuard` (role-
  based) stays put in `apps/frontend/src/app/auth/admin.guard.ts` — it is app/auth-specific
  plumbing, not part of the domain-entitlement mechanism, and FR-013 requires it to keep using
  `role`, never `domainScopes`.
- **Rationale**: A distinct tag (not just a distinct folder) is what makes Admin's separation
  structurally enforced rather than a naming convention — consistent with how 020 made domain
  isolation a lint failure, not a code-review reminder. Using a tag other than
  `scope:frontend-domain` specifically prevents a future contributor from registering Admin in
  `DOMAIN_REGISTRY`, `DASHBOARD_WIDGET_CONTRIBUTIONS`, or `SETTINGS_TAB_CONTRIBUTIONS` and having it
  pass a boundary check meant for product domains (FR-013's "MUST NOT be changed to use the
  domain-entitlement mechanism" becomes something the lint config also nudges against, not just
  something documented).
- **Alternatives considered**:
  - Tag Admin `scope:frontend-domain` too (simplest `depConstraints` diff) — rejected: it would then
    be structurally indistinguishable from a product domain, exactly what FR-012/FR-013 and User
    Story 4 exist to avoid.
  - Leave Admin inside `apps/frontend` but in a more clearly-named folder — rejected: an Nx
    `depConstraints` boundary is only enforceable between projects, not folders (020's research.md #1
    reached the same conclusion for the domain-library extraction; the same reasoning applies here).

## 7. Contribution ordering when multiple domains contribute

- **Decision**: Display order equals registry-array order (declaration order in
  `dashboard-widgets.registry.ts` / `settings-tabs.registry.ts`), the same convention
  `DOMAIN_REGISTRY`/`APPLICATION_AREAS` already establish for nav ordering.
- **Rationale**: Satisfies the Edge Case ("both MUST appear... in a stable, predictable order")
  with no new concept — array order is already how this codebase orders every other registry-driven
  list, and it requires no per-entry priority/weight field (Principle V, YAGNI) until a real need for
  reordering independent of registration order arises.
- **Alternatives considered**: An explicit `order: number` field per contribution — rejected as
  unneeded until two real domains actually need an order other than declaration order.
