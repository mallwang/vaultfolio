# Decision: Retirement Claims as a New Asset Type

- **Slug**: retirement-claims
- **Decided**: 2026-09-04
- **Verdict**: needs-clarification
- **Artifacts reviewed**: problem.md, concept.md (both split from deposit-money-retirement-claims per user direction)

## Scorecard

| Criterion              | Rating   | Justification                                                                                                                                                                                                                                                      |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem validity       | strong   | The user states retirement claims are personally-owned wealth, just not accessible today — a real, if lower-urgency, gap.                                                                                                                                          |
| Evidence strength      | adequate | Internal precedent (`PRECIOUS_METAL`) shows a manual-value shape is feasible, but there's no evidence yet resolving how valuation (accrued vs. projected) or aggregation timing should work — that's the open question, not a evidence gap in the research itself. |
| Value vs. inaction     | adequate | Real but lower urgency than deposit money — the user themself prioritized deposit money first specifically because this one isn't ready.                                                                                                                           |
| Feasibility / appetite | unknown  | No option was recommended in concept.md — both sketched options depend on decisions (UI treatment, current-vs-total-wealth calculation) that haven't been made.                                                                                                    |
| Strategic fit          | adequate | Fits the product's manual-entry, personal-wealth-tracking purpose in principle, but the _shape_ of that fit is unresolved.                                                                                                                                         |
| Risk posture           | weak     | The central risk — building the wrong shape before knowing how retirement claims should factor into wealth calculations — is identified but explicitly unmitigated by design (deferred, not solved).                                                               |

## Verdict & Rationale

**Needs-clarification.** Feasibility/appetite is `unknown` (no recommended concept option) and risk posture is `weak` (the core UI/calculation risk is acknowledged but not addressed) — per the gate, a `go` requires a recommended concept option and cannot rest on unresolved risk. This matches the user's own reasoning for splitting the original idea: retirement claims need clarification on UI and on current-wealth-vs-total-wealth calculation before this is ready to hand to `/speckit-specify`.

## If needs-clarification

- **Blocking questions**:
  - [NEEDS CLARIFICATION: Should retirement claims be included in total net worth once a real total-wealth aggregate exists, shown separately/flagged as illiquid, or both?]
  - [NEEDS CLARIFICATION: What value does a retirement-claim holding record — current accrued value, projected value at retirement, or both? Is an access/vesting date required?]
  - [NEEDS CLARIFICATION: What should the UI for entering/displaying a retirement claim look like, given it isn't a simple "current value" like other asset types?]
  - [NEEDS CLARIFICATION: How should retirement claims factor into "total wealth" vs. "current wealth" — are these two different aggregate figures the app needs to show?]
- **Revisit stage**: shape (`/speckit-assess-shape slug=retirement-claims`) once the above are answered — likely after the `deposit-money` feature (and any current-wealth aggregation it introduces) ships, since that gives this assessment something concrete to anchor the total-vs-current-wealth question against.
