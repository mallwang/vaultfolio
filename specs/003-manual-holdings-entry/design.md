# Design: Manual Holdings Entry

**Feature**: [spec.md](./spec.md)
**Status**: Approved (revision 2 — updated for the 2026-08-28 Clarifications session)

## Approach

The Holdings area (already scaffolded by
[002-primeng-app-structure](../002-primeng-app-structure/spec.md)) gets a real content region: a
value-distribution panel, a table listing every holding, an "Add holding" action that opens a
modal form, per-row edit/delete actions, and a delete confirmation modal. The add/edit form's
field set is driven entirely by asset type — a 4-way type selector (ETF / Share / Gold / Bitcoin)
swaps the visible fields live when adding; when editing, the type is fixed to the holding's own
type (no selector), and only that type's fields render. Every holding — of every type — includes a
required **Management** field (free text identifying who holds it: "Private", "Roboadvisor", a
bank name), shown as its own list column and as the first field below the type selector in both
dialogs.

```
List (default)                                    Add holding (modal)
┌───────────────────────────────────┐             ┌───────────────────────┐
│ Distribution by value  [donut]     │             │ Asset type             │
│ ETF 5.6% · Share 1.3% · Gold 6.3%  │             │ [ETF][Share][Gold][₿]  │
│ · Bitcoin 86.8% · 1 Gold excluded  │             │ Management             │
├───────────────────────────────────┤             │ (type fields swap)     │
│ N holdings                [+ Add] │   ═══▶       │ ISIN/Name or Weight or │
│ ┌───┬──────┬────┬───┬─────┬────┐ │             │ Qty+Price, [date opt.] │
│ │Typ│Asset │Mgmt│Qty│Price│Date│ │             │        [Cancel][Save]  │
│ ├───┼──────┼────┼───┼─────┼────┤ │             └───────────────────────┘
│ │...│      │    │   │     │ —  │ │
│ └───┴──────┴────┴───┴─────┴────┘ │
└───────────────────────────────────┘
```

## Regions & states

- **Distribution panel** (`.distribution-panel`, top of `.app-content`) — satisfies FR-012a. A
  donut (CSS conic-gradient stand-in for the real `p-chart`/Chart.js rendering) plus a legend,
  grouped by asset type, showing each type's share of total portfolio value (quantity × price for
  ETF/Share/Bitcoin, entered current value for Gold). A note below the legend explicitly calls out
  any holding excluded from the percentages for having no known value (e.g. a Gold holding with no
  current value entered) — never silently counted as zero.
- **Holdings list** (`.holdings-table` inside `.app-content`) — satisfies FR-012. One row per
  holding: a type pill (icon + label), identifying details (name/ISIN, or "Gold"/"Bitcoin"),
  **Management**, quantity or weight, price/value or a muted "—" when none is recorded (e.g. Gold
  with no current value entered), purchase date or "—" for types/rows that don't have one
  (including every ETF and Gold row, which never have a purchase date field at all), and edit/
  delete row actions. A muted `.lot-note` banner explains the merge rule: ETF/Gold show one row per
  asset + Management combination (repeat submissions for the same identifier + Management replace
  that row rather than adding a new one), while Share/Bitcoin always add a new, independent lot —
  demonstrated by two Bitcoin rows under the same Management that still don't merge.
- **Empty state** (`list-empty`) — satisfies FR-013, User Story 2 Acceptance Scenario 5. Icon +
  message + primary "Add your first holding" action.
- **Add holding** (`add` — modal dialog) — satisfies FR-001–FR-009, User Story 1. A 4-option type
  selector (interactive in the mockup — actually swaps field groups), followed by the universal
  Management field, followed by that type's complete field set (each type's fieldset is now
  self-contained, including its own quantity/price/date so a type without a field never renders a
  shared block for it):
  - **ETF**: ISIN, name, quantity, average purchase price — no purchase date field at all.
  - **Share**: ISIN, name, quantity, purchase price, purchase date marked "Optional".
  - **Gold**: weight in grams (no unit selector, no purity), optional current value used only for
    the distribution panel.
  - **Bitcoin**: quantity, purchase price, purchase date marked "Optional".
- **Add — invalid** (`add-invalid`) — satisfies FR-009, FR-010, SC-002. Static state (Bitcoin
  selected) showing inline field errors: missing Management, negative quantity, and a future
  purchase date — each with a specific correction message.
- **Edit — Bitcoin** (`edit-bitcoin`) — satisfies FR-014, and demonstrates that the edit form
  adapts per type exactly like the add form: the asset-type control is shown locked (not a
  selector), the Management field is editable, and only Bitcoin's fields appear — no ISIN/name, no
  weight/current-value. Same pattern applies to editing ETF/Share/Gold holdings (not separately
  mocked per type — see Out of scope).
- **Delete confirm** (`delete` — modal dialog) — satisfies FR-016, User Story 4. Centered icon +
  holding summary (now including Management) + explicit Cancel/Delete actions.

## Requirement traceability

| Spec item                                                                 | Region/state                                                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| FR-001, FR-002 (asset types, universal Management)                        | Type selector + Management field in both dialogs, Management column                      |
| FR-003–FR-007 (per-type required/optional fields)                         | Add holding dialog's four fieldsets                                                      |
| FR-008 (only the current type's fields render, incl. on edit)             | Add holding type-swap; Edit — Bitcoin's locked/scoped fields                             |
| FR-009, FR-010 (validation)                                               | Add — invalid state                                                                      |
| FR-011 (Share/Bitcoin always a new lot)                                   | Holdings list — two Bitcoin rows under the same Management + `.lot-note`                 |
| FR-011a (ETF/Gold upsert by identifier + Management)                      | Holdings list — ETF/Gold rows split only by Management + `.lot-note`, fieldset hint text |
| FR-012, FR-013 (list display, empty state)                                | Holdings list / List — empty                                                             |
| FR-012a (distribution view, excluding valueless holdings)                 | Distribution panel                                                                       |
| FR-014, FR-015 (edit, cancel)                                             | Edit — Bitcoin state; Cancel button in every dialog                                      |
| FR-016 (delete + confirm)                                                 | Delete confirm state                                                                     |
| FR-017 (single base currency)                                             | "All amounts shown in EUR" toolbar note; no currency field anywhere                      |
| User Story 1 (Acceptance Scenarios 1–7, incl. optional date, no ETF date) | Add holding + Add — invalid states                                                       |
| User Story 2 (Acceptance Scenarios 1–5, incl. distribution)               | Holdings list, `.lot-note`, distribution panel, List — empty                             |
| User Story 3 (edit + per-type adaptation)                                 | Edit — Bitcoin state                                                                     |
| User Story 4                                                              | Delete confirm state                                                                     |

## Out of scope for this mockup

- **FR-018, FR-019** (no market-data lookups; persistence across sessions) — behavioral, not
  layout concerns.
- Editing ETF/Share/Gold holdings as separate mocked states — "Edit — Bitcoin" establishes the
  pattern (locked type, type-scoped fields, editable Management); the other three types follow the
  same rule.
- The real `p-chart`/Chart.js rendering — the distribution panel's donut is a static CSS
  conic-gradient stand-in with hard-coded percentages, not a live computation.
- Sorting/filtering a large holdings list (Edge Cases) — an interaction detail for the real
  implementation, not a layout question here.
- Loading states, network errors, and the "already deleted elsewhere" edge case — resilience
  behavior, not layout.
- Real PrimeNG components (`p-select`, `p-dialog`, `p-inputnumber`, `p-datepicker`,
  `p-confirmdialog`, `p-chart`), routing, and persistence — every state here is static or
  client-side-only.

## Visual language note

PrimeNG is wired up in `apps/frontend` as of this feature (Aura preset, default emerald primary,
Inter font, PrimeIcons) — this mockup mirrors the _real_ current tokens (`--p-primary-color`,
`--p-content-border-color`, etc.) rather than approximating them, and adds a `--p-share` token
(distinct from ETF's green) purely so the new distribution chart's legend can tell Share apart
from ETF at a glance — the existing `.type-pill` colors for ETF/Share are unchanged. PrimeIcons
itself isn't loadable in the artifact sandbox (CSP), so icons are inlined as an SVG sprite
standing in 1:1 for the real `pi-*` classes used in `apps/frontend`.

## Revision history

- **Revision 2** (this revision, 2026-08-28): Re-reviewed after the spec's Clarifications session
  added the universal Management field, changed ETF/Gold from always-new-lots to
  upsert-by-identifier-and-Management, collapsed Gold to weight-in-grams + optional current value
  (dropping unit/purity), removed ETF's purchase date field entirely, and added the FR-012a
  distribution-by-value view. All of the above are now reflected in the mockup and this file.
- **Revision 1** (original review): Established purchase date as optional (not required) for
  Share/Bitcoin, and that the edit form must adapt per asset type the same way the add form does.

## Mockup

Local copy (durable): [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/3c0008c8-5a13-40e6-9758-2a10be9db771
