# Frontend

Angular application for Vaultfolio, built with [PrimeNG](https://primeng.dev) as the single
shared UI component library (see `specs/002-primeng-app-structure/`).

## Layout & navigation

Shared shell/navigation code lives under `src/app/core/layout/`:

- `app-shell/` — top-level shell composing the sidebar, header, and routed content region.
- `app-sidebar/` — persistent nav: a sidebar on desktop/tablet, a horizontally-scrollable top bar
  on mobile (CSS media query, no separate component).
- `app-header/` — "Vaultfolio" crumb + active area title + user-identity placeholder.
- `not-found/` — in-shell "not found" state rendered by the router's wildcard route.
- `application-areas.ts` — the `APPLICATION_AREAS` list (id/label/path/icon). This is the single
  source of truth both the navigation shell and the route table read from — an area is never
  registered in one without the other.

## Theming

PrimeNG is configured once, globally, in `src/app/app.config.ts` via `providePrimeNG({ theme: {
preset: Aura } })`. Do not add per-area or per-component theme overrides — Aura is the only theme
in scope.

## Application Area folder convention

Every top-level, navigable section of the product ("Application Area") gets its own folder
directly under `src/app/` (e.g. `dashboard/`, `holdings/`, `imports/`, `settings/`), holding a
standalone Angular component. `health-status/` lives under `settings/` since it's Settings'
"System health" section rather than its own top-level area.

## Adding a new Application Area

See [`specs/002-primeng-app-structure/contracts/application-areas.md`](../../specs/002-primeng-app-structure/contracts/application-areas.md)
for the full contract. In short:

1. Create `src/app/<area>/` with a standalone Angular component for the area's placeholder/feature
   content.
2. Register a lazy-loaded route in `src/app/app.routes.ts`: `{ path: '<area>', loadComponent: ()
=> import('./<area>/<area>.component').then((m) => m.<Area>Component) }`, added before the
   trailing `**` wildcard route.
3. Add one entry to `APPLICATION_AREAS` in `src/app/core/layout/application-areas.ts` (id, label,
   path, PrimeIcons icon class, e.g. `'pi pi-home'`) — this is what the sidebar and mobile top bar
   render.
4. Use only PrimeNG components for interactive elements in the new area — no bespoke
   buttons/inputs/tables for standard controls.

Verify: the new path renders inside the persistent shell, the nav entry appears in both the
desktop sidebar and mobile top bar, and it shows the active-page indicator when selected.
