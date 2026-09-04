# Concept: Retirement Claims as a New Asset Type

- **Slug**: retirement-claims
- **Created**: 2026-09-04
- **Recommended option**: none — deferred pending clarification

## Options

### Option A — Bare manual-value asset type (same shape as deposit money)

- **Sketch**: Add `RETIREMENT_CLAIM` with just `name` + manually-entered `currentValue`, no vesting date, no accrued/projected split, no illiquidity flag.
- **Appetite**: small
- **Trade-offs**: Wins: fast, reuses the same pattern as deposit money. Sacrifices: loses the "not accessible yet" nuance the user explicitly cares about; risks a misleadingly precise number sitting alongside fully-liquid holdings once any total-wealth view exists.
- **Rabbit holes**: Silently answering "does this count toward current wealth?" by omission (it would, by default, look identical to deposit money) — the user has said this needs explicit thought, not a default.

### Option B — Richer retirement-claim modeling

- **Sketch**: Separate `currentAccruedValue`/`projectedValue` fields, optional vesting/access date, explicit illiquid/future-dated marker, and a UI that visually distinguishes it from current-wealth holdings.
- **Appetite**: medium
- **Trade-offs**: Wins: honest modeling, matches the user's own stated hesitation. Sacrifices: no existing precedent in the codebase to lean on; requires deciding how it interacts with current-wealth vs. total-wealth aggregation, which is explicitly unresolved.
- **Rabbit holes**: Projected-value/actuarial logic scope creep; designing UI/aggregation behavior before knowing what "total wealth" even means in this app.

## Recommendation

**None yet.** Per the user's own direction, this is deliberately deferred rather than forced into a small-appetite shape now — the UI treatment and the current-wealth-vs-total-wealth calculation question are real unknowns that would make either option above a guess. Revisit with `/speckit-assess-shape slug=retirement-claims` once those are clarified (see problem.md Open Questions), likely after the `deposit-money` feature and any current-wealth aggregation work land, since that aggregation is a prerequisite for reasoning about how retirement claims should factor in.

## Out of Scope (for now)

- Deposit money (separate assessment: `deposit-money`, already `go`).
- Any total-wealth aggregation design — a prerequisite this assessment depends on, not something it should invent.

## Assumptions to Validate

- Whether a "total wealth" figure distinct from "current wealth" is something the user actually wants, or whether retirement claims should simply be excluded from aggregation and shown informationally only.
- Whether the user wants entry now (with a simple shape) accepting future rework, or wants to wait until the shape is right.
