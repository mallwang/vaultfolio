# Research: PrimeNG UI Foundation & Application Structure

**Feature**: [spec.md](./spec.md) | **Design**: [design.md](./design.md)

All Technical Context items were resolvable from the constitution's Stack Decision, the
approved design.md mockup, and the PrimeNG MCP docs (library v22.1.0). No open
`NEEDS CLARIFICATION` markers remain.

## 1. UI component library & version

- **Decision**: `primeng@22.1.0` + `@primeuix/themes` (the current PrimeNG release per the
  PrimeNG MCP server), installed only in `apps/frontend`.
- **Rationale**: Confirmed by the user and the spec's Assumptions; matches the Angular frontend
  mandated by the constitution's Stack Decision. Per-component imports (`primeng/button`,
  `primeng/menu`, etc.) keep bundles lean, satisfying Principle V (simplicity/YAGNI) — only the
  components the shell and placeholder areas actually use are imported.
- **Alternatives considered**: Angular Material (rejected — the spec/Assumptions already name
  PrimeNG as confirmed); a custom component set (rejected — reinvents what FR-001 explicitly asks
  to avoid).

## 2. Theme configuration

- **Decision**: Configure PrimeNG via `providePrimeNG({ theme: { preset: Aura } })` in
  `app.config.ts`, using the built-in **Aura** preset as the single default light theme (FR-002).
  This matches the preset design.md's mockup already approximates, so the implemented theme won't
  visually diverge from the reviewed layout.
- **Rationale**: Aura is PrimeNG's default, well-tested preset with accessible contrast out of the
  box (supports FR-010's baseline contrast expectation) and needs no custom design-token work for
  this feature — dark/branded theming is explicitly out of scope (spec Assumptions).
- **Alternatives considered**: A custom preset/token override (rejected — YAGNI for a first pass;
  no brand tokens are defined yet); Lara/Material presets (rejected — Aura is what design.md
  visually approximates, keeping the mockup and implementation consistent).

## 3. Icons

- **Decision**: Use PrimeIcons (`primeicons` package, PrimeNG's default icon library) for nav and
  UI icons rather than hand-rolled inline SVGs.
- **Rationale**: design.md's mockup uses inline SVGs only because it predates the real
  dependency; PrimeIcons is the standard, zero-extra-config icon set PrimeNG components expect
  (e.g., `MenuItem.icon`), and keeps icon styling consistent with FR-001.
- **Alternatives considered**: Keep hand-drawn inline SVGs (rejected — duplicates work PrimeIcons
  already provides and risks visual drift from FR-001's "one visual language").

## 4. Navigation shell composition

- **Decision**: Build the shell as a small set of standalone Angular components
  (`app-shell`/`app-sidebar`/`app-header`) composed from PrimeNG primitives — a `PanelMenu` or
  plain `router-link` list for the sidebar's desktop nav, and a horizontally scrollable variant of
  the same item list for the mobile top bar (per design.md's responsive behavior) — rather than
  PrimeNG's heavier `Sidebar`/drawer overlay component, since the design calls for an
  always-visible (not overlay) nav.
- **Rationale**: Matches the two-region layout already approved in design.md; avoids adding an
  overlay/drawer interaction model the mockup doesn't call for (YAGNI, Principle V).
- **Alternatives considered**: PrimeNG `Drawer`/`Sidebar` overlay (rejected for the default
  desktop/tablet case — design.md shows a persistent, non-overlay sidebar; may be revisited later
  for a hamburger-triggered overlay on very narrow widths if needed, but the mockup's scrollable
  top bar already satisfies FR-009 without it); Angular Material-style `CdkLayout` (rejected — no
  need for a second layout primitive library alongside PrimeNG).

## 5. Routing

- **Decision**: Angular Router (`provideRouter`), with one route per top-level Application Area
  (`/dashboard`, `/holdings`, `/imports`, `/settings`), a redirect from `/` to `/dashboard`, and a
  wildcard (`**`) route to a `NotFoundComponent` — all rendered inside the persistent shell
  (FR-004, FR-006).
- **Rationale**: Angular's built-in router is the standard, zero-extra-dependency way to satisfy
  client-side routing (FR-004) and directly supports `routerLink`/`routerLinkActive` for the
  sidebar's active-area indicator (design.md).
- **Alternatives considered**: A hand-rolled view-switcher (rejected — reinvents routing,
  conflicts with Principle V; loses deep-linking/back-button support the spec's scenarios imply).

## 6. Application structure & conventions

- **Decision**: Introduce a `core/layout/` area inside `apps/frontend/src/app/` for the shell
  (shell, sidebar, header, not-found) and one folder per top-level Application Area under
  `apps/frontend/src/app/` (`dashboard/`, `holdings/`, `imports/`, `settings/`), each a standalone
  component wired into the router. `health-status/` moves under `settings/` (or is embedded in the
  Settings component) per FR-007. Document the convention in `apps/frontend/README.md` (FR-008).
  No new Nx libs are introduced — this is presentation-only scaffolding, not shared domain logic
  (Principle I doesn't apply to placeholder UI shells).
- **Rationale**: Keeps the pattern discoverable within the existing `apps/frontend` Nx project
  without inventing a new libs boundary before there's shared logic to justify one (Principle V);
  gives SC-003's "developer adds a new area in <30 minutes" a literal folder-per-area template to
  copy.
- **Alternatives considered**: A separate `libs/frontend/layout` Nx library (rejected for now —
  YAGNI; nothing here is consumed outside `apps/frontend` yet, and Principle I's library-first
  rule targets domain logic, not UI shell scaffolding. Can be extracted later if a second Angular
  app ever needs the shell).

## 7. Accessibility & responsive baseline

- **Decision**: Rely on PrimeNG/Aura's built-in keyboard navigability and contrast (FR-010) plus
  plain CSS (flexbox, media queries — no separate grid/utility framework) for the
  sidebar↔top-bar responsive collapse (FR-009), matching design.md's plain-CSS mockup.
- **Rationale**: PrimeNG components are accessible by default when used as documented; adding a
  utility CSS framework (e.g., PrimeFlex) alongside plain CSS the mockup already uses would be an
  unjustified second styling system (Principle V).
- **Alternatives considered**: PrimeFlex utility classes (rejected — redundant with plain CSS for
  this feature's modest layout needs; can be reconsidered if layout complexity grows).
