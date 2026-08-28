# Phase 1 Data Model: Manual Holdings Entry

## AssetType

A fixed classification, per spec.md's "Asset Type" Key Entity. Defined once in
`libs/domain/holdings/src/lib/asset-type.ts` and re-exported (as a type/string union, not a
runtime enum with vendor-specific behavior) through `libs/api-contract` so backend and frontend
share the exact same set of literals.

| Value       | Required type-specific fields    |
| ----------- | -------------------------------- |
| `'ETF'`     | `isin`, `name`                   |
| `'SHARE'`   | `isin`, `name`                   |
| `'GOLD'`    | `weight`, `weightUnit`, `purity` |
| `'BITCOIN'` | _(none)_                         |

## Holding

The core entity (spec.md's "Holding" Key Entity): one purchase lot of one asset. Modeled in
`libs/domain/holdings/src/lib/holding.ts` as a framework-independent domain class, independent of
both the NestJS layer and the Postgres row shape.

| Field           | Type                                 | Required                                   | Notes                                                                                                        |
| --------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `id`            | UUID (string)                        | generated, never client-supplied on create | `gen_random_uuid()` at the DB, matching `example_value`'s existing pattern.                                  |
| `assetType`     | `AssetType`                          | yes, immutable after creation              | FR-006: fixed for the life of the holding — editing does not change asset type (design.md "Edit — Bitcoin"). |
| `quantity`      | `Decimal` (`decimal.js`)             | yes                                        | FR-002, FR-007: must be a positive number. Never a native `number` (constitution's Money/decimal clause).    |
| `purchasePrice` | `Decimal` (`decimal.js`)             | yes                                        | FR-002, FR-007: must be a positive number; single implicit base currency (FR-015, no currency field).        |
| `purchaseDate`  | `Date` \| `null`                     | no (optional)                              | FR-002, FR-007: when present, must not be in the future. `null` renders as "—" per FR-010.                   |
| `isin`          | string \| `null`                     | required for `ETF`/`SHARE` only            | FR-003, FR-008: well-formed 12-character ISIN (2-letter country + 9 alphanumeric + check digit).             |
| `name`          | string \| `null`                     | required for `ETF`/`SHARE` only            | FR-003.                                                                                                      |
| `weight`        | `Decimal` (`decimal.js`) \| `null`   | required for `GOLD` only                   | FR-004: must be positive.                                                                                    |
| `weightUnit`    | `'TROY_OUNCE'` \| `'GRAM'` \| `null` | required for `GOLD` only                   | FR-004; system-defined unit per spec.md Assumptions (not user-selectable in this feature).                   |
| `purity`        | `Decimal` (`decimal.js`) \| `null`   | required for `GOLD` only                   | FR-004: must be positive; no further real-world plausibility check per spec.md Assumptions.                  |
| `createdAt`     | `Date`                               | generated                                  | Observability (Principle V) — when the lot was recorded, independent of `purchaseDate`.                      |
| `updatedAt`     | `Date`                               | generated                                  | Updated on every edit (FR-012); supports auditability.                                                       |

**Validation rules** (enforced in `libs/domain/holdings`, first thing exercised by tests per
Principle III):

- `quantity > 0` and `purchasePrice > 0` (FR-007, Edge Cases: zero/negative rejected).
- `purchaseDate`, if provided, `<= today` (FR-007, Edge Cases: future date rejected; omission is
  always valid).
- `assetType === 'ETF' || assetType === 'SHARE'` ⇒ `isin` and `name` are required, and `isin`
  passes the ISIN checksum (FR-003, FR-008).
- `assetType === 'GOLD'` ⇒ `weight`, `weightUnit`, and `purity` are all required and positive
  (FR-004, Edge Cases: both weight and purity required, neither alone is sufficient).
- `assetType === 'BITCOIN'` ⇒ `isin`, `name`, `weight`, `weightUnit`, `purity` are all absent/null
  (FR-005).
- Fields that don't apply to the given `assetType` are never populated, even if present on the
  incoming request (FR-006, Edge Cases: switching asset type must discard stale fields) — the
  domain constructor/validator ignores or rejects extraneous fields rather than silently storing
  them.

**Relationships / state transitions**: None — each `Holding` is fully independent (FR-009: no
merging across lots of the same asset). No status/lifecycle state machine; a holding exists until
explicitly deleted (hard delete, per spec.md Assumptions — no soft-delete/undo).

## Persistence: `holdings` table

Created by a migration added to `DatabaseService` (extending its existing
`CREATE TABLE IF NOT EXISTS` pattern — no ORM, per Principle V/YAGNI and research.md #3):

```sql
CREATE TABLE IF NOT EXISTS holdings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type     TEXT NOT NULL CHECK (asset_type IN ('ETF', 'SHARE', 'GOLD', 'BITCOIN')),
  quantity       NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
  purchase_price NUMERIC(20, 8) NOT NULL CHECK (purchase_price > 0),
  purchase_date  DATE NULL,
  isin           TEXT NULL,
  name           TEXT NULL,
  weight         NUMERIC(20, 8) NULL CHECK (weight IS NULL OR weight > 0),
  weight_unit    TEXT NULL CHECK (weight_unit IS NULL OR weight_unit IN ('TROY_OUNCE', 'GRAM')),
  purity         NUMERIC(20, 8) NULL CHECK (purity IS NULL OR purity > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holdings_fields_match_asset_type CHECK (
    (asset_type IN ('ETF', 'SHARE') AND isin IS NOT NULL AND name IS NOT NULL
      AND weight IS NULL AND weight_unit IS NULL AND purity IS NULL)
    OR
    (asset_type = 'GOLD' AND weight IS NOT NULL AND weight_unit IS NOT NULL AND purity IS NOT NULL
      AND isin IS NULL AND name IS NULL)
    OR
    (asset_type = 'BITCOIN' AND isin IS NULL AND name IS NULL
      AND weight IS NULL AND weight_unit IS NULL AND purity IS NULL)
  )
);
```

- `NUMERIC(20, 8)` throughout — never `FLOAT`/`DOUBLE PRECISION` (constitution's Money/decimal
  handling clause), matching `example_value`'s precedent.
- The `holdings_fields_match_asset_type` `CHECK` constraint is a database-level backstop for
  FR-006/FR-005; the primary enforcement point is the domain layer's validator (Principle I), so a
  bug there is still caught before bad data lands in Postgres.
- No `user_id`/tenancy column — matches spec.md's Assumption that no auth/multi-user separation is
  in scope for this feature; holdings are scoped to whatever boundary the application already
  establishes (currently: none, single implicit user).
- `updated_at` is bumped by the repository layer on every `UPDATE`, not a trigger, keeping the
  logic visible in one place (no hidden DB-side behavior, Principle V observability).

## Shared API contract types (`libs/api-contract/src/lib/holdings.ts`)

Mirrors `libs/api-contract/src/lib/health.ts`'s existing pattern — plain TypeScript interfaces, no
runtime dependency, imported by both `apps/backend` and `apps/frontend`:

- `AssetType` — the shared string-union type.
- `HoldingResponse` — the full shape returned by `GET`/`POST`/`PUT` (all `Holding` fields,
  `Decimal` fields serialized as decimal strings over the wire — see
  [contracts/holdings-api.md](./contracts/holdings-api.md) for the exact JSON shape).
- `CreateHoldingRequest` / `UpdateHoldingRequest` — request bodies; `UpdateHoldingRequest` omits
  `assetType` (immutable after creation, FR-006) and `id`/`createdAt`/`updatedAt` (server-owned).
