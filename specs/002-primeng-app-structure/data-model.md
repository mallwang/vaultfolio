# Data Model: PrimeNG UI Foundation & Application Structure

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature has no persisted data model — it's a frontend UI/routing shell with no backend or
database changes. The spec's "Key Entities" are frontend-only configuration/view concepts,
captured below as their TypeScript shapes.

## Application Area

One top-level, navigable section of the product.

| Field       | Type                                    | Notes                                                     |
| ----------- | --------------------------------------- | --------------------------------------------------------- |
| `id`        | `string`                                | Stable key, e.g. `'dashboard'`, `'holdings'`.             |
| `label`     | `string`                                | Nav entry text, e.g. `'Dashboard'`.                       |
| `path`      | `string`                                | Router path segment, e.g. `'dashboard'` → `/dashboard`.   |
| `icon`      | `string`                                | PrimeIcons class name, e.g. `'pi pi-home'`.               |
| `component` | Angular standalone component (lazy ref) | The placeholder/feature component rendered for this area. |

**Instances at end of this feature** (FR-005, FR-007): Dashboard, Holdings, Imports, Settings
(Settings hosts the relocated health-status screen).

**Validation rules**: `id` and `path` MUST be unique across all areas; every area MUST have a
corresponding Angular Router route and a corresponding sidebar/top-bar nav entry (no area exists
in one without the other) — this pairing is what SC-003 checks a new contributor can reproduce.

**State/transitions**: None (static list — future features that build out an area's real screens
don't change this shape, only what `component` renders).

## Navigation Shell

The persistent layout wrapping all Application Areas.

| Field          | Type                    | Notes                                                                  |
| -------------- | ----------------------- | ---------------------------------------------------------------------- |
| `areas`        | `ApplicationArea[]`     | Ordered list rendered as nav entries (sidebar and mobile top bar).     |
| `activeAreaId` | `string`                | Derived from the current route (`routerLinkActive`), not stored state. |
| `viewport`     | `'desktop' \| 'mobile'` | CSS-driven (media query), not a component-level state field.           |

**Validation rules**: Exactly one area is active at a time, matching the resolved route; the
active area is always visually indicated (`aria-current="page"` per design.md) in whichever
layout (sidebar or top-bar) is currently rendered.

**Relationships**: Composes one or more `ApplicationArea` entries; wraps a `router-outlet` that
renders the active area's `component`, plus a shared `NotFoundComponent` for unmatched routes
(FR-006).

## Theme

The shared set of visual design decisions applied uniformly across the application.

| Field    | Type      | Notes                                                                      |
| -------- | --------- | -------------------------------------------------------------------------- |
| `preset` | `Aura`    | PrimeNG theme preset object, imported from `@primeuix/themes/aura`.        |
| `mode`   | `'light'` | Only a default light theme is in scope (spec Assumptions); no dark toggle. |

**Validation rules**: Configured exactly once, globally, via `providePrimeNG` in
`app.config.ts` (FR-002) — no per-area or per-component theme overrides.

**Relationships**: Applies to every `ApplicationArea`'s rendered content and the `Navigation
Shell` itself; not modeled as a runtime-mutable entity in this feature (no dark-mode switch is in
scope).
