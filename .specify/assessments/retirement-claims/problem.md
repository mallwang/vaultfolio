# Problem Definition: Retirement Entitlements Missing from Tracked Wealth

- **Slug**: retirement-claims
- **Created**: 2026-09-04
- **Inputs used**: Split from deposit-money-retirement-claims/{intake.md, research.md, problem.md} per user direction — deferred to a later assessment because it needs clarification on UI and on how it factors into total wealth vs. current wealth (unlike deposit money, split out to its own `go` assessment).

## Problem Statement

Vaultfolio's asset-type model has no way to represent accrued, not-yet-accessible retirement entitlements (employer pension accruals, Riester-Rente, insurance-based retirement products), so these holdings — which belong to the user personally but are only realizable in the future — are invisible in the tracked portfolio or must be misrepresented under an unrelated asset type.

## Affected Users & Stakeholders

- **Users**: Markus Allwang, the sole user and product owner of Vaultfolio — affected because retirement claims are part of his personal wealth, just not accessible today, and he is explicitly unsure how they should be treated. — [source: intake.md]
- **Stakeholders**: Markus Allwang, also the sole decision-maker on scope and design.

## Goals

- Let the user record retirement claims (employer pension accruals, Riester-Rente, insurance-based retirement products) as a trackable holding, once the open design questions below are resolved.

## Non-Goals

- Deposit money / cash balances — split out to a separate assessment (`deposit-money`), already decided `go`, since it has no comparable design ambiguity.
- Deciding the total-wealth aggregation feature itself — that feature doesn't yet exist in Vaultfolio.
- Live price-feed or actuarial projection integration — any valuation here would be manual entry only.

## Success Metrics

- Not yet defined — blocked on resolving how a retirement claim should be valued and displayed (see Open Questions). Revisit once those are answered.

## Cost of Inaction

Retirement claims remain untracked or are misrepresented under an unrelated asset type; this is judged lower-urgency than deposit money because the user themself is unsure of the right treatment, so building it before that's resolved risks the wrong shape.

## Open Questions

- [NEEDS CLARIFICATION: Should retirement claims be included in total net worth once a real total-wealth aggregate exists, shown separately/flagged as illiquid, or both (toggle-able)? No existing total-wealth feature exists yet to anchor this decision against.]
- [NEEDS CLARIFICATION: What value does a retirement-claim holding record — current accrued value, projected value at retirement, or both? Is an access/vesting date required?]
- [NEEDS CLARIFICATION: What should the UI for entering/displaying a retirement claim look like, given it isn't a simple "current value" like other asset types?]
- [NEEDS CLARIFICATION: How should retirement claims factor into "total wealth" vs. "current wealth" — are these two different aggregate figures the app needs to show?]
- [NEEDS CLARIFICATION: Does the existing `Management` field sufficiently capture "which employer/insurer" for this type, or is a dedicated field needed?]
