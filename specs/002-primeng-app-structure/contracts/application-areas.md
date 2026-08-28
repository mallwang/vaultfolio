# Contract: Application Area Registration

**Feature**: [spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This is not a network/API contract (no backend changes in this feature) — it's the internal
convention future features MUST follow to add a new top-level Application Area, per FR-008 and
SC-003 ("a developer unfamiliar with the project can add one new placeholder application area ...
in under 30 minutes, using only the documented structure").

## Route table (this feature's initial areas)

| Area      | Path         | Nav label | Icon (PrimeIcons) | Notes                                   |
| --------- | ------------ | --------- | ----------------- | --------------------------------------- |
| Dashboard | `/dashboard` | Dashboard | `pi-home`         | Default route; `/` redirects here.      |
| Holdings  | `/holdings`  | Holdings  | `pi-briefcase`    | Table-shell placeholder.                |
| Imports   | `/imports`   | Imports   | `pi-upload`       | Dropzone-style placeholder.             |
| Settings  | `/settings`  | Settings  | `pi-cog`          | Hosts relocated health-status (FR-007). |
| —         | `**`         | —         | —                 | `NotFoundComponent`, rendered in-shell. |

## Adding a new area (contract future features MUST follow)

1. Create `apps/frontend/src/app/<area>/` with a standalone Angular component for the area's
   placeholder/feature content.
2. Register the route in the app's route config (`app.routes.ts`): `{ path: '<area>', component:
<AreaComponent> }`, added before the wildcard `**` route.
3. Add one entry to the shared `APPLICATION_AREAS` list (id, label, path, PrimeIcons icon) that
   the navigation shell renders — this is the single source of truth for both the sidebar and the
   mobile top-bar nav (design.md), so an area is never registered in the router without also
   appearing in navigation, or vice versa.
4. Use only PrimeNG components for interactive elements in the new area (FR-001) — no bespoke
   buttons/inputs/tables for standard controls.

## Verification

- Navigating to the new path renders the new component inside the persistent shell (sidebar/header
  unchanged).
- The new area's nav entry appears in both the desktop sidebar and the mobile top bar, and shows
  `aria-current="page"`/active styling when selected.
- No route exists without a matching nav entry, and no nav entry links to an unregistered route.
