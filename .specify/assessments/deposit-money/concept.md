# Concept: Deposit Money as a New Asset Type

- **Slug**: deposit-money
- **Created**: 2026-09-04
- **Recommended option**: Option A — Manual-value asset type, counted in current-wealth aggregation

## Options

### Option A — Manual-value asset type, counted in current-wealth aggregation

- **Sketch**: Add `DEPOSIT_MONEY` as a new entry in the existing `AssetType` union, following the `PRECIOUS_METAL` pattern already in the codebase: each holding needs a `name` (free text — e.g. "N26 checking", "Cash at home") plus a manually-entered `currentValue`, using the existing required `Management` field to identify the bank/institution. Because deposit money is fully accessible today (unlike retirement claims), it can be included directly in current-wealth aggregation with no illiquidity/timing caveats.
- **Appetite**: small
- **Trade-offs**: Wins: ships fast, reuses a proven pattern (schema, migration, UI form, validation all already exist for `PRECIOUS_METAL`), directly closes the "can't represent cash" gap, and has no ambiguity about whether it counts toward wealth (it always does — it's accessible now). Sacrifices: doesn't sub-classify deposit-money locations beyond free-text `name` + `Management` — acceptable per the user's own split, since this was flagged as a minor open question, not a blocker.
- **Rabbit holes**: Being tempted to design a dedicated location-taxonomy field instead of relying on free-text `name` + `Management`. Also: scope-creep into multi-currency support if not already handled by the app.

### Option B — Do nothing (workaround with existing types)

- **Sketch**: Keep recording bank/cash balances under an existing, ill-fitting asset type.
- **Appetite**: small (zero build cost)
- **Trade-offs**: Wins: no engineering cost. Sacrifices: perpetuates the exact problem — tracked wealth stays incomplete or mislabeled.
- **Rabbit holes**: None — included only as the required baseline comparison.

## Recommendation

Option A. It directly satisfies the problem's goals and success metrics at a `small` appetite, reuses the `PRECIOUS_METAL` precedent, and — unlike retirement claims — has no unresolved question about whether it belongs in current-wealth aggregation: deposit money is accessible today, so it counts. This is exactly the "clean, low-risk" feature the user identified when splitting it out from retirement claims.

## Out of Scope (for the recommended option)

- Retirement claims (separate assessment: `retirement-claims`).
- Total-wealth aggregation as a whole feature (may not exist yet — deposit money should integrate into whatever current-wealth aggregation already exists or is being built, not invent it).
- Live price feeds or bank/brokerage API integration.
- A dedicated sub-classification field for deposit-money location.

## Assumptions to Validate

- The existing `Management` field is sufficient to capture "which bank" without a dedicated provider field.
- A single free-text `name` field is sufficient to distinguish deposit-money locations (bank account vs. cash at home vs. broker reference cash).
- EUR (or the app's existing currency handling, if any) is sufficient for deposit money.
- A current-wealth aggregation concept exists or is imminent enough for "count it in current wealth" to be meaningful; if not, this holding still ships as trackable even before that aggregation exists.
