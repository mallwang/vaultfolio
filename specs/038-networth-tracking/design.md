# Design: Vermögensentwicklung (Net-Worth Tracking)

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/artifact/8vpDQiK9EBsDuiX9onk99b (this remote link may go stale; the local copy is
the source of truth). Approved as-is in the first review round. All names and amounts in the mockup
are invented.

## Summary

The Historic Wealth Development domain is a page inside the existing authenticated app shell with the
nav entry "Vermögen". It has one toolbar and two tabs, Entwicklung and Bilanz, plus a separate
snapshot form, empty and single-snapshot states, a dashboard tile and a PDF report. German UI text
throughout.

## Layout per region

### Toolbar + tabs (Entwicklung, Bilanz, empty, single)

```
Zeitraum [1 Jahr | 3 Jahre | Alle]        [⬇ Daten exportieren] [+ Stichtag erfassen (primary)]
 Entwicklung | Bilanz
```

- The period filter is shared by both tabs and by the PDF (FR-012, FR-015).
- "Daten exportieren" is the shared export link that opens the existing export dialog.

### Entwicklung (Story 3, FR-008–FR-013)

- Four KPI tiles: Nettovermögen (hero, with reference date), Veränderung (absolute and percent versus
  the previous snapshot), Vermögenswerte, Verbindlichkeiten.
- Chart panel: one stacked column per snapshot; assets stack upward by class, liabilities hang below
  the zero line (hatched, red), a line with markers shows the net worth. The legend chips toggle each
  class, liabilities and the net-worth line on and off.
- Snapshot table, newest first: Stichtag, Vermögenswerte, Verbindlichkeiten, Nettovermögen,
  Veränderung, percent, row actions edit / copy as template / delete. The oldest snapshot in the
  period shows "–" for the change. The newest row is highlighted.

### Ein Stichtag (Story 3, scenario 3)

KPIs with "–" for the change, an info note explaining that a second snapshot is needed and offering
"Früheren Stichtag nachtragen", and a composition bar by class with percentages.

### Leer (Story 3, scenario 4)

Centered panel with a short explanation and the call to action "Ersten Stichtag erfassen".

### Bilanz (Story 5, FR-023–FR-027)

- Header with the reference-date select (default: latest snapshot).
- Two columns, Aktiva (left) and Passiva (right). Aktiva grouped into Liquide Mittel, Wertpapiere und
  Krypto, Sachwerte, Sonstiges; each row shows name, class and amount. Passiva lists Eigenkapital
  (Nettovermögen, computed) first, then langfristige, kurzfristige and sonstige Verbindlichkeiten.
  Empty groups show "Keine Positionen". Both columns end with an identical "Summe".
- Info note with the group selector for a class ("Übernehmen"); the change applies to all snapshots
  (FR-026). A warning note states that no ratios are computed in this version (FR-027).
- Mobile: the two columns stack, Aktiva first.

### Stichtag erfassen (Story 1 and 2, FR-001–FR-007, FR-017)

- Panel "Stichtag": date, "Aus bestehendem Stichtag kopieren" select, optional note.
- Panel "Vermögenswerte" and panel "Verbindlichkeiten": rows with Name, Klasse (free text with
  suggestions below the list) and Betrag, each with a remove button; "hinzufügen" buttons per panel.
  Amounts are always positive; the panel decides the side (FR-002, FR-022).
- Inline prompt for the balance group when a new class name is typed ("Neue Klasse „Whisky" – in
  welche Bilanzgruppe soll sie?"); asked once per class (FR-025).
- Sticky summary on the right (desktop) with Vermögenswerte, Verbindlichkeiten, Nettovermögen,
  "Stichtag speichern" and "Abbrechen". On mobile it stacks below.
- State "Datum bereits vergeben": danger note naming the date with "Bestehenden Stichtag öffnen"
  (FR-005).

### Dashboard tile (Story 4, FR-014)

Whole tile is a link. With data: Nettovermögen (hero), change versus the previous snapshot with
percent and reference date, sparkline, rows Vermögenswerte and Verbindlichkeiten, link "Zur
Vermögensentwicklung". Variants: only one snapshot (hero value plus hint and "Stichtag erfassen"),
no data (short text and "Ersten Stichtag erfassen"). The tile shows no balance sheet.

### PDF report (Story 6, FR-015)

Landscape, two pages. Page 1: header with logo, title and period, four KPI tiles, development chart
with the same encoding as on screen, class table for the latest snapshot with change. Page 2:
balance sheet of the latest snapshot in the period. Footer with creation date and page number.

### Responsive

Mobile: sidebar collapses to the top bar; KPI tiles 2×2; chart switches to a compact aspect ratio;
the snapshot table scrolls horizontally inside its container; balance sheet and form stack to one
column.

## Requirement coverage

| Region                 | Spec items                                   |
| ---------------------- | -------------------------------------------- |
| Toolbar, period filter | FR-012, FR-015                               |
| Entwicklung            | Story 3, FR-008–FR-013, SC-003, SC-005       |
| Ein Stichtag, Leer     | Story 3 scenarios 3 and 4, FR-013            |
| Bilanz                 | Story 5, FR-023–FR-027, FR-022               |
| Stichtag erfassen      | Story 1 and 2, FR-001–FR-007, FR-017, FR-022 |
| Dashboard tile         | Story 4, FR-014                              |
| PDF report             | Story 6, FR-015, SC-006                      |

## Decisions confirmed by the mockup

- The balance sheet is a second tab, not a section below the snapshot table.
- The balance group of a new class is requested inline in the form, not deferred to the balance sheet.
- Liabilities hang below the zero line in the chart; the net worth is a line, not a stacked series.
- The dashboard tile shows no balance sheet.

## Out of scope for the mockup

- Validation messages beyond the duplicate-date state (FR-017), including future dates and negative
  amounts.
- Encryption, access control, log hygiene and account deletion (FR-018, FR-019, FR-021).
- Translations beyond German (FR-020) and keyboard and screen-reader behavior of the chart.
- The export dialog itself (reused from the existing export feature) and tile ordering/visibility
  settings (reused).
- Percentage display against a zero or negative previous net worth ("n/a", see Edge Cases).

## Visual language

Approximates the app's current teal PrimeNG theme with light and dark tokens. The real
implementation uses PrimeNG components and the existing `--p-primary-color` tokens; chart colors per
class are finalized during implementation and must remain distinguishable in both themes.
