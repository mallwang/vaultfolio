# Phase 1 Data Model: Material Icons as Default Icon Library

No persisted data entities are introduced or changed by this feature (per the spec's Key Entities
section — this is a UI presentation change only). The only structured "data" this feature adds is
a static, in-code lookup table, documented here for implementation reference.

## Icon Name Map

A compile-time `Record<string, string>` (`ICON_NAME_MAP` in
`apps/frontend/src/app/shared/icon/icon-name.map.ts`) mapping the app's existing semantic icon
names (formerly PrimeIcons suffixes, e.g. `pi-trash` → `trash`) to a Material Symbols glyph name.
This is not a runtime/database entity — it ships as part of the frontend bundle and is only
extended when a new icon is introduced in app code.

| Field               | Type     | Notes                                                                                                                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (map key)    | `string` | Semantic name used at call sites, e.g. `<vf-icon name="trash">`. Stable across the codebase; matches the old `pi-*` suffix where practical to minimize churn during the rewrite. |
| `glyph` (map value) | `string` | Material Symbols Outlined ligature name, e.g. `delete`. Must be a valid glyph in the loaded Material Symbols Outlined font.                                                      |

### Known mappings (current icon inventory, from FR-003's "same meaning" requirement)

| Old PrimeIcon             | `name`         | Material Symbols glyph                                                                  |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `pi-home`                 | `home`         | `home`                                                                                  |
| `pi-briefcase`            | `briefcase`    | `work`                                                                                  |
| `pi-chart-line`           | `chart-line`   | `show_chart`                                                                            |
| `pi-check-circle`         | `check-circle` | `check_circle`                                                                          |
| `pi-clock`                | `clock`        | `schedule`                                                                              |
| `pi-cog`                  | `cog`          | `settings`                                                                              |
| `pi-contract`             | `contract`     | `description`                                                                           |
| `pi-download`             | `download`     | `download`                                                                              |
| `pi-envelope`             | `envelope`     | `mail`                                                                                  |
| `pi-exclamation-triangle` | `warning`      | `warning`                                                                               |
| `pi-inbox`                | `inbox`        | `inbox`                                                                                 |
| `pi-key`                  | `key`          | `key`                                                                                   |
| `pi-lock`                 | `lock`         | `lock`                                                                                  |
| `pi-moon`                 | `moon`         | `dark_mode`                                                                             |
| `pi-sun`                  | `sun`          | `light_mode`                                                                            |
| `pi-pencil`               | `pencil`       | `edit`                                                                                  |
| `pi-plus`                 | `plus`         | `add`                                                                                   |
| `pi-replay`               | `replay`       | `replay`                                                                                |
| `pi-search`               | `search`       | `search`                                                                                |
| `pi-send`                 | `send`         | `send`                                                                                  |
| `pi-shield`               | `shield`       | `shield`                                                                                |
| `pi-sign-out`             | `sign-out`     | `logout`                                                                                |
| `pi-spin`/`pi-spinner`    | `spinner`      | `progress_activity` (paired with `vf-icon`'s `[spin]` input for the rotation animation) |
| `pi-times`                | `close`        | `close`                                                                                 |
| `pi-trash`                | `trash`        | `delete`                                                                                |
| `pi-upload`               | `upload`       | `upload`                                                                                |
| `pi-user-plus`            | `user-plus`    | `person_add`                                                                            |
| `pi-arrow-left`           | `arrow-left`   | `arrow_back`                                                                            |

This table is the starting inventory found in the current codebase (see research.md and plan.md
Scope); the implementation phase re-derives the exact final list from a full grep of `pi-*` usages
and adds any PrimeNG-internal icon-slot names not covered here (close, sort ascending/descending,
sort neutral, calendar/date-picker trigger, dropdown trigger).

## Unknown-icon fallback (FR-007)

Not a data entity but a documented runtime contract: `vf-icon` given a `name` absent from
`ICON_NAME_MAP` renders the Material Symbols `error` glyph in the app's danger/error color and
emits a `console.warn` in all environments — chosen precisely so the gap is visible in manual
testing and browser consoles during development rather than silently blank.
