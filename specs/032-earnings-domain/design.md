# Design: Earnings Domain

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/artifact/Y6aW3VKbc3ofeuHusRMkVE (this remote link may go stale; the local copy is
the source of truth).

## Summary

The Earnings domain is a page inside the existing authenticated app shell (sidebar + header) with a
new "Earnings" / "Einkommensentwicklung" nav entry. It brings the earnings-evolution overview into
Vaultfolio, but splits its single long page into **four sub-tabs** — Overview, Tables, Data check,
Imports — and adds an **import flow** (upload-only, no manual entry) plus the edge states the spec
calls for (empty, key unavailable). All figures in the mockup are invented example data (two
fictional employers, 2012–2026). The mockup was approved as-is in the first review round.

## Layout per region

### App shell (reused)

Unchanged `app-shell` / `app-sidebar` / `app-header`. A new nav item "Earnings" (DE
"Einkommensentwicklung") is added via `DOMAIN_REGISTRY`, shown only to entitled users. Header title
is the domain name; on the import screen it is "Import documents".

### Domain toolbar + sub-tabs (all data screens)

```
[Employer: All employers ▾]  🔒 How your data is protected        [Export (info)] [⬆ Import documents (primary)]
 Overview | Tables | Data check (1) | Imports
```

- Employer filter (all / one) applies to every data view (FR-023).
- "How your data is protected" link jumps to the privacy note on the Imports tab (FR-035).
- Export button uses the shared 029 export capability, "info" severity, left of the primary
  action — same placement rule as "Add holding" (FR-040).
- "Import documents" is the primary action (FR-005–FR-007).
- The Data check tab carries a warning-colored count badge when any year check fails.

### Overview tab (FR-024–FR-029, FR-033 surfacing)

Top to bottom:

1. **Data-check warning strip** (only when issues exist): "Data check found 1 issue. One month in
   2019 is missing. [Open data check]".
2. **Career summary** — accordion: "Whole career" (open by default, only when >1 employer) plus one
   row per employer. Summary row: name · period · months (· employers) · total gross right-aligned.
   Expanded body: six mini tiles (gross, net, taxes, social insurance, bonus, net ratio), each with
   "Ø per month" (FR-024).
3. **Latest-year KPI tiles** — heading "2026 (9 months)", subline "Compared with the same months of
   2025 (Jan–Sep)". Six tiles: gross, net, taxes, social insurance, bonus, net ratio; delta arrow
   plus previous value. Taxes/social increases render in the "bad" color, net/gross/bonus increases
   in the "good" color; net ratio delta in percentage points (FR-025). **Decision**: an incomplete
   latest year is compared with the same months of the previous year, not the full previous year.
4. **Gross per year** — stacked bars (regular pay + bonus/one-off), value label on top,
   Total / Per month employed toggle (FR-026).
5. **Where the gross goes, month by month** — stacked bars net + taxes + social = gross, bonus
   months marked by a dot above the bar, dashed vertical line at employer changes, range presets
   1Y / 3Y / All (default 3Y), selected month outlined; clicking a bar opens its month detail
   (FR-027).
6. **Two-column row** (stacks on mobile): deduction ratios line chart (taxes %, social %, per
   calendar year, last value labeled — FR-028) | **Month detail** (FR-029): heading month, subline
   "N payslip sections · Gross · Net", then one statement per section: employer, kind tag
   (Payslip / Correction, correction shows "issued <month>"), source file name, check status, and
   the statement rows Regular pay/Back pay → Gross (total gross) → Taxes (expandable individual
   taxes) → Social insurance (expandable KV/PV/RV/AV) → Statutory net → Other deductions/additions
   (for a correction: "Paid out with the <month> payslip") → Payout (regular payslips only).
   Individual amounts in a secondary column, subtotals in the main column, deductions negative.

### Tables tab (FR-030–FR-032)

1. **Month by month** grid: years × Jan–Dec + Sum, metric select (gross, regular pay, bonus &
   one-off, net, taxes, social insurance, payout), red dot for bonus months, missing months inside
   an employment year shown as a red "!", months outside employment "–", cells clickable → month
   detail (jumps to Overview with that month selected).
2. **All taxes and contributions per year**: year, employer(s), months, gross, of which bonus, tax
   gross, wage tax, Soli, church tax, KV/PV/RV/AV (EN: Health/Care/Pension/Unempl.), taxes %,
   social %.
3. **Wage-tax certificates**: year, employer, gross wage, wage tax, Soli, church tax, source file
   name, sum row.

All wide tables scroll horizontally inside their own container (never the page).

### Data check tab (FR-033)

Warning strip with the actionable hint ("Import the missing payslip for Mar 2019 to resolve
this."), then a table per employer and year: Year-to-date totals (✓ N values match / ✗ N values
differ), Wage-tax certificate (✓ / ✗ / "– not available"), Months complete (✓ complete / ✗ <month>
missing). A year with a late correction shows the exclusion note under its YTD result ("1
correction issued after the last payslip excluded (Apr 2022)").

### Imports tab (FR-021, FR-037, FR-038, FR-020, FR-042)

1. **Privacy note** — three cards: "Documents stay on your device", "Only figures, no
   identifiers" (mentions encryption), "Only you can see it" (admins included; operator runs the
   server and holds the key).
2. **Import history** table, grouped by the year the data belongs to (one collapsible header per
   year with the import count, all years collapsed on load, "Expand all"/"Collapse all" toggle): file, type (Payslip PDF / Wage-tax certificate PDF / Companion-tool
   export), periods, records, "Read with" (parser + version), imported date, delete icon.
3. **Employer names**: per detected employer, "Detected as <full name>" + display-name input +
   Save. Copy states figures cannot be edited.
4. **Danger zone** (red border): "Delete all earnings data" with explanation that other Vaultfolio
   data is unaffected.

### Import screen (US1, US3, US4; FR-008–FR-016, FR-022)

- "‹ Back to earnings" link.
- **Dropzone**: title, "Files are read on this device. Nothing is saved until you confirm below.",
  "Choose files" button, chips for the three supported formats.
- Info banner "Documents stay on your device" (FR-008).
- Progress line "Read 7 of 7 files" + progress bar (FR-022).
- **File list**, one row per file: status icon (✓ green / – grey / ✕ red) · file name + "format ·
  employer" · periods (with "includes correction" tag when applicable) · checks result · status
  tag (New / Replaces / Duplicate / Rejected). Sub-lines explain replace ("Replaces the Aug 2026
  figures imported on 2 Sep 2026"), duplicate ("Already imported on … Skipped."), and rejection
  reasons in red — failing check with month and difference (FR-012) or "format not supported yet"
  with the companion-tool hint for scans (FR-014).
- One row can expand "Figures that will be sent" — a label/value grid of exactly the whitelisted
  figures for a record (FR-008, FR-017).
- **Footer**: summary chips ("4 files ready (57 records)", "1 skipped", "2 rejected") · Cancel ·
  primary "Import 4 files".

### Empty state (FR-034)

Centered icon, "No earnings yet", explanation that only supported formats are read and nothing can
be typed in, primary "Import documents", format chips, followed by the privacy note cards.

### Key unavailable state (FR-044)

Centered danger-tinted icon, "Earnings data is temporarily unavailable", explanation that nothing is
shown and no imports are accepted, data is not lost, contact the instance operator. No toolbar,
tabs, or figures are rendered.

### Dashboard widget (FR-036, US7)

Card "Earnings 2026" with "Open ›" link; three KPIs (gross, net with delta vs. same months of the
previous year, net ratio with "Jan–Sep" caption). Sits in the dashboard grid like other widgets.

### Mobile (~400px, FR-049)

Sidebar becomes the horizontal top bar; toolbar wraps; tabs scroll horizontally; mini tiles and KPI
tiles go to two columns; charts keep full width with fewer axis labels; two-column row stacks;
tables and statements scroll inside their containers; import rows move periods/checks under the
file name.

## Requirement traceability

| Spec item                            | Region                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------- |
| FR-001, FR-002                       | Nav entry, app shell                                                      |
| FR-004                               | Absence of any figure input anywhere; empty-state and employer-names copy |
| FR-005–FR-007, FR-010, FR-014–FR-016 | Import screen dropzone, format chips, file rows, status tags              |
| FR-008, FR-009, FR-017               | Device banner, "Figures that will be sent" expansion                      |
| FR-011, FR-012                       | Checks column, rejection reason text                                      |
| FR-020                               | Imports tab → Employer names                                              |
| FR-021, FR-037                       | Imports tab → Import history + delete icon                                |
| FR-022                               | Import progress line                                                      |
| FR-023                               | Employer filter in toolbar                                                |
| FR-024                               | Career summary accordion                                                  |
| FR-025                               | Latest-year KPI tiles                                                     |
| FR-026, FR-027, FR-028               | Gross per year, month-by-month, deduction ratio charts                    |
| FR-029                               | Month detail statement                                                    |
| FR-030, FR-031, FR-032               | Tables tab                                                                |
| FR-033                               | Data check tab + Overview warning strip + tab badge                       |
| FR-034                               | Empty state                                                               |
| FR-035, FR-042                       | Privacy note (Imports tab, empty state), toolbar link, import banner      |
| FR-036                               | Dashboard widget                                                          |
| FR-038                               | Danger zone                                                               |
| FR-040                               | Export button (029 capability)                                            |
| FR-044                               | Key unavailable state                                                     |
| FR-046, FR-047, FR-048               | EN/DE toggle; locale formatting (`€1,234` / `1.234 €`); glossary terms    |
| FR-049                               | Light/dark toggle, mobile viewport                                        |

## Out of scope for this mockup

- Confirmation dialogs for "Delete import" and "Delete all earnings data", and the rename save
  feedback — plan-time details (use the app's existing confirm-dialog pattern).
- Export menu contents (shared 029 capability; only the button is shown).
- Conflict display for the same month appearing twice in one batch (spec Edge Cases) — same row
  pattern with a "Replaces"/conflict note; exact copy is a plan-time detail.
- Real parsing timing/progress granularity, password-protected/corrupted PDF messages (same
  rejected-row pattern with their own reason text).
- Non-functional requirements without a UI surface: server-side re-validation (FR-013),
  fingerprinting (FR-015), encryption (FR-041), log hygiene (FR-043), no external services
  (FR-045), account lifecycle (FR-039).

## Visual language note

Uses the same approximated PrimeNG Aura tokens as prior Vaultfolio mockups (indigo primary
`#6366f1`, Inter, info-severity export button) with a dark variant for the theme toggle. Series
colors keep the five validated roles from earnings-evolution — net (blue), taxes (orange), social
insurance (teal), regular pay (indigo = app primary), bonus (red) — and must be re-validated for
contrast in both themes against the real Aura tokens when the ECharts theme is implemented. Icons
in the mockup are inline SVG stand-ins; the implementation uses Material Symbols via `vf-icon` per
the constitution (e.g. `payments` for the nav entry).
