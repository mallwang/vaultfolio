# Feature Specification: Unified Dashboard Tiles

**Feature Branch**: `042-unified-dashboard-tiles`

**Created**: 2026-10-07

**Status**: Draft

**Design**: [design.md](./design.md)

**Input**: User description: "Unify the filled dashboard tiles. Displayed amounts currently differ in size per tile (net worth is large, gross income is small) — use one common size. Tiles with larger content (charts, extra texts) stretch the other tiles in the same row, so define a minimum size per tile that all tiles respect, and show only the main information by default (e.g. for net worth: amount, as-of date and chart, but no details per position). Details are optional (some tiles have nothing beyond their main content) and can be expanded/collapsed. An expanded tile makes its row neighbours taller too, but the neighbours must NOT show their details — only the tile itself grows. Every tile consists of the same elements: header, main content, collapsible details."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent, scannable tiles (Priority: P1)

A member opens the dashboard and sees all tiles with the same structure: a header with the title, then a main section with the headline amount and as-of date (plus a chart where the domain has one). Headline amounts have the same size across all tiles, and every tile has at least the same minimum height, so the dashboard reads as one calm grid instead of a mix of large and small figures.

**Why this priority**: Visual consistency and at-a-glance scanning are the core value of this change.

**Independent Test**: Open the dashboard with several domains filled; verify all headline amounts are rendered at the same size, every tile is at least the minimum height, and no tile shows detail content by default.

**Acceptance Scenarios**:

1. **Given** the dashboard shows tiles from different domains, **When** the member views it, **Then** all headline amounts are displayed at the same size.
2. **Given** a tile with little content (e.g. gross income) next to a tile with a chart, **When** the dashboard is displayed, **Then** every tile is at least the shared minimum height and the amount, as-of date and header sit at the same relative positions in each tile.
3. **Given** a tile has detail content (e.g. per-position breakdown), **When** the dashboard first loads, **Then** only header and main content are shown and the details are collapsed.
4. **Given** a tile has no detail content, **When** it is displayed, **Then** it shows no expand/collapse control.

---

### User Story 2 - Expand and collapse tile details (Priority: P1)

A member who wants more information on one tile expands its details with a toggle and collapses them again afterwards. The expanded tile grows taller; tiles in the same row stretch to the same height, but their own details stay collapsed.

**Why this priority**: Moving details behind a toggle is what makes the compact default possible; without it information would be lost.

**Independent Test**: Expand one tile's details; verify the tile shows its details, row neighbours become the same height without showing their details, and collapsing restores the original height.

**Acceptance Scenarios**:

1. **Given** a tile with collapsed details, **When** the member activates its toggle, **Then** the details are revealed and the toggle indicates the expanded state.
2. **Given** a tile is expanded, **When** it is displayed in a row with other tiles, **Then** the neighbouring tiles match its height but do not reveal their own details.
3. **Given** a tile is expanded, **When** the member activates the toggle again, **Then** the details are hidden and the row returns to its minimum height.
4. **Given** the toggle is focused, **When** the member uses the keyboard (Enter/Space), **Then** it expands/collapses the details, and assistive technology announces the expanded/collapsed state.
5. **Given** a member expanded a tile, **When** they reload the dashboard, **Then** the tile is shown in the same expanded/collapsed state as before.

---

### User Story 3 - All existing tile states keep working (Priority: P2)

Tiles that are empty, loading, failed to load, or in maintenance still use the same tile frame (header, minimum height) so the grid stays uniform, and existing dashboard behaviour (reordering, show/hide via the edit dialog) is unchanged.

**Why this priority**: The unification must not regress existing dashboard features, but delivers no new value on its own.

**Independent Test**: Put a domain into maintenance, reorder tiles, hide/show a tile, and view a tile with no data; verify each still works and respects the shared tile frame.

**Acceptance Scenarios**:

1. **Given** a tile is loading, empty, failed or in maintenance, **When** it is displayed, **Then** it uses the shared header and minimum height.
2. **Given** the member reorders or hides tiles, **When** they do so, **Then** drag handle, keyboard reordering and edit dialog behave as before.

---

### Edge Cases

- A tile whose details are shorter than the main content: expanding must still work and not break the row layout.
- Several tiles expanded in the same row: the row takes the height of the tallest tile; each expanded tile shows its details.
- Narrow screens (one tile per row): each tile still respects the minimum height, and expanded details remain readable without horizontal scrolling.
- Very long or very large amounts (e.g. high net worth with currency): must not overflow the tile at the common amount size.
- Tile with a chart but no amount, or amount but no chart: layout stays consistent without gaps or misaligned header.
- Tile data refreshes while details are expanded: the expanded state is kept.
- A tile that is hidden and re-shown keeps its stored expanded/collapsed state.
- Dark and light theme: the common tile frame is legible in both.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every dashboard tile MUST consist of the same three elements in this order: header (title), main content, and optional collapsible details.
- **FR-002**: The headline amount in the main content MUST be displayed at one common size across all tiles.
- **FR-003**: Every tile MUST have a shared minimum height that its main content fits into without clipping.
- **FR-004**: By default, tiles MUST show only the header and main content; details MUST be collapsed.
- **FR-005**: Main content MUST include the headline figure and its as-of date and, where the domain has one, its chart; per-position breakdowns and other secondary information MUST be placed in the details.
- **FR-006**: Tiles without detail content MUST NOT show an expand/collapse control.
- **FR-007**: Members MUST be able to expand and collapse a tile's details through a toggle that is operable by mouse, touch and keyboard and exposes its expanded state to assistive technology.
- **FR-008**: Expanding one tile MUST increase only that tile's content; other tiles in the same row MUST match its height but MUST NOT display their details.
- **FR-009**: Collapsing a tile MUST return the row to its minimum height (unless another tile in the row remains expanded).
- **FR-010**: The expanded/collapsed state of each tile MUST be remembered per member across page reloads.
- **FR-011**: Loading, empty, error and maintenance states of a tile MUST render inside the same tile frame (header, minimum height).
- **FR-012**: Existing dashboard behaviour — drag-and-drop and keyboard reordering, show/hide via the edit dialog, and maintenance display — MUST remain unchanged.
- **FR-013**: All user-visible texts introduced (e.g. toggle labels) MUST be available in every supported language.
- **FR-014**: The new interactive elements (toggle) MUST be uniquely addressable for UI tests according to the project's test-id conventions.
- **FR-015**: Domains contributing tiles MUST be able to provide their main content and (optionally) details to the shared tile frame without duplicating frame, sizing or toggle behaviour.

### Key Entities

- **Dashboard Tile**: A visual unit per domain on the dashboard; has a header, main content, optional details, and a per-member expanded/collapsed state.
- **Tile Expansion State**: Per member and tile, whether details are expanded; defaults to collapsed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the dashboard with all domains filled, 100% of headline amounts are displayed at the same size.
- **SC-002**: With all tiles collapsed, every tile in a row has identical height equal to the shared minimum, unless its main content genuinely requires more, in which case the row differs by no more than that content's height.
- **SC-003**: With all tiles collapsed, no tile shows per-position or other detail content.
- **SC-004**: A member can expand or collapse any tile's details in a single interaction and sees the result immediately.
- **SC-005**: Expanding one tile never reveals details in any other tile (0 occurrences).
- **SC-006**: After a reload, 100% of tiles are in the same expanded/collapsed state as before the reload.
- **SC-007**: All existing dashboard capabilities (reorder, show/hide, maintenance notice) continue to work with no regressions.

## Assumptions

- All currently available dashboard tiles (holdings value, distribution, earnings, retirement, insurances, wealth development, account overview) are converted to the shared tile frame; which content counts as main vs. details is decided per tile during design review and planning.
- The exact shared minimum height and common amount size are determined in the UX review mockup; they are fixed values, not user-configurable.
- Expanded state is stored per member as a dashboard preference, consistent with how the tile order and visibility are stored, and is not shared between members or devices unless the existing dashboard preferences already are.
- Tiles stretch to the row height of their grid row; changing the existing grid and column layout is out of scope.
- No new data or backend calculations are introduced; only the presentation of existing tile data changes.
- A UX mockup review precedes planning to confirm layout and behaviour.
