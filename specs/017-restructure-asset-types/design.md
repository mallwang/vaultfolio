# Design: Restructure Asset Types (Precious Metal / Crypto)

**Feature**: [spec.md](./spec.md)
**Status**: Approved

## Approach

This revises `specs/003-manual-holdings-entry/mockup.html`/`design.md` in place rather than
starting fresh — the Holdings area's overall shape (distribution panel, table, add/edit dialogs,
delete confirm) is unchanged; only the asset-type set, the fields that set drives, and two
UI elements that had drifted from 003's original design get updated.

Two changes in this feature are corrections, not new scope: while reviewing the mockup, the user
noticed the current app's "Add holding" dialog (a `p-select` dropdown for asset type) looks
nothing like 003's own approved design.md, which specified a 4-way button/card selector — and that
the "Distribution by value" panel, which 003's design.md showed on the Holdings page itself, was
in fact only wired up on the Dashboard (`holdings.component.ts`'s header comment documents this as
a deliberate relocation made during 003's implementation: _"The value-distribution view (FR-012a)
has moved to the dashboard's 'Allocation' card... it consumes the same
`app-holdings-distribution` component."_). The user asked to bring both in line with the original
design as part of this feature (FR-012, FR-013), since the type selector and the distribution
panel's grouping key are already being touched here for the Precious metal/Crypto rename.

```
List (default)                                    Add holding (modal)
┌───────────────────────────────────────┐         ┌─────────────────────────┐
│ Distribution by value  [donut]         │         │ Asset type               │
│ ETF·Share·Gold·Silver·Bitcoin·Ethereum │         │ [ETF][Share][PM][Crypto] │
│ (each holding, by name — FR-010)       │         │ Management               │
├───────────────────────────────────────┤         │ (type fields swap)       │
│ N holdings                    [+ Add] │  ═══▶    │ Name + weight/qty+price, │
│ ┌───┬──────┬────┬───┬─────┬────┐     │         │ [date opt.]              │
│ │Typ│Asset │Mgmt│Qty│Price│Date│     │         │          [Cancel][Save]  │
│ ├───┼──────┼────┼───┼─────┼────┤     │         └─────────────────────────┘
│ │PM │Gold  │... │...│ ... │ —  │     │
│ │PM │Silver│... │...│ ... │ —  │     │
│ │Cry│Bitcoin│...│...│ ... │... │     │
│ │Cry│Ethereum│..│...│ ... │... │     │
│ └───┴──────┴────┴───┴─────┴────┘     │
└───────────────────────────────────────┘
```

## Regions & states

- **Distribution panel** (`.distribution-panel`) — now rendered on **both** the Holdings page and
  the Dashboard (FR-013), using the same `app-holdings-distribution` component. Its legend groups
  Precious metal and Crypto holdings **individually by name** (Gold vs. Silver, Bitcoin vs.
  Ethereum as separate slices/percentages) rather than one summed slice per type (FR-010); ETF and
  Share keep their current per-type grouping — unchanged and out of scope here. This requires
  changing `holdings-distribution.component.ts`'s `recompute()` grouping key from `assetType` to
  `assetType + name` for Precious metal/Crypto specifically (`/speckit-plan` to work out the exact
  key and whether Management also factors in, to stay consistent with the list's own identity
  rule). The excluded-holding note (e.g. a Precious metal holding with no current value) is
  unchanged in behavior, just re-worded generically.
- **Holdings list** (`.holdings-table`) — same structure as 003; the type pill and per-row name
  now read "Precious metal"/"Gold" and "Crypto"/"Bitcoin" or "Crypto"/"Ethereum" etc. instead of
  "Gold"/"Gold" and "Bitcoin"/"Bitcoin". The crypto row icon changes from the Bitcoin-specific ₿
  glyph to a generic coin/token icon, since a Crypto holding is no longer necessarily Bitcoin. The
  `.lot-note` banner's wording updates: Precious metal's merge key is now **name + Management**
  (two different names under the same Management are always separate rows), not just "being
  Precious metal"; Crypto keeps its existing per-lot, never-merge behavior.
- **Add holding** (`add`) — satisfies FR-001–FR-006, FR-009, FR-012, User Stories 1–2. The type
  selector becomes a 4-option button/card group (ETF / Share / Precious metal / Crypto) that swaps
  the visible fieldset live, per FR-012 — replacing the current `p-select` dropdown. Precious metal
  and Crypto both gain a required **Name** field (FR-003, FR-004), placed as the first field in
  their fieldset, ahead of the fields they already had:
  - **Precious metal**: Name (free text, e.g. "Gold", "Silver", "Platinum"), weight in grams, optional current value — unchanged otherwise from Gold's prior field set.
  - **Crypto**: Name (free text, e.g. "Bitcoin", "Ethereum"), quantity, purchase price, purchase date marked "Optional" — unchanged otherwise from Bitcoin's prior field set.
- **Add — invalid** (`add-invalid`) — satisfies FR-009, SC-004, User Story 2 Acceptance Scenario 2. Static state (Crypto selected) showing inline field errors: missing Management, an empty
  required Name, negative quantity, and a future purchase date.
- **Edit — Crypto** (`edit-crypto`) — satisfies User Story 3, FR-010. Same locked-type pattern as
  003's edit dialog, but now includes the editable **Name** field (absent from the old Bitcoin-only
  edit form) alongside Management/quantity/price/date. Same pattern applies to editing
  ETF/Share/Precious-metal holdings (not separately mocked per type — see Out of scope).
- **Empty state**, **Delete confirm** — unchanged from 003 except wording ("precious metals, or
  crypto" instead of "gold, or bitcoin").

## Requirement traceability

| Spec item                                                                          | Region/state                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| FR-001, FR-002 (rename Gold→Precious metal, Bitcoin→Crypto)                        | Type pills, type selector, list rows, empty-state copy                                     |
| FR-003, FR-004, FR-009 (required free-text Name)                                   | Name field in Precious metal/Crypto fieldsets; Add-invalid Name error                      |
| FR-005, FR-006 (merge key: name+Management for Precious metal; per-lot for Crypto) | `.lot-note` banner wording; two same-type/different-name list rows                         |
| FR-007, FR-008 (one-time migration)                                                | Not a mockup concern — the "Gold"/"Bitcoin" list rows already reflect post-migration state |
| FR-010 (display by name everywhere, incl. distribution)                            | List rows' name column; distribution legend grouped by name                                |
| FR-011 (no new writes as Gold/Bitcoin)                                             | Type selector only offers Precious metal/Crypto, never Gold/Bitcoin                        |
| FR-012 (type selector as button/card group, not dropdown)                          | Add-holding dialog's `.type-select`                                                        |
| FR-013 (distribution panel also on Holdings page)                                  | `.distribution-panel` shown in the `list`/`list-empty` states                              |

## Out of scope for this mockup

- Editing ETF/Share/Precious-metal holdings — same pattern as "Edit — Crypto" (locked asset type,
  that type's fields incl. Name and Management) but not separately mocked for every type.
- Loading states, network errors, and the "already deleted elsewhere" edge case.
- The one-time data migration itself (FR-007, FR-008) — a backend/startup concern; its visible
  effect is what the migrated "Gold"/"Bitcoin" rows already look like in the mockup.
- Real form validation logic, persistence, routing, and the real Chart.js-backed `p-chart`
  rendering (the donut is a static CSS conic-gradient stand-in).
- The exact grouping key change inside `holdings-distribution.component.ts` (by name vs. by
  name+Management) — a `/speckit-plan` decision, not a layout concern.

## Visual language

Approximates this project's PrimeNG "Aura" preset defaults (emerald primary `#10b981`/`#059669`),
matching `specs/003-manual-holdings-entry/mockup.html`'s token set exactly, since this revises that
same screen rather than introducing a new one. Real components (`p-select` is being replaced by a
custom button group per FR-012; `p-dialog`, `p-inputnumber`, `p-datepicker`, `p-confirmdialog`,
`p-chart`) will replace the static markup during implementation.

## Mockup

Local copy (durable): [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/ade517d4-f7b3-46e5-af19-33fe859bab86
