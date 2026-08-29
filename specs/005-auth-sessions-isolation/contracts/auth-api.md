# Contract: Auth API

**Feature**: `005-auth-sessions-isolation` | Shared DTOs live in `libs/api-contract/src/lib/auth.ts`

All endpoints are under `/api/auth`. All responses use the existing structured error convention
(status code + machine-readable error body) per Principle II — no bare exceptions/HTML errors.

## `POST /api/auth/sign-in`

Public (no session required — annotated `@Public()`, subject to `@nestjs/throttler`'s global
per-IP rate limit as a secondary control per research.md #3).

**Request body** (`SignInRequest`):

```ts
{
  email: string;
  password: string;
}
```

**Responses**:

| Status | Condition                             | Body                                                                                                                                                                                             |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 200    | Valid credentials, account not locked | `SessionUser` (see below); `Set-Cookie` with the session cookie (httpOnly, `Secure` in prod, `SameSite=Lax`)                                                                                     |
| 401    | Wrong email or password               | `{ "error": "invalid_credentials", "message": "Invalid email or password." }` — deliberately identical whether the email exists or not (FR-008/SC-005)                                           |
| 429    | Account currently locked out          | `{ "error": "account_locked", "message": "Too many failed attempts. Try again later." }` — does not reveal exact unlock time (avoids confirming account existence/precise timing to an attacker) |

`SessionUser` (also the shape returned by `GET /api/auth/session`):

```ts
{
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
}
```

Note: `SessionUser` never includes `password_hash`, `failed_attempts`, `locked_until`, or any
other user's data — and no response anywhere in this API (or any other API in the app) includes a
record's `owner_id` (FR-010).

## `POST /api/auth/sign-out`

Requires an authenticated session.

**Request body**: none.

**Responses**:

| Status | Condition                                                                     | Body |
| ------ | ----------------------------------------------------------------------------- | ---- |
| 204    | Session destroyed server-side; cookie cleared (`Set-Cookie` with past expiry) | —    |

A subsequent request with the old cookie value MUST 401 (FR-003, session row is deleted not just
"logged out" client-side).

## `GET /api/auth/session`

Requires an authenticated session. Used by the frontend's route guard to check auth state on load
and by any client that wants to confirm the current identity/role without side effects.

**Responses**:

| Status | Condition                                                                                         | Body                                                             |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 200    | Valid, non-expired session                                                                        | `SessionUser`                                                    |
| 401    | No session cookie, or cookie doesn't match a live row, or session past inactivity/absolute expiry | `{ "error": "unauthenticated", "message": "Sign in required." }` |

## Cross-cutting: every other protected route

Applies to all existing and future routes not listed above (e.g. `/api/holdings/*`,
`/health` is the one explicit exception — public):

| Status | Condition                                                                                                                                                                                       | Body                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 401    | No valid session (missing/expired/deleted cookie)                                                                                                                                               | `{ "error": "unauthenticated", "message": "Sign in required." }`                                                             |
| 403    | Valid session, but role/ownership check fails (e.g. non-admin hitting an admin-only route; this spec does not yet add admin-only _business_ routes, but the guard contract is established here) | `{ "error": "forbidden", "message": "You do not have access to this resource." }`                                            |
| 404    | A record ID exists but is owned by a different user                                                                                                                                             | Standard "not found" body — **not** 403, so ownership never leaks via the status code (data-model.md's "Query scoping" note) |

## Shared DTOs (`libs/api-contract/src/lib/auth.ts`)

```ts
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AuthErrorResponse {
  error: 'invalid_credentials' | 'account_locked' | 'unauthenticated' | 'forbidden';
  message: string;
}
```
