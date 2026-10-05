# Contract: `@vaultfolio/insurances` library

Pure TypeScript, no NestJS/Angular imports, `decimal.js` for money, calendar dates as `YYYY-MM-DD`
strings. Used by the backend (validation, reminder deadline) and the frontend (all derived views).

## Exports

```text
// validation.ts
validateContract(input: unknown): Contract                    // throws InsurancesValidationError { field, code }
validateSettings(input: unknown): Settings

// catalog.ts
INSURANCE_TYPES: readonly InsuranceTypeDef[]                  // id, group, classification, detailFields, usuallyIncludedIn
REQUIREMENTS: readonly RequirementDef[]                       // id, classification, appliesWhen, satisfiedBy
typeDef(id): InsuranceTypeDef

// premium.ts
paymentsPerYear(interval): 12 | 4 | 2 | 1
yearlyCost(contract): Decimal
monthlyCost(contract): Decimal
paymentMonths(contract): number[]                             // 1..12
isActiveIn(contract, year, month): boolean

// deadline.ts
nextCancellationDate(contract, today: Date): CancellationInfo
// CancellationInfo = { kind: 'DEADLINE', date, termEnd } | { kind: 'ENDS', date } | { kind: 'ANYTIME', period } | { kind: 'NONE' }

// summary.ts
summarize(input: { contracts, linkedSocial, includeSocial, year, today, warnDays }): Summary
// Summary = { monthlyPrivate, yearlyPrivate, monthlyStatutory, yearlyStatutory, activeCount, statutoryCount,
//   byGroup[{ group, yearly, share }], timeline[12]{ month, amount }, upcoming[{ id, name, date, daysLeft, withinWindow }] }

// social.ts
linkedLinesFromEarnings(records): LinkedSocialLine[]          // latest period, regular part of health/care/pension/unemployment
effectiveSocialLines(contracts, linked): LinkedSocialLine[]   // drops lines suppressed by an active manual contract

// gap-check.ts
checkGaps(input: { contracts, profile, dismissedRequirements }): GapResult
// GapResult = { missing[], covered[], dismissed[], redundant[] }, each item with requirement/type id, classification, reason code
```

## Behavioural guarantees

- All money values are decimal strings in, `Decimal` internally, formatted with 2 digits `ROUND_HALF_UP`
  once at the edge; totals are summed unrounded.
- `nextCancellationDate` is pure and total: same input, same output; no clocks, no time zones.
- `checkGaps` never reports `OPTIONAL` requirements as missing; dismissed requirements are listed under
  `dismissed` only.
- `validate*` rejects unknown fields, wrong types and rule violations from data-model.md; error codes are
  stable strings (`REQUIRED`, `INVALID`, `UNKNOWN_FIELD`, `OUT_OF_RANGE`, `DATE_ORDER`, `LIMIT`).
- Catalog and requirement ids are stable identifiers stored in user data; renames require a migration.

## Testing

Exact-decimal tests for every interval and totals; table-driven deadline tests (month-end clamping, leap
day, fixed 30.11., renewal after a passed deadline, ended, open-ended, weeks vs months); gap tests per
profile combination incl. combination products and dismissals; whitelist tests.
