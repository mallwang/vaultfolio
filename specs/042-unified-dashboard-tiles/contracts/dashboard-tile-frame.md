# Contract: Dashboard Tile Frame

Internal UI contract between `shared-ui` (provider of the frame), the domain widgets (consumers) and the app dashboard (persistence). No HTTP API is involved.

## `app-dashboard-tile` (shared-ui)

Inputs (decorator `@Input`, per the repo convention for workspace-linked libs):

| Input          | Required | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `tileId`       | yes      | Stable tile id (the contribution `id`)             |
| `title`        | yes      | Header title                                       |
| `link`         | no       | Route of the domain page; link omitted when absent |
| `linkLabel`    | no       | Translated link text                               |
| `linkTestId`   | no       | Test id of the header link                         |
| `testIdPrefix` | yes      | Base for `<prefix>-toggle` and `<prefix>-details`  |

Content slots:

| Slot            | Content                                                                |
| --------------- | ---------------------------------------------------------------------- |
| default         | Main content: `app-tile-value`, as-of / delta line                     |
| `[tileChart]`   | Chart or bar; always occupies the fixed chart zone, empty if not given |
| `[tileDetails]` | Optional details; when not provided, no toggle and no details region   |

Behaviour:

- Minimum height and chart-zone height come from CSS custom properties on the host.
- Toggle: `<button type="button">`, `aria-expanded`, `aria-controls` = details region id; text from `dashboard.tile.showDetails` / `dashboard.tile.hideDetails`.
- Details content is not rendered while collapsed.
- Expanded state read/written through `DASHBOARD_TILE_EXPANSION` when provided, otherwise a local signal (default collapsed).

## `app-tile-value` (shared-ui)

Projects the headline amount and applies the common size (`1.875rem`, bold, tabular numerals). No inputs.

## `DASHBOARD_TILE_EXPANSION` (shared-ui token)

```ts
interface DashboardTileExpansion {
  isExpanded(tileId: string): boolean; // reads a signal; usable in templates and computeds
  setExpanded(tileId: string, expanded: boolean): void;
}
```

Provided by the app dashboard (backed by `DashboardLayoutStore`); optional for consumers.

## Persisted layout (app)

`DashboardLayout` gains `expanded: string[]` as described in [data-model.md](../data-model.md); older stored layouts without the field remain valid.

## Test ids (FR-014)

- `<testIdPrefix>-toggle`: the expand/collapse button
- `<testIdPrefix>-details`: the details region
- Existing widget ids on moved elements are preserved.
