# Phase 1 Data Model: Manual Holdings Entry

## AssetType

A fixed classification, per spec.md's "Asset Type" Key Entity. Defined once in
`libs/domain/holdings/src/lib/asset-type.ts` and re-exported (as a type/string union, not a
runtime enum with vendor-specific behavior) through `libs/api-contract` so backend and frontend
share the exact same set of literals.

| Value       | Required type-specific fields                               | Optional type-specific fields | Merge behavior on repeat submission (FR-011/FR-011a)                |
| ----------- | ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `'ETF'`     | `isin`, `name`, `quantity`, `purchasePrice` (average price) | _(none)_                      | Upsert by `(isin, management)` — replaces quantity/average price    |
| `'SHARE'`   | `isin`, `name`, `quantity`, `purchasePrice`                 | `purchaseDate`                | Always a new, independent lot                                       |
| `'GOLD'`    | `weightGrams`                                               | `currentValue`                | Upsert by `(management)` alone — replaces weight (and currentValue) |
| `'BITCOIN'` | `quantity`, `purchasePrice`                                 | `purchaseDate`                | Always a new, independent lot                                       |

Every asset type additionally requires `management` (free text) — universal per FR-002, not
type-specific. ETF has **no** `purchaseDate` field at all (not merely optional/hidden) — FR-005.
Gold has no `isin`, `name`, `purchasePrice`, or `purchaseDate` field — FR-006. `purity` and
`weightUnit` do not exist anywhere in this model (superseded by the Clarifications session's
"collapses to a single required weight field in grams" resolution).

## Holding

The core entity (spec.md's "Holding" Key Entity): one holding row — either a purchase lot
(Share/Bitcoin: one row per submission) or a current position (ETF/Gold: one row per
`(identifier, management)` pair, replaced in place on repeat submission). Modeled in
`libs/domain/holdings/src/lib/holding.ts` as a framework-independent domain class, independent of
both the NestJS layer and the Postgres row shape.

| Field           | Type                               | Required                                                    | Notes                                                                                                                                           |
| --------------- | ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | UUID (string)                      | generated, never client-supplied on create                  | `gen_random_uuid()` at the DB, matching `example_value`'s existing pattern. Stable across an ETF/Gold in-place update.                          |
| `assetType`     | `AssetType`                        | yes, immutable after creation                               | FR-008: fixed for the life of the holding — editing does not change asset type.                                                                 |
| `management`    | string                             | yes, every asset type                                       | FR-002: free text (e.g. "Private", "Roboadvisor", a bank name); not validated against a fixed list (spec.md Assumptions).                       |
| `quantity`      | `Decimal` (`decimal.js`)           | yes for ETF/SHARE/BITCOIN; n/a for GOLD                     | FR-003, FR-005, FR-007: must be a positive number. Never a native `number` (constitution's Money/decimal clause).                               |
| `purchasePrice` | `Decimal` (`decimal.js`)           | yes for ETF/SHARE/BITCOIN; n/a for GOLD                     | FR-003, FR-005, FR-007: must be a positive number; single implicit base currency (FR-017, no currency field). "Average purchase price" for ETF. |
| `purchaseDate`  | `Date` \| `null`                   | optional for SHARE/BITCOIN only; never present for ETF/GOLD | FR-003, FR-007: when present, must not be in the future. `null` renders as "—" per FR-012.                                                      |
| `isin`          | string \| `null`                   | required for `ETF`/`SHARE` only                             | FR-004, FR-005: well-formed 12-character ISIN (2-letter country + 9 alphanumeric + check digit). Identity key for ETF upsert.                   |
| `name`          | string \| `null`                   | required for `ETF`/`SHARE` only                             | FR-004, FR-005.                                                                                                                                 |
| `weightGrams`   | `Decimal` (`decimal.js`) \| `null` | required for `GOLD` only                                    | FR-006: must be positive; grams only, no unit selector (spec.md Assumptions).                                                                   |
| `currentValue`  | `Decimal` (`decimal.js`) \| `null` | optional, `GOLD` only                                       | FR-006, FR-012a: used solely to include the Gold holding in the distribution view; must be positive when provided.                              |
| `createdAt`     | `Date`                             | generated                                                   | Observability (Principle V) — when the row was first created.                                                                                   |
| `updatedAt`     | `Date`                             | generated                                                   | Updated on every edit and every ETF/Gold in-place upsert (FR-011a, FR-014); supports auditability.                                              |

**Validation rules** (enforced in `libs/domain/holdings`, first thing exercised by tests per
Principle III):

- `management` is a non-empty string, for every asset type (FR-002, FR-009/Edge Cases).
- `quantity > 0`, `purchasePrice > 0`, `weightGrams > 0`, and `currentValue > 0` (when provided),
  where applicable to the asset type (FR-009, Edge Cases: zero/negative rejected for all of these,
  including the optional Gold current value).
- `purchaseDate`, if provided, `<= today` — Share/Bitcoin only, since ETF/Gold never have this
  field (FR-009, Edge Cases: future date rejected; omission is always valid).
- `assetType === 'ETF'` ⇒ `isin`, `name`, `quantity`, `purchasePrice` are required and `isin`
  passes the ISIN checksum; `purchaseDate` MUST NOT be present at all (FR-005).
- `assetType === 'SHARE'` ⇒ `isin`, `name`, `quantity`, `purchasePrice` are required (same ISIN
  checksum), `purchaseDate` optional (FR-004).
- `assetType === 'GOLD'` ⇒ `weightGrams` is required and positive; `currentValue` optional and
  positive when provided; `isin`, `name`, `purchasePrice`, `purchaseDate`, `quantity` are all
  absent/null (FR-006).
- `assetType === 'BITCOIN'` ⇒ `quantity`, `purchasePrice` are required; `purchaseDate` optional;
  `isin`, `name`, `weightGrams`, `currentValue` are all absent/null (FR-007).
- Fields that don't apply to the given `assetType` are never populated, even if present on the
  incoming request (FR-008, Edge Cases: switching asset type must discard stale fields) — the
  domain constructor/validator ignores or rejects extraneous fields rather than silently storing
  them.

**Merge/upsert rule** (`holding-merge.ts`, FR-011/FR-011a — a domain-layer decision consumed by
the repository, see [research.md](./research.md) #4):

- `SHARE` and `BITCOIN`: every valid submission is a new row. No existing-row lookup is performed.
- `ETF`: look up an existing row where `assetType = 'ETF' AND isin = <submitted isin> AND
management = <submitted management>`. If found, **replace** that row's `quantity` and
  `purchasePrice` with the submitted values (not additive) and bump `updatedAt`; the row's `id`,
  `name`, `isin`, `management`, and `createdAt` are unchanged. If not found, insert a new row.
- `GOLD`: look up an existing row where `assetType = 'GOLD' AND management = <submitted
management>` (no ISIN — Gold has no per-asset identifier beyond "being Gold"). If found,
  **replace** that row's `weightGrams` (and `currentValue`, if submitted) and bump `updatedAt`. If
  not found, insert a new row.
- A submission for the same identifier under a _different_ `management` value always creates a
  separate row (FR-011a) — Management is part of the identity key for both ETF and Gold.

**Relationships / state transitions**: None — no status/lifecycle state machine; a holding exists
until explicitly deleted (hard delete, per spec.md Assumptions — no soft-delete/undo), or until an
ETF/Gold row is replaced in place by a later matching submission (not a delete+recreate — the same
`id` persists).

## Persistence: `holdings` table

Created by a migration added to `DatabaseService` (extending its existing
`CREATE TABLE IF NOT EXISTS` pattern — no ORM, per Principle V/YAGNI and research.md #3):

```sql
CREATE TABLE IF NOT EXISTS holdings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type     TEXT NOT NULL CHECK (asset_type IN ('ETF', 'SHARE', 'GOLD', 'BITCOIN')),
  management     TEXT NOT NULL CHECK (management <> ''),
  quantity       NUMERIC(20, 8) NULL CHECK (quantity IS NULL OR quantity > 0),
  purchase_price NUMERIC(20, 8) NULL CHECK (purchase_price IS NULL OR purchase_price > 0),
  purchase_date  DATE NULL,
  isin           TEXT NULL,
  name           TEXT NULL,
  weight_grams   NUMERIC(20, 8) NULL CHECK (weight_grams IS NULL OR weight_grams > 0),
  current_value  NUMERIC(20, 8) NULL CHECK (current_value IS NULL OR current_value > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holdings_fields_match_asset_type CHECK (
    (asset_type = 'ETF' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
      AND purchase_price IS NOT NULL AND purchase_date IS NULL
      AND weight_grams IS NULL AND current_value IS NULL)
    OR
    (asset_type = 'SHARE' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
      AND purchase_price IS NOT NULL AND weight_grams IS NULL AND current_value IS NULL)
    OR
    (asset_type = 'GOLD' AND weight_grams IS NOT NULL
      AND isin IS NULL AND name IS NULL AND quantity IS NULL AND purchase_price IS NULL
      AND purchase_date IS NULL)
    OR
    (asset_type = 'BITCOIN' AND quantity IS NOT NULL AND purchase_price IS NOT NULL
      AND isin IS NULL AND name IS NULL AND weight_grams IS NULL AND current_value IS NULL)
  )
);

-- Backs the ETF/Gold upsert lookup in research.md #4 (not a uniqueness constraint enforced at the
-- DB layer — see research.md #4 for why the match-then-write decision stays in the repository/
-- domain layer rather than a partial unique index).
CREATE INDEX IF NOT EXISTS holdings_upsert_lookup_idx
  ON holdings (asset_type, management, isin);
```

- `NUMERIC(20, 8)` throughout — never `FLOAT`/`DOUBLE PRECISION` (constitution's Money/decimal
  handling clause).
- The `holdings_fields_match_asset_type` `CHECK` constraint is a database-level backstop for
  FR-005/FR-006/FR-007; the primary enforcement point is the domain layer's validator (Principle
  I), so a bug there is still caught before bad data lands in Postgres.
- No `user_id`/tenancy column — matches spec.md's Assumption that no auth/multi-user separation is
  in scope for this feature; holdings are scoped to whatever boundary the application already
  establishes (currently: none, single implicit user).
- `updated_at` is bumped by the repository layer on every `UPDATE` (both a user-initiated edit and
  an ETF/Gold in-place upsert), not a trigger, keeping the logic visible in one place (no hidden
  DB-side behavior, Principle V observability).

## Shared API contract types (`libs/api-contract/src/lib/holdings.ts`)

Mirrors `libs/api-contract/src/lib/health.ts`'s existing pattern — plain TypeScript interfaces, no
runtime dependency, imported by both `apps/backend` and `apps/frontend`:

- `AssetType` — the shared string-union type.
- `HoldingResponse` — the full shape returned by `GET`/`POST`/`PUT` (all `Holding` fields,
  `Decimal` fields serialized as decimal strings over the wire — see
  [contracts/holdings-api.md](./contracts/holdings-api.md) for the exact JSON shape).
- `CreateHoldingRequest` / `UpdateHoldingRequest` — request bodies, one variant per asset type;
  `UpdateHoldingRequest` omits `assetType` (immutable after creation, FR-008) and
  `id`/`createdAt`/`updatedAt` (server-owned).
