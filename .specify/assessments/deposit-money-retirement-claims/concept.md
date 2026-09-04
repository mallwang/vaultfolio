# Concept: Cash and Retirement Entitlements as New Asset Types

- **Slug**: deposit-money-retirement-claims
- **Created**: 2026-09-04
- **Recommended option**: Option A — Two new manual-value asset types

## Options

### Option A — Two new manual-value asset types

- **Sketch**: Add `DEPOSIT_MONEY` and `RETIREMENT_CLAIM` as two new entries in the existing `AssetType` union, following the `PRECIOUS_METAL` pattern already in the codebase: each holding needs a `name` (free text — e.g. "N26 checking", "Cash at home", "Riester-Rente Allianz") plus a manually-entered `currentValue`, using the existing required `Management` field to capture the bank/employer/insurer. No ISIN, no quantity, no price feed, no vesting date, no liquidity flag — the user enters a value and updates it manually over time, exactly like they already do for precious metals. This is the "make it representable" option: it doesn't answer whether these should count toward a future total-wealth aggregate, because that feature doesn't exist yet.
- **Appetite**: small
- **Trade-offs**: Wins: ships fast, reuses a proven pattern (schema, migration, UI form, validation all already exist for `PRECIOUS_METAL`), directly closes the "can't represent this holding at all" gap. Sacrifices: doesn't capture retirement-claim nuance (accrued vs. projected value, vesting/access date) — the user records one number and loses the "this isn't accessible yet" distinction they explicitly cared about in the intake note. No illiquid/liquid flag anywhere in the data model, so once a total-wealth view is built, retirement claims and bank cash will look identical to an ETF holding in aggregate — a follow-up decision, not a blocker today.
- **Rabbit holes**: Being tempted to also design the total-wealth aggregation or liquidity-flag logic "while we're in there" — that's out of scope per problem.md's non-goals and would blow a small appetite into a medium/large one. Also: deciding sub-classification for deposit-money locations (bank vs. cash-at-home vs. broker cash) could balloon if treated as a new field/taxonomy instead of relying on the existing free-text `name` + `Management` fields.

### Option B — Two new asset types with richer retirement-claim modeling

- **Sketch**: Same as Option A for `DEPOSIT_MONEY`, but `RETIREMENT_CLAIM` gets a dedicated shape: separate `currentAccruedValue` and `projectedValue` fields, an optional `vestingDate`/`accessDate`, and a boolean or enum marking it illiquid/future-dated. This directly answers several of problem.md's open questions up front instead of deferring them.
- **Appetite**: medium
- **Trade-offs**: Wins: produces a more honest, less misleading model for retirement claims — exactly the nuance the user flagged as their own hesitation in the intake note. Sacrifices: requires new schema fields, new UI, and new validation rules with no existing precedent in the codebase to lean on (unlike `PRECIOUS_METAL`); also requires deciding _now_ how projected/accrued values interact with any future total-wealth total, which problem.md explicitly treats as a non-goal — this option quietly pulls that non-goal back into scope.
- **Rabbit holes**: "Projected value at retirement" invites scope creep toward actuarial/projection logic (interest assumptions, contribution schedules) that is well beyond a manual-entry personal tracker. Defining what "illiquid" means and how it should behave (excluded from totals? shown with a badge? filterable?) has no answer without the not-yet-built total-wealth feature to anchor it — risks speculative design.

### Option C — Do nothing (workaround with existing types)

- **Sketch**: Keep using an existing asset type as a workaround (e.g. record a bank balance or pension claim as a `PRECIOUS_METAL`-shaped holding with a misleading name) rather than adding new types.
- **Appetite**: small (zero build cost)
- **Trade-offs**: Wins: no engineering cost at all. Sacrifices: perpetuates the exact problem stated in problem.md — the user's tracked wealth stays misleading or incomplete, and any future reporting/filtering by asset type breaks for these mislabeled holdings.
- **Rabbit holes**: None — but it doesn't solve anything, so it's included only as the required baseline comparison.

## Recommendation

Option A. It directly satisfies problem.md's goals (make deposit money and retirement claims representable) and success metrics (user can enter both holding types through the normal flow) at a `small` appetite, by reusing the `PRECIOUS_METAL` precedent the research already identified as the closest fit. It deliberately leaves the harder questions — retirement-claim projected value, vesting dates, illiquid/liquid flagging, total-wealth aggregation — open rather than guessing at them, consistent with problem.md's non-goals. Option B answers more of the user's own stated hesitation but does so by speculatively designing around a total-wealth feature that doesn't exist yet, which risks building the wrong shape. Option C doesn't solve the problem at all.

## Out of Scope (for the recommended option)

- Total-wealth/net-worth aggregation (inherited non-goal — feature doesn't exist yet).
- Liquid vs. illiquid flagging or filtering.
- Projected-value / accrual modeling, vesting or access dates for retirement claims.
- Live price feeds or bank/brokerage API integration for either type.
- A dedicated sub-classification field for deposit-money location — relies on existing `name` + `Management` fields instead.

## Assumptions to Validate

- The existing `Management` field is sufficient to capture "which bank / which employer / which insurer" for both new types, without a dedicated provider field.
- A single free-text `name` field is sufficient to distinguish deposit-money locations (bank account vs. cash at home vs. broker reference cash) for the user's purposes, the same way it already distinguishes Gold/Silver/Platinum under `PRECIOUS_METAL`.
- Recording one manually-entered `currentValue` for a retirement claim (with no vesting date or accrued/projected split) is acceptable to the user as a first cut, even though they flagged this as an open uncertainty in the original idea.
- EUR (or the app's existing currency handling, if any) is sufficient for deposit money — no new multi-currency work is needed.
