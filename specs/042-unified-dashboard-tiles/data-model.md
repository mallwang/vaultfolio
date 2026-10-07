# Data Model: Unified Dashboard Tiles

No server-side or database entities change. The only persisted data is a per-user browser preference.

## Dashboard Layout (extended)

Stored in `localStorage` under `vaultfolio.dashboard-layout.<userId>` (existing key).

| Field      | Type       | Meaning                                               | Default |
| ---------- | ---------- | ----------------------------------------------------- | ------- |
| `order`    | `string[]` | Tile ids in the user's order (existing)               | `[]`    |
| `hidden`   | `string[]` | Tile ids the user switched off (existing)             | `[]`    |
| `expanded` | `string[]` | Tile ids whose details are expanded (**new**, FR-010) | `[]`    |

Validation (`parseDashboardLayout`): untrusted JSON; `expanded` missing or not an array becomes `[]`; non-string entries are dropped. Ids not in the current tile catalog are ignored when read (not rewritten).

State rules:

- Default for every tile is collapsed (id absent from `expanded`).
- Expanding adds the id; collapsing removes it; the list holds each id at most once.
- Hiding/showing a tile via the edit dialog does not change its expanded state.
- `reset()` clears `order`, `hidden` and `expanded`.
- Expanded state is independent per tile; it never affects another tile's state (neighbours only stretch visually).

## Dashboard Tile (view model, unchanged shape)

`DashboardTile` keeps `id`, `domainId`, `titleKey`, `widget`, `hidden`. Expansion is not added to it; the frame reads it by tile id through the expansion token.

## Tile Frame (component state)

| Input / state                              | Meaning                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `tileId`                                   | Stable id used for persistence (matches the contribution `id`)           |
| `title`, `link`, `linkLabel`, `linkTestId` | Header content                                                           |
| `testIdPrefix`                             | Base for `-toggle` / `-details` test ids                                 |
| `hasDetails`                               | True when the details slot has content; controls toggle presence         |
| `expanded`                                 | Read from the expansion token (or local fallback), toggled by the button |
