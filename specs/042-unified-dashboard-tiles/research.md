# Research: Unified Dashboard Tiles

## R1 — Where does the frame live?

- **Decision**: A presentational `app-dashboard-tile` component in `libs/frontend/shared-ui`, used inside each domain widget with content projection (`[tileMain]`-style default slot for sub line, `tileChart` slot, `tileDetails` slot) and inputs for title, link, link label, test-id prefix and tile id.
- **Rationale**: Main vs. details content is domain knowledge and widgets render it from their own state, so the frame cannot be owned by the dashboard. Hosting it in `shared-ui` lets every domain use it without depending on the app, and a single component implements sizing, toggle and a11y once (FR-015).
- **Alternatives considered**:
  - Dashboard renders header/toggle around the widget: cannot know whether a widget currently has details (empty/error states) or split main and details.
  - Shared CSS classes copied per widget: duplicates sizing and toggle behaviour, drifts again.

## R2 — Header ownership

- **Decision**: The frame renders the header (title + "open" link) as in the approved mockup. `p-card` stays only as the outer card (border, padding, drag handle) without its own `header`. States rendered by the dashboard itself (maintenance notice) use the frame header with the tile's `titleKey`; widget empty/unavailable states render the frame too (header + body).
- **Rationale**: Today the card header (`titleKey`, e.g. "Altersvorsorge") and the widget header (e.g. "Erwartete Rente") both appear; the mockup shows one header. The widget's own title is the more specific one and already comes with the link.
- **Alternatives considered**: Keep both headers: contradicts the approved layout and wastes height.
- **Risk**: Tiles lose the stable `titleKey` header in widget error states unless the widget passes a title; mitigated by passing the `titleKey` translation in those states.

## R3 — How does the frame get its persisted expanded state?

- **Decision**: An optional injection token `DASHBOARD_TILE_EXPANSION` in `shared-ui` with `isExpanded(tileId): boolean` (signal-backed) and `setExpanded(tileId, expanded)`. `DashboardLayoutStore` provides it at the dashboard level. Without a provider (tests, other pages) the frame keeps local component state.
- **Rationale**: Libraries cannot import the app store; a token is the existing pattern for this boundary (`CURRENT_USER_SOURCE`, `APP_VERSION`). Reusing the layout store keeps one `localStorage` entry per user and one reset path.
- **Alternatives considered**:
  - State inside the frame with its own `localStorage` key: needs the user id, duplicates user scoping.
  - Pass state down through `DashboardWidgetContribution`/outlet inputs: widgets are created dynamically and would need an extra input contract on every widget.

## R3a — Persistence format

- **Decision**: Add optional `expanded: string[]` to `DashboardLayout`; `parseDashboardLayout` defaults to `[]`, ignores non-string entries and unknown ids (like `order`/`hidden`). `reset()` also clears it. `isCustomized` stays based on order/hidden only (expanding is not a layout customization).
- **Rationale**: Backward compatible with existing stored layouts; FR-010 satisfied.

## R4 — Row stretching without revealing neighbour details

- **Decision**: Keep the existing CSS grid (`align-items: stretch`) and make the card and frame flex columns. Each tile's details visibility depends only on its own state. The toggle sits directly under the main content and the details follow it; spare height from a taller neighbour appears below.
- **Rationale**: Matches the approved mockup; no JS layout logic.
- **Alternatives considered**: `align-items: start` (independent heights): rejected by the user, who wants the row to stay aligned.

## R5 — Common amount size and minimum height

- **Decision**: `app-tile-value` sets `font-size: 1.875rem; font-weight: 700; tabular numerals; line-height: 1.15`. The frame sets `min-height: 14rem` and a `3.25rem` chart zone (always present, empty if no chart). Values are CSS custom properties on the frame so they can be tuned in one place.
- **Rationale**: Taken from the reviewed mockup. Long amounts: allow the value to shrink-wrap and break rather than overflow (`overflow-wrap: anywhere`).

## R6 — Accessibility and test ids

- **Decision**: Toggle is a `<button type="button">` with `aria-expanded` and `aria-controls` pointing to the details region; label switches between "show details" and "hide details" (new i18n keys in `en`/`de`). Test ids: `<testIdPrefix>-toggle` and `<testIdPrefix>-details`, with the prefix passed by each widget (e.g. `wealth-widget`).
- **Rationale**: Required by FR-007 and FR-014; follows the "component reused across contexts" rule of the test-id convention.

## R7 — Existing widgets and tests

- **Decision**: Migrate each widget's filled state; keep existing `data-testid`s on moved elements so current specs and verify-ui scripts keep working. Update widget specs only where DOM structure moved (details now live behind the toggle and are not rendered while collapsed).
- **Rationale**: Details not rendered while collapsed also avoids hidden-but-focusable content and unnecessary work; tests that read detail values must expand first.
- **Open point**: Holdings total value is currently a "coming soon" placeholder; it adopts the frame header/min-height only and gets no details.

## R8 — Dashboard drag-and-drop and maintenance

- **Decision**: No change to CDK drag logic, handle or edit dialog. The maintenance tile and admin badge keep working inside the card; maintenance tile uses the frame header and minimum height.
