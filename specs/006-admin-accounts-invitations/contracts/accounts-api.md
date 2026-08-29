# Contract: Accounts API

**Feature**: `006-admin-accounts-invitations` | Shared DTOs live in
`libs/api-contract/src/lib/accounts.ts`

All endpoints are under `/api/accounts`. All require an authenticated session (`AuthGuard`, spec 005) **and** `@Roles('ADMIN')` (`RolesGuard`, spec 005) — a non-admin gets 403 regardless of what
the UI shows (FR-006). All responses use the structured error convention (status code +
machine-readable error body) per Principle II.

## `GET /api/accounts`

Lists every account, active and archived (FR-001).

**Responses**:

| Status | Condition                     | Body               |
| ------ | ----------------------------- | ------------------ |
| 200    | Always (admin, valid session) | `AccountSummary[]` |

`AccountSummary`:

```ts
{
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'ARCHIVED';
  archivedAt: string | null;
  retentionExpiresAt: string | null; // null unless status === 'ARCHIVED'
  isLastActiveAdmin: boolean; // true only for the sole remaining ACTIVE admin — UI uses
  // this to disable role/archive/delete controls (design.md)
}
```

## `PATCH /api/accounts/:id/role`

Changes a member's role (FR-002).

**Request body** (`ChangeRoleRequest`): `{ role: 'ADMIN' | 'MEMBER' }`

**Responses**:

| Status | Condition                                   | Body                                                                                     |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 200    | Role changed                                | `AccountSummary`                                                                         |
| 404    | No account with that id                     | `{ "error": "not_found", "message": "Account not found." }`                              |
| 409    | Would demote the last active admin (FR-004) | `{ "error": "last_admin", "message": "At least one active administrator must remain." }` |

Takes effect on the account's very next request (Acceptance Scenario 7) — enforced automatically
because `AuthGuard` reads role fresh from the `users` table on every request (spec 005); no session
invalidation needed for a role change alone.

## `POST /api/accounts/:id/archive`

Archives an account: revokes access, retains data for the retention window (FR-003), invalidates
all of that account's active sessions immediately (FR-005).

**Responses**:

| Status | Condition                                       | Body                                                                                     |
| ------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 200    | Archived                                        | `AccountSummary` (now `status: 'ARCHIVED'`, `retentionExpiresAt` populated)              |
| 404    | No account with that id                         | `{ "error": "not_found", "message": "Account not found." }`                              |
| 409    | Would archive the last active admin (FR-004)    | `{ "error": "last_admin", "message": "At least one active administrator must remain." }` |
| 409    | Account already archived (race, research.md #4) | `{ "error": "already_archived", "message": "This account was already archived." }`       |

## `POST /api/accounts/:id/reactivate`

Restores an archived account within its retention window (FR-003).

**Responses**:

| Status | Condition                                                                      | Body                                                                                         |
| ------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 200    | Reactivated                                                                    | `AccountSummary` (now `status: 'ACTIVE'`, `archivedAt`/`retentionExpiresAt` cleared)         |
| 404    | No account with that id, or account is already `ACTIVE` (race, research.md #4) | `{ "error": "not_found", "message": "Account not found." }`                                  |
| 410    | Retention window has elapsed (data already/about to be swept)                  | `{ "error": "retention_expired", "message": "This account's retention window has passed." }` |

## `DELETE /api/accounts/:id`

Self-deletion path referenced by FR-004/Acceptance Scenario 6 — an admin deleting their own
account. (Deleting _other_ accounts is out of scope: the lifecycle is archive → retention → sweep,
per FR-003; this endpoint only ever operates on the caller's own id.)

**Responses**:

| Status | Condition                                                       | Body                                                                                     |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 204    | Own account deleted; sessions invalidated                       | —                                                                                        |
| 403    | `:id` is not the caller's own id                                | `{ "error": "forbidden", "message": "You do not have access to this resource." }`        |
| 409    | Caller is the last active admin (FR-004, Acceptance Scenario 6) | `{ "error": "last_admin", "message": "At least one active administrator must remain." }` |

## Shared DTOs (`libs/api-contract/src/lib/accounts.ts`)

```ts
export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'ARCHIVED';
  archivedAt: string | null;
  retentionExpiresAt: string | null;
  isLastActiveAdmin: boolean;
}

export interface ChangeRoleRequest {
  role: 'ADMIN' | 'MEMBER';
}

export interface AccountsErrorResponse {
  error: 'not_found' | 'last_admin' | 'already_archived' | 'retention_expired' | 'forbidden';
  message: string;
}
```
