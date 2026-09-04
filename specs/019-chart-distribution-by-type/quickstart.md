# Quickstart: Validate Distribution Chart Grouped by Asset Type

## Prerequisites

- Node.js LTS, repo dependencies installed (`npm install` at repo root — this repo uses npm, not
  pnpm, per project convention).
- Full stack running locally (frontend + backend + SQLite), e.g. via the repo's
  `docker-compose.yml`, or `npm exec nx serve backend` and `npm exec nx serve frontend` in
  separate terminals.

## Automated validation (primary)

Run the frontend unit tests covering `HoldingsDistributionComponent`:

```bash
npm exec nx test frontend -- --testPathPattern=holdings-distribution
```

Expected: all tests pass, including the extended cases added for this feature (research.md #6):

- Two differently-named holdings of the same type (e.g. Crypto "Bitcoin" + "Ethereum") produce one
  chart entry whose `value` is the exact Decimal sum of both.
- The resulting entry's rendered slice name resolves to the type's `assetType.*` translation
  (e.g. "Crypto"/"Krypto"), never a holding's own `name`.
- A type with zero holdings, or whose holdings all lack a computable value, produces no entry.
- The excluded-holdings count is unaffected by the grouping change.

## Manual validation (end-to-end, matches spec Acceptance Scenarios)

1. Sign in and open the Holdings section.
2. Add holdings:
   - Crypto: "Bitcoin" (quantity/purchasePrice set) and "Ethereum" (quantity/purchasePrice set).
   - Deposit money: "Bargeld" and "Savings account" (currentValue set on each).
   - One holding each of ETF, Share, Precious metal (e.g. "Gold"), with computable values.
3. Open the dashboard/holdings page containing the distribution-by-value chart.
4. Verify:
   - Exactly one slice per asset type present (at most 5 slices total) — **SC-001**.
   - The Crypto slice's value equals Bitcoin's value + Ethereum's value, with no separate
     "Bitcoin"/"Ethereum" slices — **Acceptance Scenario 1, SC-002**.
   - The Deposit money slice sums "Bargeld" + "Savings account" — **Acceptance Scenario 2**.
   - Every slice label is a localized type name (e.g. "Crypto", "ETF") — never a holding's own
     name — **Acceptance Scenario 3/4, SC-003**.
   - Switch the app language (if applicable) and confirm slice labels relabel to the other
     language without changing slice values.
5. Add a holding with no computable value (e.g. Share with no quantity/purchasePrice) and confirm
   it is excluded from totals and reflected in the existing excluded-holdings note/count
   (unchanged behavior — FR-004).

## Contracts

Not applicable — this feature introduces no new or changed API/CLI/file-format contract (see
research.md #5). Refer to [data-model.md](./data-model.md) for the revised in-memory chart entry
shape.
