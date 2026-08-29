# Data Model: Admin Account Management & Invitations

**Feature**: `006-admin-accounts-invitations` | **Date**: 2026-08-29

All monetary/quantity columns are unaffected. New/changed tables follow the existing `users`/
`sessions` conventions from `specs/005-auth-sessions-isolation/data-model.md`: `TEXT` primary keys
(`randomUUID()`), `TEXT` timestamps in `STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')` form, `CHECK`
constraints enforced at the DB layer, application-layer validation in a domain lib per Principle I.

## Change to Entity: User Account (`users` table)

Extends the table spec 005 created. Maps to this spec's **User Account** key entity ("extends the
entity defined in the authentication spec").

| Column                 | Type   | Constraints | Notes                                                                                                                                           |
| ---------------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `archived_at`          | `TEXT` | `NULL`      | Set when `status` transitions to `ARCHIVED`; `NULL` while `ACTIVE` or after reactivation clears it back to `NULL`                               |
| `retention_expires_at` | `TEXT` | `NULL`      | `archived_at` + configured retention window (30 days default); the retention-sweep's deletion threshold; cleared back to `NULL` on reactivation |

`status` (`ACTIVE`/`ARCHIVED`) and the archived-can't-sign-in behavior already exist per spec 005 —
no change needed there.

**Migration** (in `DatabaseService.migrateAuth()`, following spec 005's `PRAGMA table_info` pattern):

1. If `users.archived_at` does not yet exist: `ALTER TABLE users ADD COLUMN archived_at TEXT NULL`.
2. If `users.retention_expires_at` does not yet exist:
   `ALTER TABLE users ADD COLUMN retention_expires_at TEXT NULL`.

**Validation rules** (application layer, `libs/domain/auth`):

- Role change, archive, and self-delete are each rejected server-side if applying them would leave
  zero `ACTIVE` `ADMIN` accounts (FR-004) — single shared predicate, research.md #3.
- Archiving sets `status = 'ARCHIVED'`, `archived_at = now`, `retention_expires_at = now + retention
window` (default 30 days, `ACCOUNT_RETENTION_DAYS` env var), and invalidates all of that user's
  sessions (`SessionsRepository.deleteAllForUser`, spec 005 primitive) in the same transaction.
- Reactivating (only permitted while `now < retention_expires_at`) sets `status = 'ACTIVE'`,
  `archived_at = NULL`, `retention_expires_at = NULL`. Does not restore sessions — the reactivated
  user must sign in again.
- Role change takes effect immediately for the next request: no session invalidation needed since
  `AuthGuard` already reads `role` fresh from `UsersRepository.findById` on every request (spec
  005's `auth.guard.ts` — role is never cached in the session row itself).

**State transitions**:

```text
ACTIVE ──archive──> ARCHIVED ──reactivate (within retention window)──> ACTIVE
                        │
                        └──retention window elapsed (sweep)──> permanently deleted
```

## Entity: Invitation (`invitations` table)

Maps to spec's **Invitation** key entity.

| Column        | Type   | Constraints                                                                                              | Notes                                                                                                                                            |
| ------------- | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | `TEXT` | PRIMARY KEY                                                                                              | `randomUUID()`                                                                                                                                   |
| `email`       | `TEXT` | `NOT NULL`                                                                                               | Not unique alone — superseded rows keep history; uniqueness enforced at the application layer for the single _pending_ row per email (see below) |
| `token`       | `TEXT` | `NOT NULL`, `UNIQUE`                                                                                     | Opaque, `randomBytes(32).toString('base64url')` (research.md #2) — the exact value in the invite link                                            |
| `role`        | `TEXT` | `NOT NULL CHECK (role IN ('ADMIN', 'MEMBER'))`                                                           | Role the resulting account receives on acceptance                                                                                                |
| `status`      | `TEXT` | `NOT NULL CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','CANCELLED','SUPERSEDED')) DEFAULT 'PENDING'` | Application-driven state machine, research.md #4 (optimistic `UPDATE ... WHERE status = $expected`)                                              |
| `invited_by`  | `TEXT` | `NOT NULL REFERENCES users(id)`                                                                          | Admin who sent it (audit trail, Principle V)                                                                                                     |
| `created_at`  | `TEXT` | `NOT NULL DEFAULT (STRFTIME(...))`                                                                       | "Send time" shown to admins (FR-010)                                                                                                             |
| `expires_at`  | `TEXT` | `NOT NULL`                                                                                               | `created_at` + `INVITATION_EXPIRY_DAYS` (default 7, research.md #2)                                                                              |
| `accepted_at` | `TEXT` | `NULL`                                                                                                   | Set on successful acceptance; also the point token becomes permanently inert                                                                     |

**Indexes**:

- `CREATE UNIQUE INDEX invitations_token_idx ON invitations (token)` — token lookup on the
  invitee-facing accept page is the hottest read path for this table.
- `CREATE INDEX invitations_email_idx ON invitations (email COLLATE NOCASE)` — backs the
  email-availability lookup (research.md #6) and the "supersede prior pending invitation" check.

**Validation rules** (`libs/domain/invitations`):

- Only one `PENDING` invitation may exist per email at a time — enforced at the application layer
  (not a partial unique index, to keep the superseded-row history intact per Principle V's
  auditability rationale): sending a new invitation to an email with an existing `PENDING` row sets
  that row's `status = 'SUPERSEDED'` in the same transaction as creating the new row (FR-009).
- Inviting an email with an existing `ACTIVE` or `ARCHIVED` user account is rejected before any row
  is written (FR-008, research.md #6).
- A `PENDING` row past `expires_at` is treated as `EXPIRED` at read time (lazy, matching spec 005's
  session-expiry pattern) — the accept-page lookup and the admin-facing list both apply this check
  rather than requiring a background job to flip the column, though the retention-sweep timer
  (research.md #5) also opportunistically writes `status = 'EXPIRED'` on encountered stale rows to
  keep the admin list accurate without a fresh read.
- Cancel: `PENDING → CANCELLED` only (`UPDATE ... WHERE status = 'PENDING'`, research.md #4 guard).
- Resend: reuses the "supersede" path above — generates a fresh token/expiry as a new row, marks
  the old `PENDING` row `SUPERSEDED`. Resending does not require the old row to still be valid by
  clock (an admin resending an about-to-expire invite is exactly the intended use).
- Accept: `PENDING → ACCEPTED` only, guarded by `status = 'PENDING' AND expires_at > now` in the
  same `UPDATE`; a token whose row is any other status, or whose row doesn't exist, or whose
  `expires_at` has passed, all produce the identical "specific message, nothing changed" response
  (FR-012) — the accept endpoint never distinguishes "not found" from "expired" from "already used"
  in its response body, only internally for logging.

**Lifecycle**:

```text
PENDING ──accept (valid, unexpired)──> ACCEPTED  (terminal; creates the User row)
PENDING ──expires_at elapses──> EXPIRED           (terminal, lazy-evaluated)
PENDING ──admin cancels──> CANCELLED              (terminal)
PENDING ──admin sends new invite to same email──> SUPERSEDED (terminal)
```

## Relationships

```text
users (1) ──< invitations (many)   # invited_by FK — an admin's sent invitations, no CASCADE (explicit deletion only, Principle V)
invitations (1) ──> users (1)      # on ACCEPTED: creates exactly one new users row (email, role, chosen password)
```
