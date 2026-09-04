# Research: Deposit Money Asset Type

No `[NEEDS CLARIFICATION]` markers remain in the Technical Context — this feature extends an
existing, well-established pattern (`PRECIOUS_METAL`) rather than introducing new technology, so
the research below documents the small number of design decisions specific to this feature, not
open unknowns.

## 1. Where `DEPOSIT_MONEY` sits in the existing `AssetType` model

**Decision**: Add `DEPOSIT_MONEY` as a fifth `AssetType` literal, with required fields `name` +
`currentValue`, reusing the existing `management` field — no new fields, no new columns beyond what
`PRECIOUS_METAL` already added (`weight_grams`, `current_value` already exist; `DEPOSIT_MONEY` uses
only `current_value`).

**Rationale**: `libs/domain/holdings/src/lib/asset-type.ts`'s `ASSET_TYPE_FIELDS` table already
expresses "required/optional per type" as data, and `PRECIOUS_METAL` is the closest existing
precedent (no `isin`/`quantity`/`purchasePrice`/`purchaseDate`, valued by a single manually-entered
number). `DEPOSIT_MONEY` needs even less than `PRECIOUS_METAL` (no `weightGrams`), so it slots into
the same table with no structural change to the mechanism, only a new column entry — matching the
constitution's YAGNI clause (Principle V).

**Alternatives considered**: A dedicated "cash" domain concept separate from `Holding` (e.g. its
own entity/table) — rejected: it would duplicate management/CRUD/validation/upsert machinery that
already exists and works for `PRECIOUS_METAL`, for no behavioral benefit, and would need its own
inclusion path into the current-wealth aggregation the existing `Holding.computeValue()` already
serves.

## 2. Allowing a zero `currentValue` (FR-006/FR-007)

**Decision**: Change the `current_value` SQLite `CHECK` constraint and the domain-layer
`parsePositiveDecimal` validation from "must be `> 0`" to "must be `>= 0`" — for `current_value`
specifically, not for every decimal field. `quantity`, `purchase_price`, and `weight_grams` keep
their existing `> 0` requirement; only `current_value`'s floor changes.

**Rationale**: The spec's edge cases (FR-006/FR-007) require a `DEPOSIT_MONEY` holding to accept
zero (an emptied account) but reject negative values. `current_value` is currently the only decimal
field shared with `PRECIOUS_METAL`, where it is optional; loosening its floor to `>= 0` also lets a
precious-metal holding record a zero current value, which is harmless (zero is a legitimate,
if unusual, valuation) and avoids introducing a second, type-conditional validation rule for the
same column — simpler than making the floor asset-type-dependent (Principle V).

**Alternatives considered**: A `DEPOSIT_MONEY`-only exception inside `parsePositiveDecimal`/the
`CHECK` constraint (keep `current_value > 0` for `PRECIOUS_METAL`, allow `>= 0` only for
`DEPOSIT_MONEY`) — rejected as unnecessary complexity: no requirement anywhere states
`PRECIOUS_METAL`'s current value must stay strictly positive, so a single shared rule is simpler
and equally correct.

## 3. Upsert/merge identity for `DEPOSIT_MONEY` (FR-008)

**Decision**: `DEPOSIT_MONEY` matches the existing row on `(name, management)`, identical to
`PRECIOUS_METAL` — no new code path.

**Rationale**: `decideMerge()` (`libs/domain/holdings/src/lib/holding-merge.ts`) already falls
through to the name-based branch for any asset type other than `ETF`/`SHARE`/`CRYPTO`, and
`HoldingsRepository.findUpsertMatch()` already branches on "ETF → isin, else → name". The service
call site (`HoldingsService.create()`) is the only place that needs to also trigger the upsert
lookup for `DEPOSIT_MONEY` (currently gated to `ETF || PRECIOUS_METAL`).

**Alternatives considered**: None — this is a direct, mechanical extension of an existing decision
table with a single conditional to widen.

## 4. Migration approach

**Decision**: Extend the existing rebuild-table migration pattern in `DatabaseService`
(`apps/backend/src/database/database.service.ts`) with a new migration step that rebuilds
`holdings` once more: widen the `asset_type` CHECK to include `'DEPOSIT_MONEY'`, add the
`DEPOSIT_MONEY` clause to `holdings_fields_match_asset_type`, and relax `current_value`'s CHECK to
`>= 0`. No data backfill is needed — no prior literal is being renamed, this only adds a new
allowed value and widens an existing constraint. Idempotency guard: check the stored `CREATE TABLE`
text for the `'DEPOSIT_MONEY'` literal (mirroring the `017-restructure-asset-types` migration's own
guard).

**Rationale**: SQLite cannot `ALTER` a `CHECK` expression in place, so the existing table-rebuild-
in-a-transaction technique (already proven by `migrateAssetTypeRestructure()`) is the established,
lowest-risk way to change these constraints, and reusing it satisfies FR-011 (one-time migration,
no re-entry of unrelated existing data) with no new migration mechanism to build or test.

**Alternatives considered**: A fresh migration mechanism (e.g. a migrations table + numbered SQL
files) — rejected as out of scope: this project's existing migrations are hand-written idempotent
functions in `DatabaseService`, and introducing a different mechanism for one feature would violate
Principle V's simplicity/YAGNI clause.

## 5. Frontend grouping/labeling for the portfolio overview (FR-010)

**Decision**: Treat `DEPOSIT_MONEY` as a "named group" in `HoldingsDistributionComponent`, the same
way `PRECIOUS_METAL`/`CRYPTO` already are — i.e. group and label by `${assetType}::${name}` rather
than merging all deposit-money holdings into one undifferentiated slice — and add a
`DEPOSIT_MONEY` entry to `ASSET_TYPE_COLORS` and `ASSET_TYPE_LABEL_KEYS`.

**Rationale**: FR-010 requires deposit money to be distinguishable, not blended in unlabeled; the
existing `isNamedGroup` mechanism already exists for exactly this purpose (distinguishing e.g.
"Gold" from "Silver" under the same asset type) and a distinct color per named holding gives the
best readability for the same reason it already does for precious metals.

**Alternatives considered**: Grouping all `DEPOSIT_MONEY` holdings into a single "Deposit Money"
slice regardless of name — rejected: it would hide, e.g., the split between two different bank
balances, which is exactly the kind of distinction User Story 3 asks for ("distinguishable... under
its own asset-type label").
