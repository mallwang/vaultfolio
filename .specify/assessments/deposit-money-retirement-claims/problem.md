# Problem Definition: Cash and Retirement Entitlements Missing from Tracked Wealth

- **Slug**: deposit-money-retirement-claims
- **Created**: 2026-09-04
- **Inputs used**: intake.md, research.md

## Problem Statement

Vaultfolio's asset-type model has no way to represent fiat cash balances (bank accounts, cash at home, broker/robo-advisor reference-account cash) or accrued retirement entitlements (employer pension accruals, Riester-Rente, insurance-based retirement products), so a user's tracked portfolio understates their actual personal wealth by omitting these holdings entirely, or forces them into an ill-fitting existing asset type just to get them tracked at all.

## Affected Users & Stakeholders

- **Users**: Markus Allwang, the sole user and product owner of Vaultfolio, using it to track his own personal investments — directly affected because cash and retirement claims are part of his real net worth today but have no home in the current data model. — [source: intake.md]
- **Stakeholders**: Markus Allwang, also acting as product owner/decision-maker — he decides whether and how this gets built, and is the only party with interest in the outcome, consistent with Vaultfolio being a single-user, self-hosted personal tool. — [source: research.md, "Users & Demand"]

## Goals

- Let the user record deposit money (bank balances, cash at home, broker/neobank/robo-advisor reference-account cash) as a trackable holding.
- Let the user record retirement claims (employer pension accruals, Riester-Rente, insurance-based retirement products) as a trackable holding.
- Bring the tracked portfolio closer to reflecting the user's actual total personal wealth.

## Non-Goals

- Deciding _how_ retirement claims should be valued (current accrued value vs. projected future value vs. both) or whether they need a vesting/access date — open design question, not settled here. — [NEEDS CLARIFICATION, carried from research.md]
- Building a total-wealth/net-worth aggregation feature — none exists yet in Vaultfolio (dashboard "total value" is currently a placeholder), so this problem is about making these holdings _representable_, not about how they roll up into a total. — [source: research.md, "Data & Constraints"]
- Deciding whether retirement claims should count toward the same wealth figure as liquid assets, or be shown separately/flagged as illiquid — this is the user's own stated open question, not resolved here.
- Live price-feed or bank/brokerage API integration for either type — both are manual-entry by nature, consistent with Vaultfolio's existing "no bank/brokerage API" design. — [source: research.md, "Data & Constraints"]
- Sub-classifying "deposit money" locations (bank vs. cash-at-home vs. broker cash) beyond what's decided during shaping — open question, not settled here.

## Success Metrics

- The user can enter a deposit-money holding (a cash balance at a given location) and a retirement-claim holding (a pension/insurance entitlement) through Vaultfolio's normal holdings-entry flow. (baseline: not possible today — no such asset types exist)
- The user's Vaultfolio-tracked holdings no longer omit cash and retirement entitlements he considers part of his personal wealth. (baseline: currently omitted entirely, or miscategorized under an unrelated asset type as a workaround) — qualitative, self-assessed by the sole user.

## Cost of Inaction

If this is never built, the user's tracked portfolio in Vaultfolio continues to understate his actual net worth: cash/deposit balances are omitted entirely, and retirement entitlements are either omitted or forced into a mismatched existing asset type (e.g., mislabeling a pension claim as a Share or ETF) just to make them visible at all. — [source: research.md, "Market & Context"]

## Open Questions

- [NEEDS CLARIFICATION: Should retirement claims be included in total net worth once a real total-wealth aggregate exists, shown as a separate/flagged illiquid figure, or both (toggle-able)? No existing total-wealth feature exists yet to anchor this decision against.]
- [NEEDS CLARIFICATION: What value does a retirement-claim holding record — current accrued value, projected value at retirement, or both? Is an access/vesting date required?]
- [NEEDS CLARIFICATION: Does "deposit money" need sub-classification (bank / cash-at-home / broker cash) beyond the free-text `name` + existing `Management` field, e.g. for filtering or reporting purposes?]
- [NEEDS CLARIFICATION: Does the existing `Management` field (already required on every holding) sufficiently capture "which employer / which insurer / which bank" for both new types, or is a dedicated field needed?]
- [NEEDS CLARIFICATION: Multi-currency handling for deposit money — is everything assumed EUR, or does the app already have a currency concept to reuse?]
