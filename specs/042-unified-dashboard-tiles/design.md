# Design: Unified Dashboard Tiles

**Mockup**: [mockup.html](./mockup.html) (durable local copy, opens offline). No remote Artifact was published; the mockup was reviewed as a local file.

Visual language approximates the PrimeNG Aura preset used by the app; exact tokens are taken from the existing theme during implementation.

## Approved layout

Every tile uses the same frame, top to bottom:

```text
+--------------------------------------+
| Title                       Open  ⋮⋮ |  header (title, link, drag handle)
| 312.800 €                            |  main: headline amount (common size)
| Stand 30.09.2026 · +4.200 €          |  main: as-of / delta line
| [chart zone]                         |  main: fixed-height chart zone
|        Details anzeigen ▾            |  toggle (only if details exist)
| ------------------------------------ |
| details (collapsed by default)       |  details
+--------------------------------------+
```

- **Common amount size**: one value (`1.875rem`, bold, tabular numerals) for the headline amount in every tile.
- **Minimum height**: `14rem` for every tile.
- **Main zones**: amount, as-of line and a fixed-height chart zone (`3.25rem`) have fixed positions; tiles without a chart (total value, accounts) keep the empty chart zone so amounts line up across a row.
- **Toggle**: sits directly below the main content, centered, labelled "Details anzeigen" / "Details ausblenden" with a chevron. Absent when a tile has no details.
- **Details**: below the toggle, separated by a dashed rule. Collapsed by default.
- **Row behaviour**: tiles in a row stretch to the tallest tile. When one tile is expanded, neighbours grow with it but stay collapsed; their toggle stays directly under their main content and the spare room sits below it.
- **Main vs. details per tile**:
  - Total value: main only (no details).
  - Distribution: main = chart; details = type breakdown and excluded-holdings note.
  - Earnings: main = gross amount, net and change, bar chart; details = taxes, social contributions, monthly average, growth, data-check hint.
  - Retirement: main = expected monthly, guaranteed/additional bar; details = start date, guaranteed, additional, savings rate.
  - Insurances: main = monthly amount, yearly amount, split bar; details = legend, next due date, active contracts, coverage gaps.
  - Net worth: main = amount, as-of, change, composition bar; details = legend with shares, assets, liabilities.
  - Accounts: main = account count; details = per-category counts, decommissioned count.
- **Edge states** (loading, error, empty, maintenance) render inside the same frame (header, minimum height) without a toggle.
- **Mobile**: tiles stack one per row; each keeps the minimum height and its own toggle.

## Requirement traceability

| Region / behaviour                    | Requirements           |
| ------------------------------------- | ---------------------- |
| Tile frame (header/main/details)      | FR-001, FR-015         |
| Common amount size                    | FR-002                 |
| Minimum height, chart zone            | FR-003                 |
| Collapsed default, main/details split | FR-004, FR-005, FR-006 |
| Toggle and row stretching             | FR-007, FR-008, FR-009 |
| Edge states in the frame              | FR-011, FR-012         |
| Not mockup-relevant                   | FR-010, FR-013, FR-014 |

## Out of scope for the mockup

Persistence of the expanded state, translations, test ids, drag-and-drop and edit-dialog behaviour, dark theme.
