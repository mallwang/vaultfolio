# Contract: Invitations API

**Feature**: `006-admin-accounts-invitations` | Shared DTOs live in
`libs/api-contract/src/lib/invitations.ts`

Two audiences share this file: **admin-facing** endpoints under `/api/invitations` (authenticated,
`@Roles('ADMIN')`, same as accounts-api.md) and **invitee-facing** endpoints under
`/api/invitations/token/:token` (`@Public()` — the invitee has no session by definition, Edge
Cases). All responses use the structured error convention per Principle II.

## Admin-facing

### `POST /api/invitations`

Invites a new member by email (FR-007). The admin never sees or sets a password.

**Request body** (`CreateInvitationRequest`): `{ email: string; role: 'ADMIN' | 'MEMBER' }`

**Responses**:

| Status | Condition                                                                                  | Body                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 201    | Invitation created and emailed; supersedes any prior pending invite to this email (FR-009) | `InvitationSummary`                                                                                                    |
| 409    | Email already has an active or archived account (FR-008)                                   | `{ "error": "account_exists", "message": "This email already has an account." }`                                       |
| 502    | Invitation row created, but email delivery failed (research.md #1)                         | `{ "error": "email_delivery_failed", "message": "Invitation saved, but the email could not be sent. Try resending." }` |

### `GET /api/invitations`

Lists invitations with status and send time (FR-010). Includes all statuses (admins can see
history, not just pending) so cancelled/expired/superseded rows remain visible for audit.

**Responses**: `200` → `InvitationSummary[]`

### `POST /api/invitations/:id/cancel`

**Responses**:

| Status | Condition                                                | Body                                                                                                            |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 200    | Cancelled                                                | `InvitationSummary` (`status: 'CANCELLED'`)                                                                     |
| 404    | No invitation with that id                               | `{ "error": "not_found", "message": "Invitation not found." }`                                                  |
| 409    | Invitation is no longer `PENDING` (race, research.md #4) | `{ "error": "already_resolved", "message": "This invitation was already accepted, cancelled, or superseded." }` |

### `POST /api/invitations/:id/resend`

Generates a fresh token/expiry, supersedes the old row (FR-009/FR-010).

**Responses**:

| Status | Condition                                              | Body                                                                                                                   |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 201    | New invitation created, old one superseded, re-emailed | `InvitationSummary` (the new row)                                                                                      |
| 404    | No invitation with that id                             | `{ "error": "not_found", "message": "Invitation not found." }`                                                         |
| 409    | Invitation is no longer `PENDING`                      | `{ "error": "already_resolved", "message": "This invitation was already accepted, cancelled, or superseded." }`        |
| 502    | New row created, but email delivery failed             | `{ "error": "email_delivery_failed", "message": "Invitation saved, but the email could not be sent. Try resending." }` |

## Invitee-facing (public, no session — `@Public()`)

### `GET /api/invitations/token/:token`

Looks up a token so the accept page can render the invited email/role before the invitee submits a
password (design.md's "Accept-invite page").

**Responses**:

| Status | Condition                                                                                                                                                        | Body                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 200    | Token maps to a `PENDING`, unexpired row                                                                                                                         | `{ email: string; role: 'ADMIN' \| 'MEMBER' }`                                             |
| 410    | Token not found, or row is `ACCEPTED`/`EXPIRED`/`CANCELLED`/`SUPERSEDED`, or past `expires_at` (FR-012) — all collapsed to one outcome, no distinguishing detail | `{ "error": "invalid_invitation", "message": "This invitation link is no longer valid." }` |

### `POST /api/invitations/token/:token/accept`

Activates the account (FR-011): creates the `users` row with the invited email/role and the chosen
password, marks the invitation `ACCEPTED`, and signs the new user in (same session-cookie mechanism
as `POST /api/auth/sign-in`, spec 005).

**Request body** (`AcceptInvitationRequest`): `{ password: string; displayName: string }`

**Responses**:

| Status | Condition                                                                                                                                                                          | Body                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 201    | Account created and activated; `Set-Cookie` with a new session (signed in immediately)                                                                                             | `SessionUser` (spec 005 shape, from `libs/api-contract/src/lib/auth.ts`)                   |
| 400    | Password fails the shared policy (`libs/domain/auth/password-policy.ts`, spec 005)                                                                                                 | `{ "error": "invalid_password", "message": "..." }` (same shape spec 005 uses at sign-up)  |
| 410    | Same "no longer valid" condition as the `GET` above (FR-012) — atomically re-checked at accept time, not just at the earlier `GET`, to close the race between page-load and submit | `{ "error": "invalid_invitation", "message": "This invitation link is no longer valid." }` |

Reusing a link after this call succeeds MUST hit the same 410 path on any subsequent `GET`/`POST`
for that token — nothing about the invitation or any account changes on a rejected reuse (FR-012,
SC-002).

## Shared DTOs (`libs/api-contract/src/lib/invitations.ts`)

```ts
export interface InvitationSummary {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';
  invitedBy: string; // admin's display name
  createdAt: string;
  expiresAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface InvitationTokenLookup {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AcceptInvitationRequest {
  password: string;
  displayName: string;
}

export interface InvitationsErrorResponse {
  error:
    | 'account_exists'
    | 'not_found'
    | 'already_resolved'
    | 'email_delivery_failed'
    | 'invalid_invitation'
    | 'invalid_password';
  message: string;
}
```
