# Data Model: Altersvorsorge (Retirement Planning)

All money values are exact decimals (canonical strings, EUR, `decimal.js`), never floats. Ownership:
every row has `owner_id`; every query filters by it.

## Table `retirement_records`

One row per pension entry (statutory record, occupational contract, private contract).

| Column           | Type               | Notes                                                                                           |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `id`             | TEXT PK            | UUID                                                                                            |
| `owner_id`       | TEXT NOT NULL      | owner; cascade on account deletion (explicit purge, like Earnings)                              |
| `pillar`         | TEXT NOT NULL      | `STATUTORY` \| `OCCUPATIONAL` \| `PRIVATE`                                                      |
| `contract_type`  | TEXT NOT NULL      | see types below; must match the pillar                                                          |
| `origin`         | TEXT NOT NULL      | `IMPORTED` \| `MANUAL`                                                                          |
| `status`         | TEXT NOT NULL      | `ACTIVE` \| `PAID_UP` \| `IN_PAYOUT` (statutory: always `ACTIVE`)                               |
| `provider_label` | TEXT NULL          | employer/provider display label, ≤ 80 chars, plain (non-monetary lookup)                        |
| `statement_date` | TEXT NOT NULL      | `YYYY-MM-DD`, date of the statement/letter the figures stem from                                |
| `payout_start`   | TEXT NULL          | `YYYY-MM-DD`, expected start of payout (statutory: regular retirement date)                     |
| `parser_id`      | TEXT NULL          | set for `IMPORTED`                                                                              |
| `parser_version` | TEXT NULL          | set for `IMPORTED`                                                                              |
| `ocr_read`       | INTEGER NOT NULL 0 | 1 if the text came from on-device recognition (shows "double-check" marker); not encrypted data |
| `payload_enc`    | TEXT NOT NULL      | AES-256-GCM ciphertext of the payload below (`v1:iv:tag:ciphertext`)                            |
| `key_version`    | INTEGER NOT NULL 1 |                                                                                                 |
| `created_at`     | TEXT NOT NULL      | ISO timestamp                                                                                   |
| `updated_at`     | TEXT NOT NULL      | ISO timestamp                                                                                   |

Constraints and indexes (idempotent `CREATE … IF NOT EXISTS`):

- `CHECK` on `pillar`, `origin`, `status`, `contract_type ↔ pillar` pairing, date shapes.
- `CHECK (origin = 'MANUAL' OR (parser_id IS NOT NULL AND parser_version IS NOT NULL))`.
- Unique partial index: `UNIQUE (owner_id) WHERE pillar = 'STATUTORY'` — at most one statutory record.
- Index `(owner_id, pillar)`.

Contract types by pillar:

| Pillar         | `contract_type` values                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `STATUTORY`    | `STATUTORY_PENSION`                                                                                             |
| `OCCUPATIONAL` | `DIRECT_INSURANCE`, `PENSIONSKASSE`, `DIREKTZUSAGE`, `UNTERSTUETZUNGSKASSE`, `PENSIONSFONDS`, `CAPITAL_ACCOUNT` |
| `PRIVATE`      | `RIESTER`, `PRIVATE_PENSION_INSURANCE`, `ALTERSVORSORGEDEPOT`                                                   |

## Encrypted payload (JSON, inside `payload_enc`)

AAD: `retirement_records|<id>|<owner_id>`.

```text
{
  identifier?: string,          // insurance number (statutory) or contract/depot/reference number, ≤ 40 chars
  figures:     { ... },         // from the document (IMPORTED) or typed (MANUAL); see per-type fields
  supplement?: { ... }          // IMPORTED only: figures the document does not print (R5)
}
```

For `MANUAL` records everything lives in `figures`; `supplement` is absent. For `IMPORTED` records
`figures` is immutable after save; only `supplement` can change.

### Figures per type (all optional unless marked required; amounts as decimal strings)

**Statutory** (`STATUTORY_PENSION`) — required: `projectedMonthly`

| Field                   | Meaning                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `dataPeriodFrom/To`     | period the stored DRV data covers (`YYYY-MM-DD`)            |
| `fullDisabilityMonthly` | monthly pension on full reduction in earning capacity       |
| `accruedMonthly`        | pension accrued so far, at today's level, per month         |
| `projectedMonthly`      | projected regular old-age pension per month (no adjustment) |
| `projectedAt1Pct`       | printed projection at 1 % annual adjustment                 |
| `projectedAt2Pct`       | printed projection at 2 % annual adjustment                 |
| `earningsPoints`        | Entgeltpunkte (decimal, 4 places)                           |
| `currentPensionValue`   | aktueller Rentenwert per earnings point                     |
| `contributionsOwn`      | contributions paid by the user                              |
| `contributionsEmployer` | contributions paid by employers                             |
| `contributionsPublic`   | contributions paid by public bodies                         |

`payout_start` (plain column) = regular retirement date.

**Occupational / Private pension contract** (`DIRECT_INSURANCE`, `PENSIONSKASSE`, `DIREKTZUSAGE`,
`UNTERSTUETZUNGSKASSE`, `PENSIONSFONDS`, `RIESTER`, `PRIVATE_PENSION_INSURANCE`)

| Field                  | Meaning                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `guaranteedMonthly`    | guaranteed pension at payout start                                            |
| `expectedMonthly`      | expected pension (projection)                                                 |
| `guaranteedCapital`    | guaranteed pension capital at payout start                                    |
| `scenarioMonthly`      | `{ "0": …, "3": …, "6": …, "9": … }` printed projections (private statements) |
| `currentValue`         | current fund value / account value                                            |
| `contributionsPaid`    | contributions paid to date (incl. subsidies where printed)                    |
| `surrenderValue`       | value on cancellation                                                         |
| `deathBenefit`         | benefit on death                                                              |
| `guaranteePeriodYears` | pension guarantee period                                                      |
| `capitalPayout`        | optional one-time capital payout                                              |

**Capital account** (`CAPITAL_ACCOUNT`, occupational) — required: `accountBalance`

| Field                    | Meaning                                |
| ------------------------ | -------------------------------------- |
| `openingBalance`         | balance at start of the statement year |
| `accountBalance`         | balance at the statement date          |
| `guaranteedInterestRate` | percent, decimal string                |
| `interestCredit`         | interest credited in the period        |
| `annualContribution`     | contribution credited in the period    |
| `finalBonus`             | hypothetical final bonus (projection)  |

**Altersvorsorgedepot** (`ALTERSVORSORGEDEPOT`): `currentValue` and optional `expectedMonthly`; no
guaranteed figures (`guaranteedMonthly` must be absent).

### Supplement (IMPORTED only; also editable via `PATCH …/supplement`)

| Field                         | Applies to                        | Meaning                                                                                     |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `contributionMonthly`         | occupational, private             | current monthly contribution (employee/own share)                                           |
| `employerContributionMonthly` | occupational                      | employer share per month                                                                    |
| `subsidiesYearly`             | `RIESTER`                         | state subsidies per year                                                                    |
| `expectedMonthly`             | capital account                   | optional expected monthly pension                                                           |
| `expectedScenario`            | private statements with scenarios | `"0"` \| `"3"` \| `"6"` \| `"9"` (default `"3"`), picks `scenarioMonthly` as expected value |

The contract `status` stays in its plain column and may also be changed through the PATCH route.

For `MANUAL` records the same fields live in `figures` (`contributionMonthly`,
`employerContributionMonthly`, `subsidiesYearly`) and are freely editable.

## Validation rules (`@vaultfolio/retirement`, enforced identically on the device and the server)

- Strict whitelist per `contract_type`: any unknown field → `400 RETIREMENT_UNKNOWN_FIELD`; fields
  not applicable to the type → same error (e.g. `guaranteedMonthly` on `ALTERSVORSORGEDEPOT`).
- Amounts: canonical decimal strings, ≥ 0, ≤ 2 decimals (rates ≤ 4, earnings points ≤ 4), upper bounds
  to reject typos (monthly pensions ≤ 100 000, capital ≤ 100 000 000).
- Dates: valid `YYYY-MM-DD`; `statement_date` not in the future; `payout_start` between 1 year before
  and 80 years after the statement date.
- `guaranteedMonthly ≤ expectedMonthly` when both are present (spec FR-006).
- Required fields per type as listed above; `provider_label` required for occupational and private.
- Identifier: ≤ 40 chars, letters/digits/space/`-`/`/`/`.` only.
- Imported records additionally pass the parser's plausibility checks (see below) before the client
  sends them, and the server re-runs the same checks from the figures.

## Plausibility checks (shared by parsers and server)

| Check id                    | Applies to         | Rule                                                                |
| --------------------------- | ------------------ | ------------------------------------------------------------------- |
| `STATUTORY_POINTS_VALUE`    | statutory          | `earningsPoints × currentPensionValue = accruedMonthly` (±0.01)     |
| `STATUTORY_ORDER`           | statutory          | `accrued ≤ projected ≤ at1Pct ≤ at2Pct`; `fullDisability ≥ accrued` |
| `STATUTORY_DATES`           | statutory          | `payout_start` after `statement_date`; data period ends before it   |
| `SCENARIOS_MONOTONIC`       | private statements | `0 ≤ 3 ≤ 6 ≤ 9`                                                     |
| `GUARANTEE_BELOW_ZERO_CASE` | private statements | `guaranteedMonthly ≤ scenarioMonthly["0"]`                          |
| `CONTRIBUTION_SUM`          | private statements | main contributions + extra payments = total paid (when all printed) |
| `ACCOUNT_ROLL_FORWARD`      | capital account    | `opening + interestCredit + annualContribution = accountBalance`    |
| `ACCOUNT_INTEREST`          | capital account    | `interestCredit ≈ opening × rate` (±0.01)                           |

A failing check in an import rejects the document as a whole (client side, before sending) and, if
sent anyway, is rejected by the server with `400 RETIREMENT_CHECK_FAILED` listing the check ids only
(never figures).

## Derived: Retirement summary (not stored)

Computed by `@vaultfolio/retirement` from decrypted rows (rules in research R8):

```text
RetirementSummary {
  expectedMonthly, guaranteedMonthly, differenceMonthly, monthlySavings,   // decimal strings
  pensionStart: { date, source: 'STATUTORY' | 'EARLIEST_CONTRACT' } | null,
  capital: { total, items[] },                                              // not part of monthly sums
  pillars: { statutory, occupational, private }: { count, guaranteedMonthly, expectedMonthly, items[] },
  flags: { outdatedCount, incompleteCount },
  items[]: { id, pillar, contractType, origin, providerLabel, guaranteedMonthly, expectedMonthly,
             capital, payoutStart, startRelation: 'EARLIER' | 'SAME' | 'LATER' | null,
             outdated, incomplete }
}
```

## State and lifecycle

- `MANUAL` record: create → edit (any field) → delete.
- `IMPORTED` record: create (from a confirmed review) → edit **supplement only** → replace (new import
  with `replaces`, same transaction deletes the old row) → delete.
- Statutory manual → imported: allowed only through replace with explicit user confirmation in the UI
  (spec Story 1); the reverse (imported → manual) is delete + manual create.
- Account deletion purges all rows of the owner (`users.repository` purge list); "delete all my
  retirement data" purges all rows of the owner without touching the account.
- Missing/invalid key: no read, no write (`503 RETIREMENT_UNAVAILABLE`).
