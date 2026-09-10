# Design: Data Export (Per-Feature and Full Account)

**Status**: Approved

**Mockup**: [mockup.html](mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/code/artifact/f4be224e-bb90-422f-adef-951ac84a1b2a (remote link may go stale).

## Approved Layout

### Holdings panel header — Export control (US1/US2, FR-001–FR-003)

- A split-button, PrimeNG "info" severity (blue), sits immediately to the left of "Add holding" in
  the `.holdings-panel__header` action row (`holdings.component.ts`'s existing
  `.holdings-panel__header` flex row — the Export control is inserted as a new sibling before the
  existing `data-testid="holdings-add-holding"` button, not a replacement).
- Left segment: plain click target labeled "Export" with a download icon. Right segment: caret-only
  click target that opens the format menu. Both segments share one rounded pill shape, matching
  PrimeNG SplitButton's default rendering.
- The format menu is a right-aligned dropdown (opens below the caret) listing, top to bottom: JSON,
  CSV, Excel, PDF — a divider between Excel and PDF groups the "data" formats from the "report"
  format. Each row has a Material icon on the left, the format name, and a one-line muted
  description ("Raw structured data", "Plain-text table", "Formatted spreadsheet", "Report with
  charts").
- This same control/menu/position is reused verbatim (same relative position, same severity, same
  menu shape) on Account Overview, Retirement, Insurances, Haushaltsplaner, and Wealth Development,
  each scoped to that feature's own "Add" action and data (US2, FR-008/FR-009) — not mocked up as
  five separate screens since the shape is identical; only the feature name/data/infobox text
  differs.

### PDF export layout (US1, FR-004/FR-005)

Single-page (or paginated, for larger data) report:

1. **Title** — the feature name (e.g. "Holdings"), plus a meta line: app name, export date, and the
   owning user.
2. **Infobox** (FR-005) — an info-colored callout box (reusing the same blue "info" tone as the
   Export button) with a short bolded heading ("About this export — Holdings") and 2–3 sentences
   describing what the feature's data is and what the export contains. Source this text from
   existing end-user documentation (`docs/user-guide.md` §4 for Holdings) where available, adapted
   only as needed to read well standalone in a PDF.
3. **Charts section** — the same distribution charts currently rendered on the feature's page
   (Holdings: the "Distribution" pie plus one per-asset-type breakdown), rendered as static
   images/graphics, arranged in a row of cards mirroring the on-screen `.holdings-charts-grid`.
4. **Data table** — one row per record, one column per field, with the same human-readable, current
   -language headers used elsewhere in the export (FR-006/FR-007).
5. **Footer** — a small print line noting the export is scoped to the requesting user's own data.

### Account Settings — "Export my data" (US3, FR-010–FR-012)

No new screen: the existing Danger Zone section in `profile.component.html` gains real behavior on
its already-present "Export my data (optional)" button (currently a no-op secondary-severity
button at `apps/frontend/src/app/settings/profile/profile.component.html:156`). The mockup keeps
its position and copy as-is; only its wiring changes (produces the described
`vaultfolio-data-export.zip`).

### Language (FR-006)

Every label, header, menu item, infobox sentence, and PDF string switches with the app's resolved
language (browser locale / in-app override), using the existing translation mechanism — demonstrated
in the mockup via English/Deutsch toggle across all three screens.

## Requirement Traceability

| Mockup region                                                | Requirements            |
| ------------------------------------------------------------ | ----------------------- |
| Export split-button ("info" severity, left of "Add holding") | FR-001, FR-003a         |
| Format menu (JSON/CSV/Excel/PDF, icons + descriptions)       | FR-002, FR-003, FR-003a |
| PDF: charts section                                          | FR-004                  |
| PDF: infobox                                                 | FR-005                  |
| Language toggle across all screens                           | FR-006, FR-007          |
| Reused control shape (called out, not re-mocked per feature) | FR-008, FR-009          |
| Settings "Export my data" button                             | FR-010, FR-011, FR-012  |

## Out of Scope for This Mockup

- The five non-Holdings features' own screens — each adopts this identical control/menu/PDF shape
  scoped to its own data; re-mocking each would only repeat this same layout (per FR-008/FR-009).
- Empty-state exports, partial-export-failure messaging, and the exact archive/folder contents
  (FR-014, FR-015) — data/logic behavior, not layout.
- Real chart rendering — the mockup's conic-gradient circles stand in for the actual ECharts
  distribution charts already used on the Holdings page.

## Visual Language Note

Vaultfolio has no theme/design-token file wired up yet, so the mockup approximates PrimeNG's
default "Aura" preset (indigo primary `#6366f1` / `#4f46e5`), matching prior mockups (e.g.
`specs/028-klaro-nav-integration/mockup.html`). The Export control's "info" severity approximates
Aura's info palette (`#0284c7` / `#0369a1` / `#e0f2fe` background) — exact tokens to be finalized
against the real PrimeNG theme when implemented.
