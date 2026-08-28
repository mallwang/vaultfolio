# Data Model: SQLite Migration & Self-Hosted Persistence

This feature changes _storage engine_, not _shape_ — the `Holding` domain entity, its fields, and
its validation rules are unchanged from 003-manual-holdings-entry. What changes is the SQL schema
that persists it and where the file that schema lives on disk. See [research.md](./research.md)
for the per-column reasoning behind each SQLite type choice below.

## Database file

- **Location**: `${DATABASE_PATH}` (default `./data/vaultfolio.db`), bind-mounted into the
  backend container from the host's repository-root `./data` directory (FR-002).
- **Auxiliary files**: `vaultfolio.db-wal` and `vaultfolio.db-shm` (WAL journal mode, per
  research.md #6) also live under `./data` alongside the main file — all three are part of the
  "database file(s)" referenced by FR-001/FR-002/SC-006, and are all covered by a `./data` backup.
- **Creation**: The directory and file are created automatically on first startup if missing
  (FR-003) by `DatabaseService`, before the schema migration runs.

## Entity: Holding

Unchanged domain shape (`libs/domain/holdings`'s `Holding`/`ValidatedHolding` types are untouched
by this feature). Table definition, translated from the existing PostgreSQL DDL in
`database.service.ts`:

| Column           | PostgreSQL (before)                          | SQLite (after)                                                                 | Notes                                                                                             |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `id`             | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `TEXT PRIMARY KEY`                                                             | App generates the UUID via `crypto.randomUUID()` (research.md #2); no column default.             |
| `asset_type`     | `TEXT NOT NULL CHECK (... IN (...))`         | `TEXT NOT NULL CHECK (... IN (...))`                                           | Unchanged — identical CHECK syntax.                                                               |
| `management`     | `TEXT NOT NULL CHECK (management <> '')`     | `TEXT NOT NULL CHECK (management <> '')`                                       | Unchanged.                                                                                        |
| `quantity`       | `NUMERIC(20,8) NULL CHECK (... > 0)`         | `TEXT NULL CHECK (quantity IS NULL OR CAST(quantity AS REAL) > 0)`             | Canonical decimal string (research.md #3).                                                        |
| `purchase_price` | `NUMERIC(20,8) NULL CHECK (... > 0)`         | `TEXT NULL CHECK (purchase_price IS NULL OR CAST(purchase_price AS REAL) > 0)` | Same pattern.                                                                                     |
| `purchase_date`  | `DATE NULL`                                  | `TEXT NULL` (ISO `YYYY-MM-DD`)                                                 | SQLite has no `DATE` type; app already reads/writes ISO date-only strings (`holdings.mapper.ts`). |
| `isin`           | `TEXT NULL`                                  | `TEXT NULL`                                                                    | Unchanged.                                                                                        |
| `name`           | `TEXT NULL`                                  | `TEXT NULL`                                                                    | Unchanged.                                                                                        |
| `weight_grams`   | `NUMERIC(20,8) NULL CHECK (... > 0)`         | `TEXT NULL CHECK (weight_grams IS NULL OR CAST(weight_grams AS REAL) > 0)`     | Same pattern.                                                                                     |
| `current_value`  | `NUMERIC(20,8) NULL CHECK (... > 0)`         | `TEXT NULL CHECK (current_value IS NULL OR CAST(current_value AS REAL) > 0)`   | Same pattern.                                                                                     |
| `created_at`     | `TIMESTAMPTZ NOT NULL DEFAULT now()`         | `TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))`                 | ISO-8601 UTC string (research.md #4).                                                             |
| `updated_at`     | `TIMESTAMPTZ NOT NULL DEFAULT now()`         | `TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))`                 | Repository sets this explicitly on `UPDATE` (same as before, via `now()` → `STRFTIME(...)`).      |

The `holdings_fields_match_asset_type` per-asset-type CHECK constraint (which fields are
required/forbidden per `asset_type`) is preserved verbatim — it only tests `IS [NOT] NULL`, which
SQLite's `CHECK` syntax supports identically to PostgreSQL.

**Index**: `holdings_upsert_lookup_idx ON holdings (asset_type, management, isin)` — preserved
verbatim; backs the ETF/Gold upsert-matching lookup (FR-007), unchanged from 003.

## Entity: `example_value` (placeholder NUMERIC-persistence proof table)

Same translation as `holdings`: `id TEXT PRIMARY KEY` (app-generated UUID), `amount TEXT NOT NULL`
(canonical decimal string), `created_at TEXT NOT NULL DEFAULT (STRFTIME(...))`.

## No new entities

This feature introduces no new domain entities or API fields — it is a storage-engine swap
underneath the existing `Holding` entity and `example_value` placeholder table.
