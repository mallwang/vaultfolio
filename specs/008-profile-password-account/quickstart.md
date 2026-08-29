# Quickstart: Validating Profile, Password & Account Self-Service

**Feature**: `008-profile-password-account`

Validates the feature's three user stories end-to-end against a running stack. See
[data-model.md](./data-model.md) for schema and
[contracts/profile-api.md](./contracts/profile-api.md) for request/response shapes. Depends on spec
005 (auth, sessions) and spec 006 (last-admin invariant, `AccountsService.deleteSelf`) already
being deployed.

## Prerequisites

- Docker Compose stack runnable per the constitution's Technology & Architecture Constraints, with
  specs 005–007 already migrated.
- Environment variables set before backend startup (in addition to specs 005–007's):
  ```bash
  EMAIL_CHANGE_EXPIRY_HOURS=24    # optional, default shown (spec Assumptions)
  PASSWORD_RESET_EXPIRY_HOURS=1   # optional, default shown (spec Assumptions)
  ```
  (SMTP vars `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`/`APP_BASE_URL` already
  required since spec 006 — reused unchanged by the new `profile/email.service.ts`.)
- A signed-in session as a `MEMBER` (non-admin) account, plus a second admin session for Scenario C
  (`POST /api/auth/sign-in`, spec 005) — the last-admin scenario specifically needs a household with
  ≥2 admins at the start so one can be demoted/observed without tripping the invariant early.

## Setup

```bash
pnpm nx run-many -t build -p backend frontend
docker compose up --build
```

Confirm the backend log shows `account_action_tokens` migrated.

## Scenario A — Display name & email change (User Story 1)

1. As any signed-in user, `PATCH /api/profile/display-name { displayName: "New Name" }` → expect
   `200`; reload the header (no full page reload) and confirm it reflects the new name immediately.
   **(Acceptance #1, FR-004)**
2. `PATCH /api/profile/display-name { displayName: "" }` and again with a 101-character string →
   expect `400 invalid_display_name` both times, name unchanged. **(Acceptance #2)**
3. `POST /api/profile/email-change { newEmail: "new@example.com" }` → expect `202`; confirm an email
   arrived at the configured SMTP catcher containing a link with a token; sign in with the
   _original_ email/password → still succeeds. **(Acceptance #3)**
4. `POST /api/profile/email-change { newEmail: <an existing account's email> }` → expect
   `409 email_unavailable`. **(Acceptance #4)**
5. Open the link from step 3: `GET /api/profile/email-change/token/:token` → expect `200`
   `{ newEmail }`; `POST .../confirm` → expect `200 { email: "new@example.com" }`; sign in with the
   new email → succeeds; sign in with the old email → fails. **(Acceptance #5)**
6. Repeat `POST .../confirm` on the same (now-used) token → expect `410 invalid_token`, nothing
   changes. **(Acceptance #6)**
7. `POST /api/profile/email-change { newEmail: "a@example.com" }` then again
   `{ newEmail: "b@example.com" }` before confirming either → confirm the _first_ token now 410s and
   only `b@example.com`'s token is `PENDING`. **(Acceptance #7)**

## Scenario B — Password change & forgot/reset password (User Story 2)

1. As a signed-in user with two active sessions (sign in twice, keep both cookies), `POST
/api/profile/password { currentPassword, newPassword }` with the correct current password using
   session A's cookie → expect `200`; replay any request with session B's cookie → expect `401`
   (invalidated); replay with session A's cookie → still succeeds (not invalidated).
   **(Acceptance #1, FR-005, research.md #5)**
2. `POST /api/profile/password` with a wrong `currentPassword` → expect `401
invalid_current_password`, password unchanged, no sessions invalidated. **(Acceptance #2)**
3. `POST /api/profile/forgot-password { email: <existing account> }` and
   `POST /api/profile/forgot-password { email: "nobody@example.com" }` → both return byte-identical
   `200 { accepted: true }`; only the first sends an actual email. **(Acceptance #3, SC-003)**
4. Open the reset link from step 3: `GET /api/profile/reset-password/token/:token` → expect `200`;
   `POST .../confirm { newPassword }` (policy-compliant) → expect `200` with a `SessionUser` body and
   a session cookie set; confirm sign-in with the new password succeeds and all prior sessions for
   that account are invalidated. **(Acceptance #4)**
5. Replay the same reset confirm call → expect `410 invalid_token`. Request a second reset for the
   same account before opening the first link → confirm the first token now 410s.
   **(Acceptance #5)**

## Scenario C — Self-account deletion (User Story 3)

1. As a `MEMBER` (non-admin, previously blocked by `/api/accounts`'s `@Roles('ADMIN')`),
   `DELETE /api/profile/account` → expect `204`; confirm the session cookie is now rejected on the
   next request and the account's holdings are gone. **(Acceptance #3, closes research.md #1's gap)**
2. As the household's sole `ACTIVE` `ADMIN`, `DELETE /api/profile/account` → expect
   `409 last_admin`; confirm the account and its data are fully intact afterward.
   **(Acceptance #4, SC-005)**
3. Promote a second account to `ADMIN`, then repeat step 2 with the _original_ admin → expect `204`
   this time. **(confirms the invariant is dynamic, not a one-time check)**
4. (Manual/fault-injection) Force a server error mid-deletion (e.g. stop the DB mid-request in a
   test double) → expect a `500 deletion_failed` and confirm the account is still fully queryable
   and sign-in-able afterward — no partial delete. **(Acceptance #6, FR-010)**

## Expected outcome

All steps above pass with the exact status codes/bodies specified — this is the operational
definition of SC-001 through SC-005 being met.
