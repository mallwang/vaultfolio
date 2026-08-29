# Data Model: Profile, Password & Account Self-Service

**Feature**: `008-profile-password-account` | **Date**: 2026-08-29

All monetary/quantity columns are unaffected. New/changed tables follow the existing `users`/
`sessions`/`invitations`/`signup_requests` conventions from specs 005–007: `TEXT` primary keys
(`randomUUID()`), `TEXT` timestamps in `STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')` form, `CHECK`
constraints enforced at the DB layer, application-layer validation in a domain lib per Principle I.

## Change to Entity: User Account (`users` table)

Extends the table spec 005 created (005's `id`, `email`, `display_name`, `password_hash`, `role`,
`status`, `failed_attempts`, `locked_until`; 006's `archived_at`, `retention_expires_at`). Maps to
this spec's **User Account** key entity ("gains an optional pending-email field and associated
token reference while an email change is outstanding").

| Column          | Type   | Constraints | Notes                                                                                                                         |
| --------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pending_email` | `TEXT` | `NULL`      | Set while an `EMAIL_CHANGE` token is outstanding for this user; cleared on confirm, cancel, or superseding by a newer request |

No separate "token reference" column is needed on `users` — `account_action_tokens` already carries
`user_id` + `purpose`, so "the account's outstanding email-change token" is
`findPendingByUserAndPurpose(userId, 'EMAIL_CHANGE')`, not a second pointer to keep in sync.

`display_name`, `email`, and `password_hash` themselves already exist (spec 005) and are simply
written to by this spec's new mutators — no schema change needed for those three.

**Migration** (in `DatabaseService.migrateProfile()`, following 006/007's `PRAGMA table_info`
idempotent pattern):

1. If `users.pending_email` does not yet exist: `ALTER TABLE users ADD COLUMN pending_email TEXT NULL`.

**Validation rules** (application layer, `apps/backend/src/profile/profile.service.ts` +
`libs/domain/auth`):

- Display name: 1–100 characters (FR-001) — rejected before any write, existing value unchanged.
- Email-change request: the new address MUST pass `EmailAvailabilityService.check()` as `available`
  (research.md #2); on acceptance, `users.pending_email` is set and an `account_action_tokens` row
  (`purpose = 'EMAIL_CHANGE'`) is created in the same transaction; any prior `PENDING`
  `EMAIL_CHANGE` token for that user is superseded (research.md #3).
- Email-change confirm: `users.email = pending_email`, `users.pending_email = NULL`, token row
  marked `USED`, all in one transaction guarded by the token's own status-guarded `UPDATE`
  (research.md #3) — a token that fails the guard (expired/used/superseded) changes nothing.
- Password change: requires `argon2.verify(user.passwordHash, currentPassword)` to succeed first
  (mirrors `AuthService.signIn`'s verify call); `validatePassword()` (`libs/domain/auth`, unchanged
  from 005) applied to the new password; on success, `users.password_hash` updated and
  `SessionsRepository.deleteAllForUserExcept(userId, currentSessionId)` called (research.md #5).
- Password reset (via link): same `validatePassword()` check on the new password; no current-password
  check (the token itself is the proof of ownership); on success, `users.password_hash` updated,
  `SessionsRepository.deleteAllForUser(userId)` called (no current session to spare on this path —
  research.md #5), a fresh session is created and returned so the response can sign the user in
  (spec Acceptance Scenario: "the token is consumed, and the user is signed in").
- Self-delete: unchanged — delegates entirely to `AccountsService.deleteSelf` (research.md #1).

**State transitions** (unaffected columns omitted):

```text
email ──(EMAIL_CHANGE token confirmed)──> email = pending_email, pending_email = NULL
password_hash ──(change or reset)──> password_hash = new hash
```

## Entity: Account Action Token (`account_action_tokens` table)

Maps to spec's **Email Verification Token** key entity ("a generic single-use, expiring token used
for both email-change confirmation and password reset, distinguished by a purpose field").

| Column       | Type   | Constraints                                                                              | Notes                                                                                                 |
| ------------ | ------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`         | `TEXT` | PRIMARY KEY                                                                              | `randomUUID()`                                                                                        |
| `user_id`    | `TEXT` | `NOT NULL REFERENCES users(id)`                                                          | The account this token acts on                                                                        |
| `purpose`    | `TEXT` | `NOT NULL CHECK (purpose IN ('EMAIL_CHANGE','PASSWORD_RESET'))`                          | Discriminator — a lookup always filters by `(token, purpose)`, never `token` alone (research.md #3)   |
| `new_email`  | `TEXT` | `NULL`                                                                                   | Set only for `purpose = 'EMAIL_CHANGE'` rows; `NULL` for `PASSWORD_RESET`                             |
| `token`      | `TEXT` | `NOT NULL`, `UNIQUE`                                                                     | Opaque, `randomBytes(32).toString('base64url')` — the exact value in the emailed link                 |
| `status`     | `TEXT` | `NOT NULL CHECK (status IN ('PENDING','USED','EXPIRED','SUPERSEDED')) DEFAULT 'PENDING'` | Application-driven state machine, mirroring `invitations`/`signup_requests` (status-guarded `UPDATE`) |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (STRFTIME(...))`                                                       | "Sent" time shown in the profile UI's "sent N minutes ago" banner (design.md)                         |
| `expires_at` | `TEXT` | `NOT NULL`                                                                               | `created_at` + purpose-specific window: 24h (`EMAIL_CHANGE`) / 1h (`PASSWORD_RESET`), research.md #3  |
| `used_at`    | `TEXT` | `NULL`                                                                                   | Set on successful confirm/reset — also the point the token becomes permanently inert                  |

**Indexes**:

- `CREATE UNIQUE INDEX account_action_tokens_token_idx ON account_action_tokens (token)` — the
  hottest read path (link click, signed-out).
- `CREATE INDEX account_action_tokens_user_purpose_idx ON account_action_tokens (user_id, purpose)`
  — backs "does this user have a pending token of this purpose" (supersede check, "cancel request"
  banner action).

**Validation rules** (`libs/domain/auth/src/lib/account-action-token.ts` for pure expiry/purpose
logic; transaction orchestration in `AccountActionTokensRepository`/`ProfileService`):

- Only one `PENDING` token may exist per `(user_id, purpose)` at a time — a new request supersedes
  the prior one in the same transaction as creating the new row (FR-002, Edge Cases), scoped
  strictly to the same purpose (a fresh `PASSWORD_RESET` request never touches an outstanding
  `EMAIL_CHANGE` row and vice versa).
- A `PENDING` row past `expires_at` is treated as `EXPIRED` at read time (lazy, matching
  006/007's pattern) — both the link-landing lookup and the "confirm"/"reset" action apply this
  check.
- Confirm/reset: `PENDING → USED` only, guarded by `status = 'PENDING' AND expires_at > now` in the
  same `UPDATE`; any other status, a nonexistent token, or an expired one all produce the identical
  "specific message, nothing changed" response (SC-002) — the endpoint never distinguishes "not
  found" from "expired" from "already used" in its response body, only internally for logging (same
  convention as 006's invitation-accept endpoint).
- Cancel (email-change only, "Cancel request" in design.md): `PENDING → SUPERSEDED` for that user's
  `EMAIL_CHANGE` row, clears `users.pending_email`. No equivalent user-facing cancel for
  `PASSWORD_RESET` — a stray reset request that's never opened simply expires.

**Lifecycle**:

```text
PENDING ──confirm/reset (valid, unexpired)──> USED       (terminal; applies the change)
PENDING ──expires_at elapses──> EXPIRED                   (terminal, lazy-evaluated)
PENDING ──new same-purpose request for same user──> SUPERSEDED (terminal)
PENDING ──user cancels (EMAIL_CHANGE only)──> SUPERSEDED  (terminal)
```

## Relationships

```text
users (1) ──< account_action_tokens (many)   # user_id FK; superseded/expired rows kept as audit
                                              # trail, no CASCADE (Principle V, matching invitations)
```

## Reused, unchanged entities

- **Session** (`sessions` table, spec 005) — no schema change. `SessionsRepository` gains one new
  method, `deleteAllForUserExcept` (research.md #5); the table itself is untouched.
- **Last-admin invariant** — no new representation; `canRemoveLastAdmin`
  (`libs/domain/auth/src/lib/last-admin.ts`, spec 006) is called exactly as-is via
  `AccountsService.deleteSelf` (research.md #1).
