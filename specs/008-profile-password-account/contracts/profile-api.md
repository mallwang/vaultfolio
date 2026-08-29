# Contract: Profile API

**Feature**: `008-profile-password-account` | Shared DTOs live in
`libs/api-contract/src/lib/profile.ts`

All endpoints are under `/api/profile`. Most require an authenticated session (`AuthGuard`, spec 005) and carry **no** `@Roles()` restriction — every signed-in user, `ADMIN` or `MEMBER`, may call
them (closing the gap research.md #1 identifies against `/api/accounts/:id`). The
forgot/reset/verify-email routes are `@Public()` (spec 005 convention) since the caller may have no
session at that point. All responses use the structured error convention (status code +
machine-readable error body) per Principle II.

## `GET /api/profile`

Returns the caller's own profile, including any outstanding email-change request (design.md's
"pending" banner).

**Responses**:

| Status | Condition              | Body             |
| ------ | ---------------------- | ---------------- |
| 200    | Always (authenticated) | `ProfileSummary` |

## `PATCH /api/profile/display-name`

Updates the caller's own display name (FR-001).

**Request body** (`UpdateDisplayNameRequest`): `{ displayName: string }`

**Responses**:

| Status | Condition                        | Body                                                                                       |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| 200    | Updated                          | `ProfileSummary`                                                                           |
| 400    | Empty or over 100 chars (FR-001) | `{ "error": "invalid_display_name", "message": "Display name must be 1–100 characters." }` |

## `POST /api/profile/email-change`

Requests an email change (FR-002, FR-003). Sends a verification link to the _new_ address; the
current address remains active and usable for sign-in until confirmed.

**Request body** (`RequestEmailChangeRequest`): `{ newEmail: string }`

**Responses**:

| Status | Condition                                                     | Body                                                                                                 |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 202    | Verification email sent; any prior pending request superseded | `{ "pendingEmail": string }`                                                                         |
| 409    | `newEmail` already in use (research.md #2)                    | `{ "error": "email_unavailable", "message": "This email can't be used right now." }`                 |
| 502    | SMTP delivery failed (row still created; user may retry)      | `{ "error": "email_delivery_failed", "message": "Request saved, but the email could not be sent." }` |

## `POST /api/profile/email-change/cancel`

Cancels the caller's own outstanding email-change request (design.md's "Cancel request" banner
action). Idempotent — a no-op (still `204`) if nothing is pending.

**Responses**: `204` always (no body).

## `GET /api/profile/email-change/token/:token`

Signed-out-safe lookup for the confirmation link landing page (Edge Cases: "must work even when
clicked from a signed-out browser context") — `@Public()`.

**Responses**:

| Status | Condition                                        | Body                                                                       |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 200    | Token `PENDING` and unexpired                    | `{ "newEmail": string }`                                                   |
| 410    | Not found / expired / used / superseded (SC-002) | `{ "error": "invalid_token", "message": "This link is no longer valid." }` |

## `POST /api/profile/email-change/token/:token/confirm`

Confirms the email change (FR-002 Acceptance Scenario 5) — `@Public()`.

**Responses**:

| Status | Condition                         | Body                                                                       |
| ------ | --------------------------------- | -------------------------------------------------------------------------- |
| 200    | Confirmed; `users.email` updated  | `{ "email": string }`                                                      |
| 410    | Same as the lookup route (SC-002) | `{ "error": "invalid_token", "message": "This link is no longer valid." }` |

## `POST /api/profile/password`

Changes the caller's own password, confirming the current one (FR-005, FR-007). Invalidates the
caller's _other_ active sessions — not the one making this request (research.md #5).

**Request body** (`ChangePasswordRequest`): `{ currentPassword: string; newPassword: string }`

**Responses**:

| Status | Condition                                          | Body                                                                                           |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 200    | Changed; other sessions invalidated                | `{ "changed": true }`                                                                          |
| 400    | `newPassword` fails policy (8–200 chars, FR-007)   | `{ "error": "invalid_password", "message": "Password must be between 8 and 200 characters." }` |
| 401    | `currentPassword` incorrect (FR-005 Acceptance #2) | `{ "error": "invalid_current_password", "message": "Current password is incorrect." }`         |

## `POST /api/profile/forgot-password`

Requests a password-reset link (FR-006) — `@Public()`. Response is **identical** regardless of
whether `email` has an account (SC-003, research.md #6).

**Request body** (`ForgotPasswordRequest`): `{ email: string }`

**Responses**:

| Status | Condition | Body                   |
| ------ | --------- | ---------------------- |
| 200    | Always    | `{ "accepted": true }` |

There is deliberately no `404`/`409` variant — see research.md #6 for the timing-uniformity
rationale; a delivery failure on the _existing-account_ branch is logged server-side but still
returns the same `200 { accepted: true }` (surfacing an email-specific error here would itself leak
account existence).

## `GET /api/profile/reset-password/token/:token`

Signed-out-safe lookup for the reset-link landing page — `@Public()`.

**Responses**:

| Status | Condition                           | Body                                                                        |
| ------ | ----------------------------------- | --------------------------------------------------------------------------- |
| 200    | Token `PENDING` and unexpired       | `{ "valid": true }` (no email revealed — the link alone doesn't require it) |
| 410    | Not found / expired / used (SC-002) | `{ "error": "invalid_token", "message": "This link is no longer valid." }`  |

## `POST /api/profile/reset-password/token/:token/confirm`

Sets a new password using the reset token and signs the user in (FR-006 Acceptance Scenario 4) —
`@Public()`.

**Request body** (`ResetPasswordRequest`): `{ newPassword: string }`

**Responses**:

| Status | Condition                                        | Body                                                                                           |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 200    | Reset; all sessions invalidated, new one created | `SessionUser` (spec 005) + session cookie set, same shape as `POST /api/auth/sign-in`          |
| 400    | `newPassword` fails policy (FR-007)              | `{ "error": "invalid_password", "message": "Password must be between 8 and 200 characters." }` |
| 410    | Token invalid (SC-002)                           | `{ "error": "invalid_token", "message": "This link is no longer valid." }`                     |

## `DELETE /api/profile/account`

Permanently deletes the caller's own account (FR-008, FR-009, FR-010). Delegates entirely to
`AccountsService.deleteSelf` (research.md #1) — always operates on the caller, never takes an `:id`.

**Responses**:

| Status | Condition                                                | Body                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 204    | Deleted; all sessions invalidated                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 409    | Caller is the sole active administrator (FR-008, SC-005) | `{ "error": "last_admin", "message": "At least one active administrator must remain." }`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 500    | Unexpected server error mid-deletion (FR-010)            | `{ "error": "deletion_failed", "message": "Something went wrong. Your account was not changed." }` — account left fully intact (no partial delete; deletion is not run as a single DB transaction across `sessions`+`holdings`+`users` today per `UsersRepository.deleteById`'s sequential-statement note, so FR-010 is satisfied by ordering: nothing is deleted until the last-admin check and password/session lookups have already succeeded, minimizing the window for a mid-sequence failure — see research.md #1) |

## Shared DTOs (`libs/api-contract/src/lib/profile.ts`)

```ts
export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  pendingEmail: string | null;
}

export interface UpdateDisplayNameRequest {
  displayName: string;
}

export interface RequestEmailChangeRequest {
  newEmail: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface ProfileErrorResponse {
  error:
    | 'invalid_display_name'
    | 'email_unavailable'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'invalid_password'
    | 'invalid_current_password'
    | 'last_admin'
    | 'deletion_failed';
  message: string;
}
```
