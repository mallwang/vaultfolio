# Design: Export Modal Dialog

**Mockup**: [mockup.html](mockup.html) (durable local copy) · original Artifact: https://claude.ai/artifact/YU9QaBwq4hbbc1WCXFwM1P (may go stale)

**Status**: Approved by the product owner without changes.

## Layout per region / state

### Entry point (link)

- Replaces the split button in the existing toolbar slot. On Earnings it sits in the right action group, directly before the "Dokumente importieren" button.
- Text link with icon, label "Daten exportieren", primary color, underline on hover — same style as the "So werden Ihre Daten geschützt" link.
- Satisfies FR-001, FR-016, User Story 1 scenario 4.

### Modal

```
┌───────────────────────────────────────────────┐
│ Daten exportieren                           ✕ │
│ <Feature> · Wählen Sie ein Format. ...        │
│ [error banner - only after a failed export]   │
│ ┌───────────────┐ ┌───────────────┐           │
│ │ [prev] PDF    │ │ [prev] Excel  │           │
│ │ Dateiname     │ │ Dateiname     │           │
│ │ Format        │ │ Format        │           │
│ │ Enthält       │ │ Enthält       │           │
│ │ Geeignet ✓    │ │ Geeignet ✓    │           │
│ │ Weniger ✕     │ │ Weniger ✕     │           │
│ │ [Als PDF exp.]│ │ [Als Excel e.]│           │
│ └───────────────┘ └───────────────┘           │
│ (CSV, JSON — second row)                      │
└───────────────────────────────────────────────┘
```

- Header with title, short hint that several formats can be exported in one visit, close button. No "export all" anywhere. (FR-002, FR-007, FR-008)
- Four cards in a 2×2 grid on desktop; one column on mobile (400 px) with the modal scrolling. (FR-015, SC-007)
- Card: dimmed generic preview (left of title/explanation), then a label/value list — Dateiname (monospace), Format, Enthält, Geeignet für (green check), Weniger geeignet (orange cross) — and a full-width export button at the bottom. (FR-003, FR-004, FR-005, FR-006)

### States

| State           | Behavior                                                                                            | Requirement     |
| --------------- | --------------------------------------------------------------------------------------------------- | --------------- |
| Link only       | Modal closed                                                                                        | FR-001          |
| Modal open      | Four cards, all buttons enabled                                                                     | FR-002, FR-007  |
| Export busy     | Only the running card's button is disabled with spinner and "Wird erstellt …"; other cards usable   | FR-009, Story 2 |
| Export failed   | Error banner inside the modal; card returns to normal; modal stays open                             | FR-010          |
| Disabled        | Link disabled with the existing tooltip, no modal                                                   | FR-011, Story 4 |
| Feature variant | Earnings CSV card: "Einkommensentwicklung.zip", ZIP with 4 CSV files; other features: single `.csv` | FR-005, Story 3 |

## Out of scope for the mockup

- Actual download logic, closing the modal during a running export (FR-012, Edge Cases).
- Translations beyond German (FR-013), focus trap / focus return and accessible button names (FR-014).
- Exact file-name sanitization (FR-004) — the mockup shows plain names.
- Real feature titles and per-feature "Enthält" overrides for features other than Earnings and Holdings.

## Visual language

Approximates the app's current teal PrimeNG theme with light and dark tokens. The real implementation uses PrimeNG's dialog and button components plus the existing `--p-primary-color` tokens; exact spacing and card styling are finalized during implementation. The previews are generic illustrative mock-ups (page, spreadsheet, CSV text, JSON code), identical for all features.
