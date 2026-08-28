# Design: Manual Holdings Entry

**Feature**: [spec.md](./spec.md)
**Status**: Approved

## Approach

The Holdings area (already scaffolded by
[002-primeng-app-structure](../002-primeng-app-structure/spec.md)) gets a real content region: a
table listing every holding lot, an "Add holding" action that opens a modal form, per-row
edit/delete actions, and a delete confirmation modal. The add/edit form's field set is driven
entirely by asset type — a 4-way type selector (ETF / Share / Gold / Bitcoin) swaps the visible
fields live when adding; when editing, the type is fixed to the holding's own type (no selector),
and only that type's fields render.

```
List (default)                          Add holding (modal)
┌─────────────────────────────┐         ┌───────────────────────┐
│ N holdings         [+ Add]  │         │ Asset type             │
│ ┌───┬──────┬───┬─────┬────┐ │         │ [ETF][Share][Gold][₿]  │
│ │Typ│Asset │Qty│Price│Date│ │   ═══▶  │ (fields swap per type) │
│ ├───┼──────┼───┼─────┼────┤ │         │ Quantity   Price       │
│ │...│      │   │     │ —  │ │         │ Purchase date [opt.]   │
│ └───┴──────┴───┴─────┴────┘ │         │        [Cancel][Save]  │
└─────────────────────────────┘         └───────────────────────┘
```

## Regions & states

- **Holdings list** (`.holdings-table` inside `.app-content`) — satisfies FR-010, FR-016. One row
  per lot: a type pill (icon + label), identifying details (name/ISIN, "1 oz bar · 999.9 fine", or
  "Bitcoin"), quantity, purchase price, purchase date or "—" when none was recorded, and edit/
  delete row actions. A muted `.lot-note` banner calls out that same-asset lots (two ETF rows, two
  Bitcoin rows in the mockup) are intentionally not merged (User Story 2, Acceptance Scenario 2).
- **Empty state** (`list-empty`) — satisfies FR-011, User Story 2 Acceptance Scenario 3. Icon +
  message + primary "Add your first holding" action, replacing the current placeholder empty row.
- **Add holding** (`add` — modal dialog) — satisfies FR-001–FR-006, User Story 1. A 4-option type
  selector (interactive in the mockup — actually swaps field groups) followed by: type-specific
  fields (ISIN + name for ETF/Share; weight + unit + purity for Gold; none for Bitcoin), then the
  common fields (quantity, purchase price, purchase date marked "Optional" with a hint that it can
  be left blank).
- **Add — invalid** (`add-invalid`) — satisfies FR-007, FR-008, SC-002. Static state showing
  inline field errors: negative quantity, missing purity, and a future purchase date — each with a
  specific correction message, including a reminder that the date field can simply be left empty.
- **Edit — Bitcoin** (`edit-bitcoin`) — satisfies FR-012, and directly addresses the user's
  clarification that the edit form must adapt per type: the asset-type control is shown locked
  (not a selector) and only Bitcoin's fields appear — no ISIN/name, no weight/purity. Same pattern
  applies to editing ETF/Share/Gold holdings (not separately mocked per type — see Out of scope).
- **Delete confirm** (`delete` — modal dialog) — satisfies FR-014, User Story 4. Centered icon +
  holding summary + explicit Cancel/Delete actions.

## Requirement traceability

| Spec item                                                              | Region/state                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| FR-001–FR-006 (asset types, required/optional fields, per-type fields) | Add holding dialog, interactive type selector                       |
| FR-007, FR-008 (validation)                                            | Add — invalid state                                                 |
| FR-009 (separate lots, no merge)                                       | Holdings list — duplicate ETF/Bitcoin rows + `.lot-note`            |
| FR-010, FR-011 (list display, empty state)                             | Holdings list / List — empty                                        |
| FR-012, FR-013 (edit, cancel)                                          | Edit — Bitcoin state; Cancel button in every dialog                 |
| FR-014 (delete + confirm)                                              | Delete confirm state                                                |
| FR-015 (single base currency)                                          | "All amounts shown in EUR" toolbar note; no currency field anywhere |
| User Story 1 (Acceptance Scenarios 1–7, incl. optional date)           | Add holding + Add — invalid states                                  |
| User Story 2 (Acceptance Scenarios 1–3)                                | Holdings list, `.lot-note`, List — empty                            |
| User Story 3 (edit + per-type adaptation)                              | Edit — Bitcoin state                                                |
| User Story 4                                                           | Delete confirm state                                                |

## Out of scope for this mockup

- **FR-016, FR-017** (no market-data lookups; persistence across sessions) — behavioral, not
  layout concerns.
- Editing ETF/Share/Gold holdings as separate mocked states — "Edit — Bitcoin" establishes the
  pattern (locked type, type-scoped fields); the other three types follow the same rule.
- Sorting/filtering a large holdings list (Edge Cases) — an interaction detail for the real
  implementation, not a layout question here.
- Loading states, network errors, and the "already deleted elsewhere" edge case — resilience
  behavior, not layout.
- Real PrimeNG components (`p-select`, `p-dialog`, `p-inputnumber`, `p-datepicker`,
  `p-confirmdialog`), routing, and persistence — every state here is static or client-side-only.

## Visual language note

PrimeNG is wired up in `apps/frontend` as of this feature (Aura preset, default emerald primary,
Inter font, PrimeIcons) — unlike 002's mockup, this one mirrors the _real_ current tokens
(`--p-primary-color`, `--p-content-border-color`, etc.) rather than approximating them. PrimeIcons
itself isn't loadable in the artifact sandbox (CSP), so icons are inlined as an SVG sprite
standing in 1:1 for the real `pi-*` classes used in `apps/frontend`.

## Clarifications from review

- **Purchase date is optional**, not required — a user who only wants to record what they
  currently hold (no interest in historic performance) can leave it blank. This changed FR-002,
  FR-006, FR-007, FR-010, FR-012, and related Edge Cases/Success Criteria/Assumptions in spec.md.
- **The edit form must adapt per asset type** the same way the add form does — no gold weight/
  purity fields when editing a Bitcoin holding, etc. FR-006 and FR-012 were tightened to state this
  explicitly, and the "Edit — Bitcoin" state was added to demonstrate it.

## Mockup

Local copy (durable): [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/6fad3889-0dcc-4be6-a9c4-8559c9c2ea54
