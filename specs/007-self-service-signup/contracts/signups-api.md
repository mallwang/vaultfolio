# Contract: Signups API

**Feature**: `007-self-service-signup` | Shared DTOs live in
`libs/api-contract/src/lib/signups.ts`

Two audiences share this file: **visitor-facing** endpoints under `/api/signups` and
`/api/signups/token/:token` (`@Public()` — no session, mirroring `invitations-api.md`'s
token-lookup shape) and **admin-facing** endpoints under `/api/signups` (authenticated,
`@Roles('ADMIN')`, same as accounts-api.md/invitations-api.md). All responses use the structured
error convention per Principle II. This module is inert (all visitor-facing routes return `403
signup_disabled`) when `PUBLIC_SIGNUP_ENABLED=false` (research.md #5).

## Visitor-facing (public, no session — `@Public()`)

### `POST /api/signups`

Submits a sign-up request (FR-001).

**Request body** (`CreateSignupRequest`): `{ email: string; password: string }`

**Responses**:

| Status | Condition                                                                                                                                                                                            | Body                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 201    | Request created and verification email sent                                                                                                                                                          | `SignupSubmitted` (`{ email: string }` only — no id/token leaked to the visitor)                                  |
| 400    | Password fails the shared policy (same policy as 005/006)                                                                                                                                            | `{ "error": "invalid_password", "message": "..." }`                                                               |
| 409    | Email unavailable per `EmailAvailabilityService` — active/archived account, pending invitation, pending/verified signup, or blacklisted; **all four collapse to this one response** (FR-002, SC-004) | `{ "error": "email_unavailable", "message": "This email can't be used to sign up right now." }`                   |
| 403    | `PUBLIC_SIGNUP_ENABLED=false`                                                                                                                                                                        | `{ "error": "signup_disabled", "message": "Public sign-up is not available." }`                                   |
| 502    | Request row created, but verification email delivery failed                                                                                                                                          | `{ "error": "email_delivery_failed", "message": "Sign-up saved, but the verification email could not be sent." }` |

### `GET /api/signups/token/:token`

Looks up a verification token so the verify page can confirm/render state before acting (mirrors
`GET /api/invitations/token/:token`).

**Responses**:

| Status | Condition                                                                                                                              | Body                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 200    | Token maps to a `PENDING`, unexpired row                                                                                               | `{ email: string }`                                                                     |
| 410    | Token not found, row already `VERIFIED`/`APPROVED`/`REJECTED`, or past `expires_at` (FR-010) — all collapsed, no distinguishing detail | `{ "error": "invalid_token", "message": "This verification link is no longer valid." }` |

### `POST /api/signups/token/:token/verify`

Marks the request `VERIFIED` (FR-003) and notifies every admin (FR-004).

**Responses**:

| Status | Condition                                                                                                                                | Body                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 200    | Verified; admin-notification email(s) sent                                                                                               | `{ email: string; status: 'VERIFIED' }`                                                                  |
| 410    | Same "no longer valid" condition as the `GET` above, re-checked atomically at verify time (closes the race between page-load and submit) | `{ "error": "invalid_token", "message": "This verification link is no longer valid." }`                  |
| 502    | Verified, but admin-notification email delivery failed (surfaced, not silent per Assumptions)                                            | `{ "error": "email_delivery_failed", "message": "Verified, but admin notification could not be sent." }` |

## Admin-facing (authenticated, `@Roles('ADMIN')`)

### `GET /api/signups`

Lists sign-up requests (FR-005) — email, verification status, submission date. Includes all
statuses (history stays visible for audit, same rationale as `GET /api/invitations`).

**Responses**: `200` → `SignupSummary[]`

### `POST /api/signups/:id/approve`

Approves a `VERIFIED` request (FR-006): creates an active `ACTIVE`/`MEMBER` account and sends a
welcome email.

**Responses**:

| Status | Condition                                                                  | Body                                                                                                           |
| ------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 200    | Approved; account created, welcome email sent                              | `SignupSummary` (`status: 'APPROVED'`)                                                                         |
| 404    | No sign-up request with that id                                            | `{ "error": "not_found", "message": "Sign-up request not found." }`                                            |
| 400    | Request is not `VERIFIED` (FR-012 — unverified requests can't be resolved) | `{ "error": "not_verified", "message": "Only verified sign-up requests can be resolved." }`                    |
| 409    | Request already `APPROVED`/`REJECTED` (race, FR-008)                       | `{ "error": "already_resolved", "message": "This sign-up request was already resolved." }`                     |
| 502    | Account created, but welcome email delivery failed                         | `{ "error": "email_delivery_failed", "message": "Account created, but the welcome email could not be sent." }` |

### `POST /api/signups/:id/reject`

Rejects a `VERIFIED` request (FR-007): sends a rejection email (no reason exposed, FR-009) and
creates an `EmailBlacklist` entry.

**Request body** (`RejectSignupRequest`): `{ reason?: string }`

**Responses**:

| Status | Condition                                                     | Body                                                                                                         |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 200    | Rejected; address blacklisted, rejection email sent           | `SignupSummary` (`status: 'REJECTED'`)                                                                       |
| 404    | No sign-up request with that id                               | `{ "error": "not_found", "message": "Sign-up request not found." }`                                          |
| 400    | Request is not `VERIFIED`                                     | `{ "error": "not_verified", "message": "Only verified sign-up requests can be resolved." }`                  |
| 409    | Request already `APPROVED`/`REJECTED`                         | `{ "error": "already_resolved", "message": "This sign-up request was already resolved." }`                   |
| 502    | Rejected and blacklisted, but rejection email delivery failed | `{ "error": "email_delivery_failed", "message": "Rejected, but the notification email could not be sent." }` |

### `DELETE /api/signups/:id`

Deletes a sign-up entry (FR-011). Deleting a `REJECTED` entry also clears its
`EmailBlacklist` row, freeing the address; deleting a `PENDING`/`VERIFIED` entry just removes
the row (address was already available/reserved-only, nothing to clear).

**Responses**:

| Status | Condition                                            | Body                                                                |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------- |
| 200    | Deleted (blacklist cleared too if it was `REJECTED`) | `{ deleted: true }`                                                 |
| 404    | No sign-up request with that id                      | `{ "error": "not_found", "message": "Sign-up request not found." }` |

## Shared DTOs (`libs/api-contract/src/lib/signups.ts`)

```ts
export interface SignupSummary {
  id: string;
  email: string;
  status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  verifiedAt: string | null;
  resolvedAt: string | null;
}

export interface CreateSignupRequest {
  email: string;
  password: string;
}

export interface SignupSubmitted {
  email: string;
}

export interface RejectSignupRequest {
  reason?: string;
}

export interface SignupsErrorResponse {
  error:
    | 'invalid_password'
    | 'email_unavailable'
    | 'signup_disabled'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'not_found'
    | 'not_verified'
    | 'already_resolved';
  message: string;
}
```
