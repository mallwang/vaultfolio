# Data Model: Authentication, Sessions & Per-User Data Isolation

**Feature**: `005-auth-sessions-isolation` | **Date**: 2026-08-29

All monetary/quantity columns are unaffected by this feature. New/changed tables below follow the
existing `holdings` table's conventions in `apps/backend/src/database/database.service.ts`: `TEXT`
primary keys (`randomUUID()`), `TEXT` timestamps in `STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')` form,
`CHECK` constraints enforced at the DB layer.

## Entity: User Account (`users` table)

Maps to spec's **User Account** key entity.

| Column            | Type      | Constraints                                                          | Notes                                                                                                                                                                                          |
| ----------------- | --------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `TEXT`    | PRIMARY KEY                                                          | `randomUUID()`                                                                                                                                                                                 |
| `email`           | `TEXT`    | `NOT NULL`, `UNIQUE` (case-insensitive via a `COLLATE NOCASE` index) | Sign-in identity                                                                                                                                                                               |
| `display_name`    | `TEXT`    | `NOT NULL`                                                           |                                                                                                                                                                                                |
| `password_hash`   | `TEXT`    | `NOT NULL`                                                           | Argon2id-encoded hash (embeds its own salt + params)                                                                                                                                           |
| `role`            | `TEXT`    | `NOT NULL CHECK (role IN ('ADMIN', 'MEMBER'))`                       | FR-011                                                                                                                                                                                         |
| `status`          | `TEXT`    | `NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE'` | Archived accounts can't sign in; full archival flow is out of scope (companion admin-management spec), but the column exists now so `sessions` invalidation (FR-012) has something to react to |
| `failed_attempts` | `INTEGER` | `NOT NULL DEFAULT 0`                                                 | Research #3                                                                                                                                                                                    |
| `locked_until`    | `TEXT`    | `NULL`                                                               | ISO timestamp; `NULL` = not locked                                                                                                                                                             |
| `created_at`      | `TEXT`    | `NOT NULL DEFAULT (STRFTIME(...))`                                   |                                                                                                                                                                                                |
| `updated_at`      | `TEXT`    | `NOT NULL DEFAULT (STRFTIME(...))`                                   |                                                                                                                                                                                                |

**Validation rules** (enforced in `libs/domain/auth`, not just DB `CHECK`s, per Principle I):

- `email`: non-empty, valid email shape.
- Password (at creation/change time only — never re-validated on sign-in beyond hash comparison):
  8–200 characters (spec Assumptions).
- `role` defaults to `MEMBER` for every account except the bootstrap admin.

**State transitions**: `ACTIVE` → `ARCHIVED` is out of scope for this spec (owned by the companion
admin-management spec) but the column and the "archived accounts can't sign in / sessions die"
behavior are implemented here since FR-012 requires the primitive to exist now.

## Entity: Session (`sessions` table)

Maps to spec's **Session** key entity.

| Column           | Type   | Constraints                        | Notes                                                                                                                                                       |
| ---------------- | ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `TEXT` | PRIMARY KEY                        | Opaque random token (base64url of 32 random bytes) — this is the exact value stored in the cookie, so a lookup miss is an expired/forged/signed-out session |
| `user_id`        | `TEXT` | `NOT NULL REFERENCES users(id)`    |                                                                                                                                                             |
| `created_at`     | `TEXT` | `NOT NULL DEFAULT (STRFTIME(...))` |                                                                                                                                                             |
| `last_active_at` | `TEXT` | `NOT NULL DEFAULT (STRFTIME(...))` | Updated on each authenticated request; drives inactivity-timeout (FR-004)                                                                                   |
| `expires_at`     | `TEXT` | `NOT NULL`                         | Absolute max lifetime (FR-004), set at creation = `created_at` + configured max lifetime                                                                    |

**Indexes**: `CREATE INDEX sessions_user_id_idx ON sessions (user_id)` — backs
`deleteAllForUser(userId)` (research.md #4).

**Lifecycle**:

- **Created**: on successful sign-in.
- **Read**: on every authenticated request — `last_active_at` and `expires_at` are both checked;
  either one being past `now` is treated as a lookup-miss (row is deleted, request gets 401), not
  merely ignored. `last_active_at` is bumped to `now` on every valid read (sliding inactivity
  window per FR-004).
- **Deleted**: sign-out (single row), inactivity/absolute expiry (lazy delete-on-read), or an
  external trigger via `deleteAllForUser(userId)` (account archived/deleted, password changed —
  FR-012).

**Configuration** (env vars, matching the `DATABASE_PATH` convention):

- `SESSION_INACTIVITY_TIMEOUT_MINUTES` (default 30)
- `SESSION_ABSOLUTE_LIFETIME_HOURS` (default 12)

## Change to Entity: Holding (`holdings` table)

Maps to spec's **[Resource]** key entity — Vaultfolio's concrete per-user domain entity is the
existing `Holding`.

| Column     | Type   | Constraints                                                      | Notes                                                 |
| ---------- | ------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `owner_id` | `TEXT` | `NOT NULL REFERENCES users(id)` (added via migration, see below) | Never rendered in any API response DTO or UI (FR-010) |

**Migration** (in `DatabaseService.migrate()`, per research.md #7):

1. If `holdings.owner_id` does not yet exist (checked via `PRAGMA table_info(holdings)`):
   a. `ALTER TABLE holdings ADD COLUMN owner_id TEXT NULL` (SQLite requires nullable add).
   b. Ensure the bootstrap admin exists (create if `users` is empty — research.md #6).
   c. `UPDATE holdings SET owner_id = ? WHERE owner_id IS NULL` with the bootstrap admin's id.
   d. From this point on, the _application layer_ treats `owner_id` as required on every write
   (SQLite can't retroactively add a `NOT NULL` constraint without a table rebuild, and a
   rebuild isn't justified here — Principle V/YAGNI — since every write path already sets it).
2. `CREATE INDEX IF NOT EXISTS holdings_owner_id_idx ON holdings (owner_id)`.

**Query scoping**: every `HoldingsRepository` method gains an `ownerId` parameter and an
`AND owner_id = $N` predicate — `findAll`, `findById`, `findUpsertMatch`, `insert` (sets
`owner_id`), `updateById`, `deleteById`. A lookup for a row that exists but belongs to another
owner returns the same "not found" result as a row that doesn't exist at all (no distinguishing
403 vs 404 — avoids confirming a record's existence to a non-owner).

## Relationships

```text
users (1) ──< sessions (many)         # user_id FK; ON delete, deleteAllForUser() cleans up explicitly (no DB-level CASCADE — explicit is auditable per Principle V)
users (1) ──< holdings (many)         # owner_id FK, same pattern
```
