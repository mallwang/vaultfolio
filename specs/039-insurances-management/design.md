# Design: Versicherungen (Insurances Management)

**Mockup**: [mockup.html](./mockup.html) (durable local copy, approved as-is in the first review
round; no published Artifact link). All names and amounts in the mockup are invented.

## Summary

The Insurances domain is a page inside the existing authenticated app shell with the nav entry
"Versicherungen" (the placeholder area from 022). It has one toolbar and three tabs (Übersicht,
Verträge, Lückencheck), plus a contract form, a reminders view and an empty state. German UI text
throughout.

## Layout per region

### Toolbar + tabs

```
[2026] [Sozialversicherungen einrechnen ✓]     [🔔 Erinnerungen] [⬇ Daten exportieren] [+ Vertrag erfassen (primary)]
 Übersicht | Verträge | Lückencheck
```

- Year filter applies to the payment timeline and totals (FR-006, FR-007).
- The social-insurance switch includes or excludes statutory contributions in all sums (FR-013).
- "Daten exportieren" opens the shared export dialog (FR-017).

### Übersicht (Story 2, 3; FR-006–FR-008)

- Four KPI tiles: Kosten pro Monat (hero, private plus statutory as a secondary line), Kosten pro Jahr,
  Aktive Verträge, Nächste Kündigungsfrist (warning colour inside the warning window).
- Two panels: donut of yearly cost by group (Personen, Mobilität, Sachen, Haftung) with legend and
  percentages; bar chart of payments per month (yearly premiums appear as spikes, monthly base bars
  lighter).
- Two panels: upcoming cancellation deadlines (date tag, hint on term/fixed date/reminder status) and a
  short gap-check summary linking to the Lückencheck tab.

### Verträge (Story 1, 3, 5; FR-001, FR-002, FR-008, FR-009, FR-012, FR-013)

- Filter chips by group and a status filter; sortable by premium and next cancellation date.
- Table columns: Versicherung (name, insurer, key detail), Einstufung tag, Prämie with interval, pro
  Monat, Nächste Kündigung, Erinnerung (bell with lead time or muted), row actions edit / delete.
- Rows with a deadline inside the warning window highlight the date.
- Statutory entries (health, care, pension, unemployment) are green-tinted, read-only, with a source tag
  "aus Einkommen MM/YYYY"; no deadline or reminder. Switching to manual is done in the edit dialog.
- Combination overlaps get a "Kombi-Überschneidung" tag.
- Info note explains linked rows and the manual fallback without Earnings data.

### Vertrag erfassen (Story 1, 3, 4; FR-002, FR-003, FR-018)

Form with panels: Vertragsdaten (catalog type grouped by area with classification tag, name, insurer,
number, status, start, end), Prämie (amount, interval, payment month), Kündigung (period, auto-renewal,
fixed cancellation date, reminder setting) with a live derived summary (next cancellation, monthly and
yearly cost), and type-specific details (here car: plate, no-claims class, deductible, coverage sum),
"Deckt zusätzlich ab" for combination products, and notes.

### Lückencheck (Story 6; FR-014–FR-016)

- Info note: general guidance, not advice.
- Left panel: profile switches (owns property, car, children, pets, travels abroad) and employment status.
- Right panel: missing coverage with explanation, classification tag (Wesentlich / Empfohlen / Situativ /
  Optional) and "Ausblenden".
- Second row: Abgedeckt list (checkmarks, "aus Einkommen" for linked), Mögliche Doppelungen, and
  Ausgeblendet with "Wiederherstellen".

### Erinnerungen (Story 4; FR-010, FR-011)

Panel with a global switch (default off), lead time select (default 30 days), and one switch per active
contract. Note on one email per deadline in the user's language.

### Leer

Centered panel with calls to action "Ersten Vertrag erfassen" and "Lückencheck starten"; an info note
appears when Earnings data exists and statutory entries will be taken over.

### Mobile

KPI tiles in two columns, panels and form stacked, table scrolls horizontally, sidebar becomes a
horizontal bar.

## Requirement traceability

| Region           | Requirements                                   |
| ---------------- | ---------------------------------------------- |
| Toolbar + tabs   | FR-006, FR-007, FR-013, FR-017                 |
| Übersicht        | FR-006, FR-007, FR-008, Stories 2 and 3        |
| Verträge         | FR-001, FR-002, FR-008, FR-009, FR-012, FR-013 |
| Vertrag erfassen | FR-002, FR-003, FR-004, FR-005, FR-018         |
| Lückencheck      | FR-014, FR-015, FR-016, Story 6                |
| Erinnerungen     | FR-010, FR-011, Story 4                        |
| Leer             | Story 1 and 5 empty and linked cases           |

## Out of scope for this mockup

Validation error states, reminder email content, export dialog, dashboard widget, theme (dark) variant,
manual-override dialog for linked entries.

## Visual language

Approximates the PrimeNG Aura preset defaults (emerald primary); exact tokens follow the real theme in
the implementation. Charts will use ECharts in the real UI; the donut and bars here are CSS stand-ins.
