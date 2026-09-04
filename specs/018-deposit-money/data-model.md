# Data Model: Deposit Money Asset Type

## AssetType (extended)

`libs/domain/holdings/src/lib/asset-type.ts`'s `AssetType` union gains a fifth literal:

```
'ETF' | 'SHARE' | 'PRECIOUS_METAL' | 'CRYPTO' | 'DEPOSIT_MONEY'
```

### Field requirements (`ASSET_TYPE_FIELDS['DEPOSIT_MONEY']`)

| Field           | Required/Optional/Absent     | Notes                                                 |
| --------------- | ---------------------------- | ----------------------------------------------------- |
| `management`    | Required (always, all types) | Which bank/provider, or "Cash" (FR-003)               |
| `name`          | Required                     | Free text, e.g. "N26 checking" (FR-002)               |
| `currentValue`  | Required                     | `>= 0` — zero allowed, negative rejected (FR-006/007) |
| `isin`          | Absent                       | Must not be present (FR-004)                          |
| `quantity`      | Absent                       | Must not be present (FR-004)                          |
| `purchasePrice` | Absent                       | Must not be present (FR-004)                          |
| `purchaseDate`  | Absent                       | Must not be present (FR-004)                          |
| `weightGrams`   | Absent                       | Must not be present (FR-004)                          |

This is the minimal field set of any asset type — a strict subset of `PRECIOUS_METAL`'s (which also
allows `weightGrams`).

## Holding (existing entity, no shape change)

`Holding`/`HoldingProps` (`libs/domain/holdings/src/lib/holding.ts`) needs no new properties —
`DEPOSIT_MONEY` uses only fields the entity already has (`name`, `management`, `currentValue`).

`Holding.computeValue()` gains a branch: for `DEPOSIT_MONEY`, the value is `currentValue` directly
(same as `PRECIOUS_METAL`'s existing branch) — required rather than possibly-null, since
`currentValue` is mandatory for this type, so it is never excluded from the aggregation base the
way an un-valued precious-metal holding can be.

## Validation rules (`holding-validation.ts`)

- `currentValue`'s shared parser (`parsePositiveDecimal`, effectively renamed in spirit to "parse
  non-negative decimal" for this field) changes its floor from `> 0` to `>= 0`. `quantity`,
  `purchasePrice`, and `weightGrams` keep their existing `> 0` floor — only `currentValue` changes,
  and it changes for every asset type that uses it (currently `PRECIOUS_METAL` and, after this
  feature, `DEPOSIT_MONEY`).
- `DEPOSIT_MONEY`'s required-field list (`name`, `currentValue`) is enforced the same way existing
  required fields are (loop over `metadata.required`).
- Extraneous-field rejection (`isin`, `quantity`, `purchasePrice`, `purchaseDate`, `weightGrams`)
  falls out of the existing "not applicable to this type" loop with no new code.

## Merge / upsert identity (`holding-merge.ts`, `holdings.repository.ts`)

- `decideMerge()`: `DEPOSIT_MONEY` falls into the existing non-`ETF` branch, matching an existing
  row on `(name, management)` — identical to `PRECIOUS_METAL`, no new branch needed.
- `HoldingsRepository.findUpsertMatch()`: already branches "ETF → isin, else → name"; no change.
- `HoldingsService.create()`: the `if (value.assetType === 'ETF' || value.assetType ===
'PRECIOUS_METAL')` upsert-lookup gate must also include `'DEPOSIT_MONEY'`.

## Database schema (`database.service.ts`)

New migration (extends the `017-restructure-asset-types` rebuild-table pattern):

- `asset_type` CHECK: add `'DEPOSIT_MONEY'` to the allowed list.
- `current_value` CHECK: `CAST(current_value AS REAL) > 0` → `>= 0`.
- `holdings_fields_match_asset_type` CHECK: add a `DEPOSIT_MONEY` clause —
  `(asset_type = 'DEPOSIT_MONEY' AND name IS NOT NULL AND current_value IS NOT NULL AND isin IS NULL
AND quantity IS NULL AND purchase_price IS NULL AND purchase_date IS NULL AND weight_grams IS
NULL)`.
- No backfill needed — this migration only widens constraints, it renames no existing data.
- Idempotency guard: stored `CREATE TABLE` text contains `'DEPOSIT_MONEY'`.

## Shared API contract (`libs/api-contract/src/lib/holdings.ts`)

- `AssetType` union gains `'DEPOSIT_MONEY'`.
- `HoldingResponse` shape is unchanged (already has `name`/`currentValue`/`management` as optional/
  present fields).
- New `CreateDepositMoneyHoldingRequest`:
  ```ts
  interface CreateDepositMoneyHoldingRequest {
    assetType: 'DEPOSIT_MONEY';
    management: string;
    name: string;
    currentValue: string;
  }
  ```
  Added to the `CreateHoldingRequest`/`UpdateHoldingRequest` unions (the latter via `Omit<...,
'assetType'>`, same pattern as the other three).

## Frontend (`apps/frontend/src/app/holdings/...`, `shared/chart/chart-palette.ts`)

- `ASSET_TYPES` (`asset-type-fields.ts`) gains `'DEPOSIT_MONEY'`.
- `ASSET_TYPE_FIELD_SETS['DEPOSIT_MONEY']`: only `name` + `currentValue` shown/enabled; no purchase
  date field (like ETF/PRECIOUS_METAL).
- `ASSET_TYPE_LABEL_KEYS['DEPOSIT_MONEY']`: `'assetType.DEPOSIT_MONEY'` (new i18n key, `en.ts`/
  `de.ts`).
- `ASSET_TYPE_COLORS['DEPOSIT_MONEY']`: a new palette color distinct from the other four.
- `HoldingsDistributionComponent`: add `'DEPOSIT_MONEY'` to the `isNamedGroup` check (grouped/
  labeled by name, like `PRECIOUS_METAL`/`CRYPTO` — research.md #5).

## Validation summary (all in one place)

| Rule                                                                                    | Enforced by                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `name` required for DEPOSIT_MONEY                                                       | `holding-validation.ts` required-field loop                                                 |
| `currentValue` required for DEPOSIT_MONEY                                               | `holding-validation.ts` required-field loop                                                 |
| `currentValue >= 0`                                                                     | `parsePositiveDecimal` (renamed floor) + DB CHECK                                           |
| `currentValue < 0` rejected                                                             | same as above                                                                               |
| `isin`/`quantity`/`purchasePrice`/`purchaseDate`/`weightGrams` absent for DEPOSIT_MONEY | `holding-validation.ts` extraneous-field loop + DB `holdings_fields_match_asset_type` CHECK |
| Same `(name, management)` resubmission updates in place                                 | `decideMerge` + `findUpsertMatch`                                                           |
| `assetType` immutable after creation                                                    | existing update path (never accepts `assetType` in `UpdateHoldingRequest`)                  |
