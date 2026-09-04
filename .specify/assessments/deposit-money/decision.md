# Decision: Deposit Money as a New Asset Type

- **Slug**: deposit-money
- **Decided**: 2026-09-04
- **Verdict**: go
- **Artifacts reviewed**: problem.md, concept.md (both split from deposit-money-retirement-claims per user direction; underlying research.md/intake.md carried over from the original combined assessment)

## Scorecard

| Criterion              | Rating | Justification                                                                                                                                                                                                                          |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem validity       | strong | Sole user directly states cash balances are part of his real, currently-accessible net worth but untracked today.                                                                                                                      |
| Evidence strength      | strong | `PRECIOUS_METAL` in `libs/domain/holdings/src/lib/asset-type.ts` is a directly analogous, already-shipped precedent; 017-restructure-asset-types shows the enum-extension/migration pattern works.                                     |
| Value vs. inaction     | strong | Without this, tracked portfolio omits or mislabels cash — a concrete, ongoing gap in the tool's core purpose.                                                                                                                          |
| Feasibility / appetite | strong | Option A fits `small` appetite by directly reusing the `PRECIOUS_METAL` schema/migration/UI pattern; no new architectural surface.                                                                                                     |
| Strategic fit          | strong | Matches Library-First/API-First constitution principles; no new integration surface (manual entry only, as the app already is).                                                                                                        |
| Risk posture           | strong | Unlike retirement claims, deposit money has no ambiguity about whether it belongs in current-wealth aggregation — it's accessible today, so it always counts. The user's own split isolated exactly this simplicity into this feature. |

## Verdict & Rationale

**Go.** All six criteria score `strong`. This is the clean half of the original combined idea: no unresolved valuation or aggregation-timing question, a proven schema precedent to reuse, and a small appetite. The user explicitly separated it from retirement claims specifically because it has none of that feature's open design questions.

## If go — Handoff to `/speckit-specify`

- **Problem**: Vaultfolio has no asset type for fiat cash balances (bank/home/broker reference-account cash), so tracked holdings understate the user's currently-accessible net worth.
- **Chosen approach**: Concept Option A — add `DEPOSIT_MONEY` to the `AssetType` union, requiring a free-text `name` and manually-entered `currentValue`, reusing the existing `Management` field for the bank/institution — same shape and migration pattern as `PRECIOUS_METAL`. Included directly in current-wealth aggregation.
- **In scope**: New `DEPOSIT_MONEY` asset-type enum value, its field requirements (`name` + `currentValue`, no ISIN/quantity/price feed), holdings-entry UI and validation, one-time data migration, inclusion in current-wealth aggregation.
- **Out of scope**: Retirement claims (separate assessment: `retirement-claims`); building total-wealth aggregation as a whole feature; live price feeds/bank API integration; dedicated sub-classification field for deposit-money location.
- **Success metrics**: User can enter a deposit-money holding through the normal holdings-entry flow (baseline: not possible today); deposit-money holdings are included in current-wealth aggregation (baseline: currently omitted or miscategorized).
- **Carried-forward open questions**:
  - Does deposit money need sub-classification beyond free-text `name` + `Management`?
  - Does `Management` sufficiently capture "which bank," or is a dedicated field needed?
  - Multi-currency handling — assume EUR, or reuse an existing currency concept if one exists?
