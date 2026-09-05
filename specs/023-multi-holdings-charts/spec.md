# Feature Specification: Per-Type Holdings Breakdown Charts

**Feature Branch**: `024-multi-holdings-charts`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "I would like to improve the holdings chart view to show multiple charts:

- one main chart (the current one) which displays the distribution of the top-level types
- one for each type (e.g. precious metal) using one segment per "name" (e.g. gold, silver) - this depends on the users input but this is fine
- in total there will be 6 charts to be displayed (one main + 5 category-specifiy types), maybe a 2 row & 3 column distribution could match
- note that the category-specific types should only show the required segments without any legend or centered text (only hovering) because I am concerned for shares there could be many which makes the UI too crowded"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See how each asset type's value is split by holding name (Priority: P1)

As a portfolio owner, after seeing my overall distribution by asset type in the main chart, I want a separate breakdown chart for each asset type — Precious metal, Crypto, ETF, Share, and Deposit money — where each segment represents one holding name (e.g. "Gold", "Silver" within Precious metal), so I can see at a glance how my money within a single type is spread across the individual holdings I've entered, without the main chart having to show that level of detail.

**Why this priority**: This is the core of the requested change — a user who only gets the existing type-level chart today has no way to see the composition within a type; this story delivers that visibility.

**Independent Test**: Add several holdings within one asset type using different names (e.g. two precious-metal holdings named "Gold" and "Silver"), open the holdings view, and verify a chart dedicated to Precious metal shows one segment per distinct name with the correct summed value, alongside the existing main chart which still shows one segment per type.

**Acceptance Scenarios**:

1. **Given** a portfolio with two Crypto holdings named "Bitcoin" and "Ethereum", **When** the holdings view is displayed, **Then** the Crypto-specific chart shows two segments, "Bitcoin" and "Ethereum", each sized by that holding's computed value.
2. **Given** a portfolio with two Precious metal holdings both named "Gold", **When** the holdings view is displayed, **Then** the Precious metal-specific chart shows a single "Gold" segment whose value is the sum of both holdings.
3. **Given** a portfolio with holdings in only 2 of the 5 asset types, **When** the holdings view is displayed, **Then** all 5 type-specific charts are still present, the 2 with holdings show their segments, and the other 3 show the same empty-state treatment the main chart uses when it has no data.
4. **Given** a single asset type with many distinctly-named holdings (e.g. 15 different shares), **When** that type's chart is displayed, **Then** all 15 segments render without a legend or any listing of names alongside the chart, keeping the chart's footprint the same as a type with few holdings.

---

### User Story 2 - Inspect a specific holding's value without visual clutter (Priority: P2)

As a portfolio owner looking at a type-specific chart, I want to hover a segment to see its holding name, value, and share of that type's total, without a permanent legend or center total competing for space, so that charts for types with many holdings (e.g. Share) stay compact and readable instead of overwhelming the page with names.

**Why this priority**: Directly addresses the stated concern that per-name segments — especially for types with many holdings — would make the UI too crowded if labeled the same way as the main chart. Depends on Story 1 existing but is separable as a display-detail refinement.

**Independent Test**: Open a type-specific chart for a type with several holdings, confirm no legend or centered total text is rendered for it, then hover a segment and confirm a tooltip reveals its name, value, and percentage.

**Acceptance Scenarios**:

1. **Given** any type-specific chart, **When** it is displayed, **Then** no legend and no centered total label are rendered for it, regardless of how many segments it has.
2. **Given** any type-specific chart, **When** the user hovers a segment, **Then** a tooltip shows that segment's holding name, its computed value, and its percentage of the type's total.
3. **Given** the main (top-level) chart, **When** it is displayed, **Then** it continues to show its legend and centered total exactly as before — this behavior change applies only to the 5 type-specific charts.

---

### User Story 3 - See all six charts arranged for easy scanning (Priority: P3)

As a portfolio owner, I want the main chart and the five type-specific charts arranged together in a clear grid (2 rows of 3), so I can scan from the overall picture to each type's detail in one view without excessive scrolling.

**Why this priority**: A layout/polish concern — the charts are useful even in a simpler stacked arrangement, but the requested grid materially improves scannability once Stories 1 and 2 exist.

**Independent Test**: Open the holdings view on a viewport wide enough for the grid and verify all 6 charts (main + 5 type-specific, in a fixed, predictable order) are laid out 3 per row across 2 rows.

**Acceptance Scenarios**:

1. **Given** the holdings view on a wide viewport, **When** it is displayed, **Then** the main chart and the 5 type-specific charts appear together as 6 tiles arranged 3 per row, 2 rows.
2. **Given** the holdings view, **When** it is displayed, **Then** the 5 type-specific charts always appear in the same fixed order (matching the app's existing canonical asset-type order) regardless of which types currently have holdings.
3. **Given** a viewport too narrow to fit 3 tiles per row, **When** the holdings view is displayed, **Then** the 6 tiles reflow (e.g. fewer per row) rather than being clipped or forcing horizontal scrolling.

### Edge Cases

- A type-specific chart for a type with zero holdings, or whose holdings all lack a computable value, shows the existing empty-state treatment instead of an empty/blank chart.
- Two holdings of the same type sharing the same name are combined into one segment, summed, consistent with how the main chart already combines same-type holdings into one slice.
- A holding with no computable value is excluded from its type-specific chart's segments and total, the same way it is already excluded from the main chart — the existing excluded-holdings count continues to reflect all such holdings portfolio-wide.
- The 5 type-specific charts always render as 6 total tiles together with the main chart; none is hidden solely because the current user happens to have no holdings of that type (its tile shows the empty state instead of disappearing), keeping the grid position stable.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The holdings view MUST continue to display the existing main chart showing one segment per top-level asset type, unchanged in its data, legend, and centered total behavior.
- **FR-002**: The holdings view MUST additionally display exactly one chart per asset type (5 total: ETF, Share, Precious metal, Crypto, Deposit money), each shown at all times regardless of which types currently have holdings.
- **FR-003**: Each type-specific chart MUST show one segment per distinct holding name within that type, with the segment's value equal to the sum of the computed values of all holdings of that type sharing that name.
- **FR-004**: Each type-specific chart MUST use the same per-type value computation already used for that asset type (current value for Precious metal/Deposit money; quantity × purchase price for ETF/Share/Crypto).
- **FR-005**: A holding without a computable value MUST be excluded from its type-specific chart's segments and total, consistent with its existing exclusion from the main chart.
- **FR-006**: A type-specific chart for a type with no holdings that have a computable value MUST show the view's existing empty-state treatment instead of an empty chart.
- **FR-007**: Type-specific charts MUST NOT render a legend or a centered total label; a segment's name, value, and percentage MUST be revealed only on hover (or equivalent pointer/focus interaction), never as always-visible text.
- **FR-008**: The main chart's existing legend and centered total MUST remain unaffected by FR-007 — that requirement applies only to the 5 type-specific charts.
- **FR-009**: The 6 charts (1 main + 5 type-specific) MUST be presented together as one set within the holdings view, arranged in a 3-column, 2-row grid on a viewport wide enough to fit it, reflowing to fewer columns per row on narrower viewports without clipping or introducing horizontal scrolling.
- **FR-010**: The 5 type-specific charts MUST always appear in the same fixed order, matching the app's existing canonical asset-type ordering (ETF, Share, Precious metal, Crypto, Deposit money).
- **FR-011**: Each type-specific chart's segment coloring MUST be visually distinguishable within that chart; segment colors need not match any other chart's coloring scheme (unlike the main chart, whose colors are keyed to a fixed per-type color already used elsewhere in the app).

### Key Entities

- **Holding**: A user-entered investment position with an asset type, a user-assigned name, and a computable value. Each type-specific chart groups holdings first by asset type (fixed to the chart), then by name.
- **Asset Type**: The fixed category a holding belongs to (ETF, Share, Precious metal, Crypto, Deposit money); determines which of the 5 type-specific charts a holding contributes to, and is the sole grouping key for the main chart.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user with holdings spread across all 5 asset types can identify, for any single type, how its value is split by holding name within 5 seconds of opening the holdings view, without leaving the page.
- **SC-002**: A type with 15+ distinctly-named holdings renders its chart at the same visual size as a type with 2 holdings, with no legend text, name list, or centered total added to the page for that chart.
- **SC-003**: 100% of the 6 charts (main + 5 type-specific) are present and in their fixed positions/order every time the holdings view is opened, regardless of which asset types the current user has data for.
- **SC-004**: Hovering any segment of any type-specific chart reveals its name, value, and percentage within 1 interaction (a single hover/tap), matching the discoverability already provided by the main chart's tooltip.

## Assumptions

- "Name" refers to the existing user-entered `name` field already present on every holding (used today for e.g. "Bitcoin", "Gold", "Bargeld") — no new attribute is introduced.
- Two holdings of the same type sharing the same name are combined into a single summed segment, mirroring how the main chart already combines all holdings of a type into one summed slice — a user who wants separate segments simply uses distinct names, which the feature description acknowledges ("this depends on the users input but this is fine").
- All 5 type-specific charts are always shown, even for a type with no current holdings, so the grid layout (and its fixed 2×3 shape) stays stable and predictable rather than shifting as data changes; a type with no computable-value holdings shows the same empty-state treatment the view already uses elsewhere.
- Per-type segment coloring is independent per chart (not required to match the main chart's fixed per-type palette) since each type-specific chart shows names, not types, and has no cross-chart color-meaning to preserve.
- The value computation per holding (current value vs. quantity × purchase price) and the treatment of holdings with no computable value are unchanged by this feature — only the addition of 5 new name-grouped charts and their crowding-avoidance display treatment (no legend/no centered label) are introduced.
- This change is scoped to the holdings view's chart area; no other page, list, or table is affected.
