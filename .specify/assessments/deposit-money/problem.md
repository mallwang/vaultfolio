# Problem Definition: Deposit Money Missing from Tracked Wealth

- **Slug**: deposit-money
- **Created**: 2026-09-04
- **Inputs used**: Split from deposit-money-retirement-claims/{intake.md, research.md, problem.md} per user direction — deposit money can be built and counted in current wealth aggregation now; retirement claims are split out to a separate, later assessment (see `retirement-claims`).

## Problem Statement

Vaultfolio's asset-type model has no way to represent fiat cash balances (bank accounts, cash at home, broker/robo-advisor reference-account cash), so a user's tracked portfolio understates their actual, currently-accessible net worth by omitting these holdings entirely.

## Affected Users & Stakeholders

- **Users**: Markus Allwang, the sole user and product owner of Vaultfolio — directly affected because cash balances are part of his real, currently-accessible net worth but have no home in the current data model. — [source: intake.md]
- **Stakeholders**: Markus Allwang, also the sole decision-maker on scope and design.

## Goals

- Let the user record deposit money (bank balances, cash at home, broker/neobank/robo-advisor reference-account cash) as a trackable holding.
- Count deposit money in the same current-wealth aggregation as existing asset types, since — unlike retirement claims — it is fully accessible today and carries no valuation ambiguity.

## Non-Goals

- Retirement claims / future entitlements — split out to a separate assessment (`retirement-claims`) because they raise open questions about UI and total-vs-current-wealth calculation that deposit money does not.
- Live price-feed or bank/brokerage API integration — manual entry only, consistent with Vaultfolio's existing design.
- Sub-classifying deposit-money locations (bank vs. cash-at-home vs. broker cash) beyond what's decided during shaping.
- Multi-currency support beyond what the app already handles, unless shaping determines it's needed.

## Success Metrics

- The user can enter a deposit-money holding (a cash balance at a given location) through Vaultfolio's normal holdings-entry flow. (baseline: not possible today)
- Deposit-money holdings are included in current-wealth aggregation. (baseline: currently omitted entirely, or miscategorized under an unrelated asset type as a workaround)

## Cost of Inaction

The user's tracked portfolio continues to omit cash/deposit balances entirely, understating currently-accessible net worth, or the user keeps working around it by mislabeling cash under an unrelated asset type.

## Open Questions

- [NEEDS CLARIFICATION: Does "deposit money" need sub-classification (bank / cash-at-home / broker cash) beyond the free-text `name` + existing `Management` field, e.g. for filtering or reporting purposes?]
- [NEEDS CLARIFICATION: Does the existing `Management` field sufficiently capture "which bank" for this type, or is a dedicated field needed?]
- [NEEDS CLARIFICATION: Multi-currency handling for deposit money — is everything assumed EUR, or does the app already have a currency concept to reuse?]
