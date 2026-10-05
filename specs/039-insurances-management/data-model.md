# Data Model: Versicherungen (Insurances Management)

## Stored

### `insurance_contracts`

| Column        | Type | Notes                                                                        |
| ------------- | ---- | ---------------------------------------------------------------------------- |
| `id`          | TEXT | primary key (UUID)                                                           |
| `owner_id`    | TEXT | not null; every query is owner-scoped                                        |
| `payload_enc` | TEXT | `v1:` AES-256-GCM of the payload below, AAD `insurance_contracts\|id\|owner` |
| `key_version` | INT  | default 1                                                                    |
| `created_at`  | TEXT | ISO timestamp                                                                |
| `updated_at`  | TEXT | ISO timestamp                                                                |

Index `insurance_contracts_owner_idx (owner_id)`.

Payload (strict whitelist; any other field is rejected):

```text
Contract = {
  type: InsuranceTypeId,                 // catalog id (FR-004)
  alsoCovers?: InsuranceTypeId[],        // combination products, ≤ 10, no duplicates, not the own type
  name: string,                          // 1..100
  insurer?: string,                      // ≤ 100
  contractNumber?: string,               // ≤ 50, encrypted, owner-only
  status: 'ACTIVE' | 'CANCELLED' | 'ENDED',
  startDate: Date,                       // YYYY-MM-DD
  endDate?: Date,                        // ≥ startDate
  premium: Money,                        // decimal string, 2 fractional digits, ≥ 0
  interval: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY',
  paymentMonth?: 1..12,                  // only for non-monthly
  cancellation: {
    period?: { value: 0..60, unit: 'WEEKS' | 'MONTHS' },
    autoRenew: boolean,
    renewalMonths?: 1..60,               // default 12; only with autoRenew
    minimumTermMonths?: 1..600,          // default 12 when no endDate
    fixedDate?: { day: 1..31, month: 1..12 }
  },
  reminderEnabled: boolean,              // default true; effective only if global switch is on
  details?: {                            // only keys allowed for the type (catalog detailFields)
    coverageSum?: Money, deductible?: Money, insuredMonthlyBenefit?: Money,
    insuredSum?: Money, licensePlate?: string, noClaimsClass?: string
  },
  note?: string                          // ≤ 500
}
```

Limit: 200 contracts per owner.

### `insurance_settings`

| Column        | Type | Notes                                  |
| ------------- | ---- | -------------------------------------- |
| `owner_id`    | TEXT | primary key                            |
| `payload_enc` | TEXT | AAD `insurance_settings\|owner\|owner` |
| `key_version` | INT  | default 1                              |
| `updated_at`  | TEXT | ISO timestamp                          |

Payload (strict whitelist):

```text
Settings = {
  profile: {
    ownsProperty: boolean, ownsCar: boolean, hasChildren: boolean,
    hasPets: boolean, travelsAbroad: boolean,
    employment: 'EMPLOYED' | 'SELF_EMPLOYED' | 'CIVIL_SERVANT' | 'OTHER'
  },
  reminders: { enabled: boolean, leadDays: 7..120 },    // default { false, 30 }
  dismissedRequirements: RequirementId[],               // ≤ 50
  includeSocial: boolean                                // default true
}
```

A missing row means the defaults above (profile flags false, employment `EMPLOYED`).

### `insurance_reminder_log`

| Column          | Type | Notes         |
| --------------- | ---- | ------------- |
| `owner_id`      | TEXT | not null      |
| `contract_id`   | TEXT | not null      |
| `deadline_date` | TEXT | `YYYY-MM-DD`  |
| `sent_at`       | TEXT | ISO timestamp |

Primary key `(contract_id, deadline_date)`. No names, no amounts. Rows are deleted with the contract,
and all rows of an owner with the account or with delete-all.

## Derived (never stored)

| Name               | Source                                         | Rules                                                                                              |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PremiumSchedule`  | contract                                       | yearly = premium × payments per year; monthly = yearly / 12; payment months per interval (R4)      |
| `CancellationInfo` | contract + today                               | `DEADLINE` / `ENDS` / `ANYTIME` / `NONE` (R3)                                                      |
| `LinkedSocialLine` | Earnings regular amounts of the latest period  | up to four lines `{ kind, monthly, period }`; suppressed by an active manual contract of that kind |
| `Summary`          | active contracts (+ linked if `includeSocial`) | monthly and yearly total, split private/statutory, by group, timeline per year, upcoming deadlines |
| `GapResult`        | contracts + profile + dismissals               | `missing`, `covered`, `dismissed`, `redundant` (R5)                                                |

## Catalog (static, in the lib)

Types (id → group, classification):

| Group     | Types                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERSONS   | `STATUTORY_HEALTH`, `STATUTORY_CARE`, `STATUTORY_PENSION`, `STATUTORY_UNEMPLOYMENT` (social, monthly), `PRIVATE_HEALTH`, `SUPPLEMENTARY_HEALTH`, `DENTAL_SUPPLEMENT`, `TRAVEL_HEALTH`, `LONG_TERM_CARE`, `DISABILITY`, `TERM_LIFE`, `ACCIDENT` |
| LIABILITY | `PRIVATE_LIABILITY`, `PET_LIABILITY`, `PROPERTY_OWNER_LIABILITY`                                                                                                                                                                               |
| PROPERTY  | `HOUSEHOLD`, `BUILDING`, `NATURAL_HAZARD`, `GLASS`                                                                                                                                                                                             |
| MOBILITY  | `CAR`, `BICYCLE`                                                                                                                                                                                                                               |
| LEGAL     | `LEGAL_PROTECTION`                                                                                                                                                                                                                             |
| OTHER     | `OTHER`                                                                                                                                                                                                                                        |

Classification: `ESSENTIAL` (private liability, health, disability for working people, household),
`RECOMMENDED` (building and natural hazard for owners, car, travel health, term life with children),
`SITUATIONAL` (property-owner liability, pet liability, legal protection, bicycle, long-term care),
`OPTIONAL` (glass, dental and supplementary health, accident). Exact values are fixed in the lib and
covered by tests.

Requirements (gap check): `HEALTH`, `LIABILITY`, `HOUSEHOLD`, `DISABILITY`, `BUILDING`, `NATURAL_HAZARD`,
`CAR`, `PET_LIABILITY`, `TRAVEL_HEALTH`, `RISK_LIFE`, `LEGAL`, `PROPERTY_OWNER_LIABILITY`; each with
`classification`, `appliesWhen(profile)`, `satisfiedBy` type ids.

## Validation rules (FR-018)

- Whitelist: any field outside the schemas is rejected; `details` keys must belong to the type.
- Required: `type`, `name`, `status`, `startDate`, `premium`, `interval`, `cancellation.autoRenew`.
- `premium` ≥ 0 with at most 2 fractional digits; `endDate` ≥ `startDate`.
- `paymentMonth` only for non-monthly intervals.
- `fixedDate` must be a real calendar day (29.02. allowed, 30.02. rejected).
- `alsoCovers` must not contain the own type or duplicates.
- Social types (`STATUTORY_*`) only with interval `MONTHLY`.

## State transitions

`ACTIVE → CANCELLED` (user sets an end date or marks as cancelled), `ACTIVE → ENDED` (end date passed;
the UI shows it as ended without a stored change), `CANCELLED/ENDED → ACTIVE` (user reactivates).
Inactive contracts are excluded from totals after their end date, from deadlines and from reminders.
