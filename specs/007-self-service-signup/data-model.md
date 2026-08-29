# Data Model: Public Self-Service Sign-Up with Admin Approval

See [research.md](./research.md) #3 for the schema-design rationale.

## SignupRequest

A public registration attempt awaiting review.

| Field          | Type                                                  | Notes                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `TEXT` (UUID)                                         | Primary key.                                                                                                                                                                                                                                       |
| `email`        | `TEXT`                                                | Case-insensitive unique-ish (see Constraints below), not globally UNIQUE at the DB level because a resolved row and a new attempt must be able to coexist historically — enforced at the application layer via `EmailAvailabilityService` instead. |
| `passwordHash` | `TEXT`                                                | Hashed with the same `bcrypt` policy as `users.password_hash`.                                                                                                                                                                                     |
| `token`        | `TEXT`                                                | Unique, single-use verification token.                                                                                                                                                                                                             |
| `status`       | `'PENDING' \| 'VERIFIED' \| 'APPROVED' \| 'REJECTED'` | State machine below.                                                                                                                                                                                                                               |
| `createdAt`    | `TEXT` (ISO 8601)                                     | Submission timestamp.                                                                                                                                                                                                                              |
| `expiresAt`    | `TEXT` (ISO 8601)                                     | Verification-link expiry; only meaningful while `status = 'PENDING'`.                                                                                                                                                                              |
| `verifiedAt`   | `TEXT \| null`                                        | Set when the verification link is opened.                                                                                                                                                                                                          |
| `resolvedAt`   | `TEXT \| null`                                        | Set when an admin approves or rejects.                                                                                                                                                                                                             |
| `resolvedBy`   | `TEXT \| null` (FK → `users.id`)                      | Admin who resolved it.                                                                                                                                                                                                                             |

### State transitions

```
PENDING --(verification link opened, before expiry)--> VERIFIED
PENDING --(expiry sweep, unused)--> [row deleted]
VERIFIED --(admin approves)--> APPROVED   (creates active `users` row, sends welcome email)
VERIFIED --(admin reject)--> REJECTED     (creates `EmailBlacklist` row, sends rejection email)
```

All transitions are race-guarded `UPDATE signup_requests SET status = $new WHERE id = $id AND
status = $expected` (affected-row-count check), mirroring `InvitationsRepository` — a
concurrent second resolution attempt affects 0 rows and is reported to the caller as
`already_resolved` (FR-008, edge case: concurrent admin resolution).

### Validation rules

- `email`: same format validation as invitation/account emails; availability checked via
  `EmailAvailabilityService` at submission time only (FR-002) — not re-checked at verification
  or resolution time, since the request itself already reserves the address once `PENDING`.
- `passwordHash`: password must pass the existing password policy (shared with 005/006) before
  hashing.
- Only a `VERIFIED` request may transition to `APPROVED`/`REJECTED` (FR-012) — enforced by the
  guarded `UPDATE ... WHERE status = 'VERIFIED'`.
- Only a `PENDING` request may transition to `VERIFIED`, and only before `expiresAt` — an
  expired-but-not-yet-swept `PENDING` row is treated as invalid by the verify endpoint itself
  (lazy-expiry check, same pattern as `InvitationsRepository`'s lazy `markExpired`), not just by
  the background sweep.

## EmailBlacklist

The retained record of a rejected sign-up, blocking new attempts against that address.

| Field             | Type                                       | Notes                                            |
| ----------------- | ------------------------------------------ | ------------------------------------------------ |
| `email`           | `TEXT`, PRIMARY KEY, `COLLATE NOCASE`      | One row per blocked address.                     |
| `reason`          | `TEXT \| null`                             | Optional; never exposed to the visitor (FR-009). |
| `createdAt`       | `TEXT` (ISO 8601)                          | When the rejection happened.                     |
| `signupRequestId` | `TEXT \| null` (FK → `signup_requests.id`) | The rejected request this entry originated from. |

### Lifecycle

- Created by `SignupsService.reject()` in the same transaction as the `signup_requests` status
  transition to `REJECTED`.
- Deleted by `SignupsService.delete()` when an admin deletes a `REJECTED` `signup_requests` row
  (FR-011) — this is what "clears the blacklist status" means concretely: the `email_blacklist`
  row is removed, freeing the address for a new sign-up or invitation. Deleting a
  `PENDING`/`VERIFIED` row never touches `email_blacklist` (nothing to clear).

## Extension to existing entities

- **User Account** (`users` table, 005/006): unchanged schema. `SignupsService.approve()` inserts
  a new `ACTIVE`/`MEMBER` row exactly as `InvitationsService.accept()` does today.
- **`EmailAvailabilityService`** (extracted, research.md #1): not a persisted entity — a
  read-only aggregation across `users`, `invitations`, `signup_requests`, and `email_blacklist`.

## Combined availability lookup (FR-002)

`EmailAvailabilityService.check(email)` queries, in order, and returns the first match:

1. `users` (any status) → `has_account`
2. `invitations` where `status = 'PENDING'` → `has_pending_invitation`
3. `signup_requests` where `status IN ('PENDING','VERIFIED')` → `has_pending_signup`
4. `email_blacklist` → `blacklisted`
5. none of the above → `available`

`SignupsController.submit()` maps every non-`available` result to the same generic rejection
response (no distinction surfaced to the visitor — SC-004), while `InvitationsController.create()`
continues to map `has_account`/`has_pending_invitation` to its existing admin-facing messages
(admins ARE allowed to see which case applied, since they're not the party being screened out).
