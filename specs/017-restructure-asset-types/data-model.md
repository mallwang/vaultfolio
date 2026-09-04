# Phase 1 Data Model: Restructure Asset Types (Precious Metal / Crypto)

This amends 003-manual-holdings-entry's [data-model.md](../003-manual-holdings-entry/data-model.md)
in place — same `AssetType`/`Holding` entities, same `libs/domain/holdings` location. Only the
rows/cells below change; everything else in the 003 document (universal `management`, the
`purchaseDate`/ISIN validation rules, `createdAt`/`updatedAt`, the SQLite persistence shape) is
unchanged and not repeated here.

## AssetType (amended)

| Value              | Required type-specific fields                               | Optional type-specific fields | Merge behavior on repeat submission                                    |
| ------------------ | ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `'ETF'`            | `isin`, `name`, `quantity`, `purchasePrice` (average price) | _(none)_                      | Upsert by `(isin, management)` — unchanged                             |
| `'SHARE'`          | `isin`, `name`, `quantity`, `purchasePrice`                 | `purchaseDate`                | Always a new, independent lot — unchanged                              |
| `'PRECIOUS_METAL'` | **`name`** (new), `weightGrams`                             | `currentValue`                | Upsert by **`(name, management)`** (was `(management)` alone) — FR-005 |
| `'CRYPTO'`         | **`name`** (new), `quantity`, `purchasePrice`               | `purchaseDate`                | Always a new, independent lot — unchanged (FR-006)                     |

`'GOLD'` and `'BITCOIN'` no longer exist as values `libs/domain/holdings/src/lib/asset-type.ts`'s
`ASSET_TYPES`/`AssetType` union accepts (FR-001, FR-002, FR-011) — renamed in place, not added
alongside. `ASSET_TYPE_FIELDS['PRECIOUS_METAL'].required` and `['CRYPTO'].required` both gain
`'name'` (FR-003, FR-004); `weightGrams`/`quantity`+`purchasePrice`+`purchaseDate` keep their prior
required/optional split unchanged (Assumptions).

## Holding (amended fields)

| Field                                               | Type                | Required                                                                                | Notes                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                              | string \| `null`    | required for `ETF`/`SHARE` (unchanged) **and now `PRECIOUS_METAL`/`CRYPTO`**            | FR-003, FR-004, FR-009: free text, no fixed list (e.g. "Gold", "Silver", "Bitcoin", "Ethereum"); validated the same way (non-empty after trim) as ETF/Share's existing `name` — case-sensitive, exact-match for merge purposes (Edge Cases). |
| `weightGrams`                                       | `Decimal` \| `null` | required for `PRECIOUS_METAL` only (renamed from `GOLD`, otherwise unchanged)           | —                                                                                                                                                                                                                                            |
| `currentValue`                                      | `Decimal` \| `null` | optional, `PRECIOUS_METAL` only (renamed from `GOLD`, otherwise unchanged)              | —                                                                                                                                                                                                                                            |
| `quantity`, `purchasePrice`, `purchaseDate`, `isin` | unchanged types     | unchanged applicability, now keyed to `CRYPTO` instead of `BITCOIN` for the first three | `isin` remains n/a for `CRYPTO`, same as it was for `BITCOIN`                                                                                                                                                                                |

**Validation rule changes** (`libs/domain/holdings/src/lib/holding-validation.ts`):

- `assetType === 'PRECIOUS_METAL'` ⇒ `name` (non-blank, trimmed) and `weightGrams` (positive) are
  required; `currentValue` optional and positive when provided; `isin`, `purchasePrice`,
  `purchaseDate`, `quantity` remain absent/null — same shape as the old `GOLD` branch plus the new
  `name` requirement.
- `assetType === 'CRYPTO'` ⇒ `name` (non-blank, trimmed) and `quantity`/`purchasePrice` are
  required; `purchaseDate` optional; `isin`, `weightGrams`, `currentValue` remain absent/null —
  same shape as the old `BITCOIN` branch plus the new `name` requirement.
- An empty/whitespace-only `name` on either type is a `FieldError` with message `"name is required
for {assetType}."`, reusing the existing `isBlank`/required-field-loop machinery ETF/Share's
  `name` already goes through — no new validation code path, just `name` added to
  `ASSET_TYPE_FIELDS.PRECIOUS_METAL.required`/`.CRYPTO.required` (FR-009, SC-004).

**Merge/upsert rule changes** (`holding-merge.ts`'s `decideMerge()`, FR-005):

- The old `GOLD` branch (match on `assetType` + `management` alone) becomes the `PRECIOUS_METAL`
  branch, now also comparing `holding.name === submission.name` — mirroring the `ETF` branch's
  `isin` comparison exactly. Two Precious metal submissions under the same Management with
  different names (`"Gold"` vs `"Silver"`) never match, per Edge Cases' case-sensitive exact-match
  rule.
- `CRYPTO` (was `BITCOIN`) keeps the unconditional `{ kind: 'create' }` — untouched (FR-006).

## Persistence (SQLite, `apps/backend/src/database/database.service.ts`)

The `holdings` table is rebuilt in place by a new idempotent `migrateAssetTypeRestructure()`
step (see [research.md](./research.md) #1 for the full procedure and its idempotency guard):

- `asset_type` `CHECK` widens from `('ETF','SHARE','GOLD','BITCOIN')` to
  `('ETF','SHARE','PRECIOUS_METAL','CRYPTO')` — a rename, not an additive widen; `GOLD`/`BITCOIN`
  become invalid values for any future insert/update (FR-011).
- `holdings_fields_match_asset_type` `CHECK`'s `GOLD` branch becomes a `PRECIOUS_METAL` branch
  requiring `name IS NOT NULL` (previously `name IS NULL`); its `BITCOIN` branch becomes a
  `CRYPTO` branch, same change.
- Existing rows: every `asset_type = 'GOLD'` row becomes `asset_type = 'PRECIOUS_METAL',
name = 'Gold'`; every `asset_type = 'BITCOIN'` row becomes `asset_type = 'CRYPTO', name =
'Bitcoin'` — all other columns (`management`, `quantity`, `weight_grams`, `current_value`,
  `owner_id`, `created_at`, `updated_at`, …) unchanged (FR-007, User Story 3).
- `holdings_upsert_lookup_idx (asset_type, management, isin)` is recreated unchanged after the
  rebuild — it already covers the `PRECIOUS_METAL` name-based lookup adequately at this table's
  expected scale (dozens–low hundreds of rows per user, per 003's Scale/Scope); no new index is
  added (Principle V/YAGNI).

## Shared API contract types (`libs/api-contract/src/lib/holdings.ts`)

- `AssetType` union: `'ETF' | 'SHARE' | 'GOLD' | 'BITCOIN'` → `'ETF' | 'SHARE' | 'PRECIOUS_METAL' |
'CRYPTO'`.
- `CreateGoldHoldingRequest` → `CreatePreciousMetalHoldingRequest`: gains `name: string` alongside
  its existing `management`/`weightGrams`/optional `currentValue`.
- `CreateBitcoinHoldingRequest` → `CreateCryptoHoldingRequest`: gains `name: string` alongside its
  existing `management`/`quantity`/`purchasePrice`/optional `purchaseDate`.
- `CreateHoldingRequest`/`UpdateHoldingRequest` discriminated unions updated to reference the
  renamed member types; `assetType` literal values update accordingly.
- `HoldingResponse` shape is unchanged (already carries a nullable `name` for every type) — only
  the `assetType` value space and the fact that `name` is now non-null for these two types changes.

See [contracts/holdings-api-asset-types.md](./contracts/holdings-api-asset-types.md) for the full
request/response examples.
