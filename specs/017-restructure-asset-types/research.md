# Research: Restructure Asset Types (Precious Metal / Crypto)

No unresolved `NEEDS CLARIFICATION` markers remain in Technical Context — this feature reuses
003-manual-holdings-entry's stack end-to-end (no new dependency). The items below are the design
decisions Phase 0 needed to resolve before Phase 1.

## 1. Renaming an enum-backed `CHECK` constraint in SQLite (FR-007, FR-008)

**Decision**: Rebuild the `holdings` table under a new `migrateAssetTypeRestructure()` step in
`DatabaseService`, guarded by an idempotency check on the table's own stored schema text
(`SELECT sql FROM sqlite_master WHERE type='table' AND name='holdings'`) rather than a
`pragma_table_info` column check (the existing pattern used by every other migration in this
file). Steps, inside a single `db.transaction()`:

1. `CREATE TABLE holdings_new (...)` with the updated `asset_type` CHECK
   (`'ETF','SHARE','PRECIOUS_METAL','CRYPTO'`) and an updated
   `holdings_fields_match_asset_type` CHECK requiring `name IS NOT NULL` for `PRECIOUS_METAL`/
   `CRYPTO` (replacing the old `GOLD`/`BITCOIN` branches, which required `name IS NULL`).
2. `INSERT INTO holdings_new SELECT id, CASE asset_type WHEN 'GOLD' THEN 'PRECIOUS_METAL' WHEN
'BITCOIN' THEN 'CRYPTO' ELSE asset_type END, management, quantity, purchase_price,
purchase_date, isin, CASE asset_type WHEN 'GOLD' THEN 'Gold' WHEN 'BITCOIN' THEN 'Bitcoin' ELSE
name END, weight_grams, current_value, created_at, updated_at, owner_id FROM holdings` — a
   single deterministic backfill (FR-007's "Gold"/"Bitcoin" literal names), not a lookup table.
3. `DROP TABLE holdings; ALTER TABLE holdings_new RENAME TO holdings;` then recreate
   `holdings_upsert_lookup_idx` and `holdings_owner_id_idx` (dropped along with the old table).

**Rationale**: SQLite has no `ALTER TABLE ... MODIFY CONSTRAINT` — changing a `CHECK` expression
requires the documented 12-step "rebuild a table" procedure (create-new/copy/drop/rename), which
this collapses to the 3 steps above since there's no foreign-key/trigger/view fan-in to preserve
for `holdings`. Guarding on the stored `CREATE TABLE` text (rather than a column-presence check,
which is what every prior migration in this file uses) is necessary because this migration adds no
new column — the change is entirely inside two `CHECK` expressions and existing rows' values, so a
`pragma_table_info` probe would never detect "already migrated". Checking for the literal
substring `'PRECIOUS_METAL'` in the stored schema is a cheap, sufficient proxy: the string only
appears in `holdings`'s own `CREATE TABLE` text once this migration has run (satisfies FR-008 — a
second startup finds the substring present and skips straight to index recreation, a no-op if the
indexes already exist).

**Alternatives considered**:

- _Widen the CHECK to accept all six values, migrate data, narrow it back later_ — two migrations
  instead of one, more startup-migration code to maintain for a transition period nothing in this
  feature needs; rejected as unnecessary complexity (Principle V/YAGNI).
- _Drop the `CHECK` constraints entirely, enforce the enum only at the domain/app layer_ — loses a
  correctness backstop the rest of this table already relies on (e.g. `holdings_fields_match_asset_type`
  catches a field-set bug even if application validation has one); rejected — the constitution's
  Principle V wants the DB layer legible on its own, not dependent on the app never having a bug.
- _In-place `UPDATE holdings SET asset_type = ...` without touching the CHECK_ — impossible: the
  existing `CHECK (asset_type IN ('ETF','SHARE','GOLD','BITCOIN'))` would reject the new literal
  values outright.

## 2. Precious metal's upsert-match key changes from `management` alone to `(management, name)` (FR-005)

**Decision**: Generalize `HoldingsRepository.findUpsertMatch(assetType, management, identifier,
ownerId)`'s `identifier` parameter to mean "the column that, together with `management`, decides
whether a submission is the same asset" — `isin` for `ETF` (unchanged), `name` for
`PRECIOUS_METAL` (new; was previously matched on `management` alone via `isin IS NULL`). The
two-branch SQL (`isin IS NULL` vs `isin = $3`) becomes three: an `ETF` branch matching
`isin = $3`, a `PRECIOUS_METAL` branch matching `name = $3`, and no branch needed for
`SHARE`/`CRYPTO` (never looked up — `HoldingsService.create()` already skips the lookup entirely
for types that always insert). `holding-merge.ts`'s `decideMerge()` gets the equivalent change:
its `PRECIOUS_METAL` branch (renamed from `GOLD`) now also compares `holding.name ===
submission.name`, alongside the existing `management` comparison it already had.

**Rationale**: FR-005 explicitly requires name+Management as Precious metal's new identity key —
"Gold" and "Silver" under the same Management must never merge. Reusing the existing
`identifier`-parameter shape (rather than adding a second, type-specific parameter) keeps
`findUpsertMatch`'s call site in `HoldingsService.create()` a one-line change
(`value.assetType === 'ETF' ? value.isin : value.name`, mirroring the current
`value.assetType === 'ETF' ? value.isin : null` ternary) instead of a signature change that
ripples through every caller.

**Alternatives considered**:

- _Keep matching Precious metal on `management` alone, treat `name` as descriptive-only_ —
  contradicts FR-005 and the mockup's explicit "Gold" vs. "Silver" separate-rows acceptance
  scenario; rejected.
- _Add a dedicated `findPreciousMetalUpsertMatch` method instead of generalizing the existing one_
  — duplicates the ETF branch's shape for no behavioral difference; rejected (Principle V/YAGNI).

## 3. Distribution view's grouping key for Precious metal/Crypto (FR-010, design.md's "Open question")

**Decision**: In `HoldingsDistributionComponent.recompute()`, change the `Map` key from
`holding.assetType` alone to `` `${holding.assetType}::${holding.name}` `` for `PRECIOUS_METAL`
and `CRYPTO` holdings specifically (ETF/Share keep grouping by `assetType` alone — out of scope
per design.md), and use each group's `holding.name` (not `ASSET_TYPE_LABELS[assetType]`) as the
chart entry's `name`. Two Crypto lots both named "Bitcoin" still sum into one slice (matching the
list's own per-name identity, not per-row) — this is the same aggregation Precious metal already
had for identical rows before this feature (single-row-per-name after FR-005's merge behavior);
Crypto lots of the same name summing together is new, but consistent with FR-010's "each holding
[...] shown individually by its name" once "each holding" is read at the name level, not the
per-submission-lot level (a portfolio with two Bitcoin lots has conceptually one "Bitcoin"
exposure for allocation purposes, mirroring how ETF/Share would need to if they ever grouped by
name — out of scope here, so this is Precious-metal/Crypto-only for now).

**Rationale**: This directly resolves the open question design.md flagged: the component's current
`totalsByType` grouping (by `assetType` alone) cannot distinguish "Gold" from "Silver" or
"Bitcoin" from "Ethereum", which the approved mockup's legend requires. Computing the value
(`computeValue()`, unchanged) stays per-row; only the grouping key for these two types changes.

**Alternatives considered**:

- _Group by `(assetType, name, management)`_ — would split "Bitcoin @ Private" (two lots) into one
  slice each instead of summing, which the list already treats as the same logical holding by name
  for Precious metal (FR-005's merge) and would be an inconsistent reading of "by name" for Crypto;
  rejected as over-granular for a portfolio-allocation view.
- _Leave the distribution view grouped by type, only fix the list/labels_ — fails FR-010's explicit
  "asset-distribution view's grouping/labels" edge case and the approved mockup; rejected.

## 4. Existing test/fixture inventory referencing `GOLD`/`BITCOIN` (scope check)

**Decision**: Treat every hit from `grep -rln "GOLD\|BITCOIN"` across `apps/`, `libs/` (excluding
`dist`/`out-tsc`) as in-scope for this feature's tasks — confirmed to be exactly: domain
(`asset-type.ts`, `holding.ts`, `holding-merge.ts` + their `.spec.ts` files), backend
(`database.service.ts` + `.spec.ts`, `holdings.repository.ts` + `.spec.ts`, `holdings.service.ts`,
`holdings.controller.spec.ts`, `holdings.e2e-spec.ts`, `holdings-persistence.e2e-spec.ts`, plus
`auth/users.repository.spec.ts` — a raw-SQL `INSERT INTO holdings (..., asset_type, ...) VALUES
(..., 'GOLD', ...)` fixture in its delete-cascade test, verified by inspection to be a real
asset-type literal, not an unrelated string; update it to `'PRECIOUS_METAL'` with a `name` value,
matching the new `holdings_fields_match_asset_type` CHECK), `libs/api-contract` (`holdings.ts`),
and frontend (`asset-type-fields.ts`, `holdings.component.html`,
`holdings-distribution.component.ts` + `.spec.ts`, `holding-form.component.spec.ts`,
`holdings.component.spec.ts`, `en.ts`/`de.ts` translation catalogs). No other module (e.g. the
market-data or import pipelines mentioned in the constitution's Product Scope) references these
literals — this feature does not touch them.

**Rationale**: Front-loading this inventory in Phase 0 means `/speckit-tasks` can enumerate exact
file-level tasks instead of a vague "update all references" task, per the constitution's
Observability principle (auditable, traceable change set).
