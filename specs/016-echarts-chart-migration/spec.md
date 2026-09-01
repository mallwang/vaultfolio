# Feature Specification: ECharts Chart Migration

**Feature Branch**: `016-echarts-chart-migration`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "I would like to use the main chart library echarts for all charts in the application. Existing charts and the default library of PrimeNG should be replaced with echarts equivalents."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent, richer chart experience across the app (Priority: P1)

As a user viewing my portfolio data (e.g. the holdings allocation breakdown on the dashboard), I want every chart to look, behave, and respond consistently, so that the visual language of the app feels unified and charts remain easy to read and interact with regardless of which screen I'm on.

**Why this priority**: This is the core and only user-facing outcome of the migration — replacing the underlying charting engine while preserving (and improving) the visual experience. Without this, the feature has no value.

**Independent Test**: Can be fully tested by opening the dashboard allocation view (the current holdings distribution chart) and confirming the chart renders correctly, is interactive (tooltips/legend/hover), and is visually consistent with the rest of the app's design system, with no PrimeNG/Chart.js chart remaining.

**Acceptance Scenarios**:

1. **Given** a user with holdings has the dashboard open, **When** the allocation/distribution chart loads, **Then** it renders using the new charting library with equivalent or richer data (segments, values, labels) than before.
2. **Given** a chart is rendered, **When** the user hovers or taps a data segment, **Then** a tooltip or highlight appears showing the relevant value, matching the previous interaction pattern or better.
3. **Given** the user switches between light and dark theme, **When** a chart is visible, **Then** the chart's colors and text adapt to remain legible and consistent with the app's theme.
4. **Given** the user resizes the browser window or views on a smaller screen, **When** a chart is visible, **Then** the chart resizes/reflows responsively without clipping or overflow.

---

### User Story 2 - No visual or functional regressions after migration (Priority: P2)

As a user who relied on the existing chart, I want the replacement chart to preserve the same information and level of detail I had before, so that I don't lose insight into my portfolio when the underlying library changes.

**Why this priority**: Migrations of this kind carry regression risk; ensuring feature parity protects existing value before any new charting capabilities are considered.

**Independent Test**: Can be tested by comparing the data displayed (categories, values, percentages, colors/legend) on the migrated chart against the previous PrimeNG/Chart.js version using the same sample data set.

**Acceptance Scenarios**:

1. **Given** a fixed set of holdings data, **When** viewed in the migrated chart, **Then** all categories/segments and their values match what was shown in the previous chart implementation.
2. **Given** a user with no holdings (empty state), **When** the chart section loads, **Then** an appropriate empty/loading state is shown instead of a broken or blank chart.

---

### User Story 3 - Foundation for future charts (Priority: P3)

As a developer/maintainer, I want a single, consistently-configured charting library available across the application, so that any future chart added to the app uses the same library and styling conventions rather than reintroducing PrimeNG's chart module or another library.

**Why this priority**: This is a maintainability/consistency goal rather than an end-user-facing behavior change, so it's valuable but lower priority than ensuring the existing chart works correctly.

**Independent Test**: Can be tested by confirming the PrimeNG chart module (and its Chart.js dependency) is no longer referenced anywhere in the codebase, and that shared theming/config for the new library is defined in one reusable location.

**Acceptance Scenarios**:

1. **Given** the codebase after migration, **When** searching for PrimeNG's chart component or Chart.js usage, **Then** no references remain outside of removed/legacy code.
2. **Given** a developer wants to add a new chart, **When** they follow the app's conventions, **Then** they find a documented, reusable pattern for creating an ECharts-based chart consistent with the app's theme.

### Edge Cases

- What happens when chart data is empty (e.g., a user with zero holdings)? The chart area must show a clear empty state rather than an empty canvas or error.
- What happens when a chart is displayed with a very large number of categories/segments (e.g., many distinct holdings)? Labels/legend must remain readable (e.g., via grouping, truncation, or scroll) rather than overlapping illegibly.
- How does the chart behave while its underlying data is still loading? A loading indicator or skeleton must be shown rather than a flash of empty/broken chart.
- How does the chart behave if the theme (light/dark) or language changes while it's visible? It must re-render with correct colors and localized labels without requiring a page reload.
- What happens when the browser window is resized or the chart's container changes size (e.g., sidebar collapse)? The chart must resize to fit its container without distortion or overflow.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render all charts in the application using the ECharts library instead of PrimeNG's chart component and its Chart.js dependency.
- **FR-002**: System MUST migrate the existing holdings distribution (dashboard allocation) chart to an ECharts-based equivalent, preserving the same categories, values, and level of interactivity (tooltip on hover/tap, legend).
- **FR-003**: System MUST remove the PrimeNG chart module and its charting dependency from the codebase once all charts are migrated, so no dual charting libraries remain.
- **FR-004**: Charts MUST visually adapt to the application's active theme (light/dark), using colors consistent with the app's existing design tokens/palette.
- **FR-005**: Charts MUST be responsive, resizing to fit their container across common desktop and mobile viewport widths without clipping, overflow, or distortion.
- **FR-006**: Charts MUST display a clear empty state when there is no data to show (e.g., a user with no holdings), instead of an empty or broken chart area.
- **FR-007**: Charts MUST display a loading state while their underlying data is being fetched.
- **FR-008**: Chart labels and tooltips MUST respect the application's active language/localization setting.
- **FR-009**: System MUST provide a reusable, documented pattern (e.g., a shared chart wrapper/config) so future charts added to the application consistently use ECharts with the app's shared styling.

### Key Entities

- **Chart Configuration**: Represents the shared visual/theming setup (colors, fonts, tooltip style) applied consistently across all ECharts instances in the app.
- **Holdings Distribution Data**: The categories (e.g., asset/holding names) and their corresponding values/percentages currently rendered by the dashboard allocation chart, to be preserved through the migration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of charts in the application (currently: the dashboard holdings distribution chart) render via the new charting library, with zero remaining usages of the previous chart component.
- **SC-002**: Charts remain fully legible and correctly rendered across at least the two supported themes (light/dark) and across desktop and mobile viewport widths, with no visual clipping or overflow.
- **SC-003**: A user viewing the migrated chart can retrieve the same data values (categories and amounts/percentages) as before the migration, with no loss of information.
- **SC-004**: Empty and loading states are shown appropriately in 100% of cases where chart data is unavailable or still loading, with no broken/blank chart ever shown to the user.

## Assumptions

- The only chart currently in the application is the holdings distribution (dashboard allocation) chart built with PrimeNG's Chart component (Chart.js-backed); this is the sole chart requiring migration, but the new pattern established must support future charts.
- "Default library of PrimeNG" refers to PrimeNG's Chart UI component (which wraps Chart.js), not any other PrimeNG visual component.
- Visual styling of the migrated chart should closely match the app's existing design system (colors, typography) rather than ECharts' default look, reusing existing theme tokens where possible.
- No new data or backend changes are required; the migration is limited to the presentation/charting layer consuming existing holdings data.
- Accessibility expectations (keyboard/screen-reader support for chart interactions) follow the same baseline the current PrimeNG chart provides; no explicit new accessibility requirements are introduced beyond parity.
