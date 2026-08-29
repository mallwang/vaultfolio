# Quickstart: Validating Admin Account Management & Invitations

**Feature**: `006-admin-accounts-invitations`

Validates the feature's two user stories end-to-end against a running stack. See
[data-model.md](./data-model.md) for schema and
[contracts/accounts-api.md](./contracts/accounts-api.md) /
[contracts/invitations-api.md](./contracts/invitations-api.md) for request/response shapes. Depends
on spec 005 (auth, sessions, roles) already being deployed and a bootstrap admin present.

## Prerequisites

- Docker Compose stack runnable per the constitution's Technology & Architecture Constraints, with
  spec 005's auth already migrated.
- Environment variables set before backend startup (in addition to spec 005's):
  ```bash
  SMTP_HOST=localhost
  SMTP_PORT=1025          # e.g. a local Mailpit/MailHog catcher for manual testing
  SMTP_USER=
  SMTP_PASSWORD=
  SMTP_FROM=vaultfolio@example.com
  ACCOUNT_RETENTION_DAYS=30       # optional, defaults shown
  INVITATION_EXPIRY_DAYS=7        # optional, defaults shown
  ```
- A signed-in session as the bootstrap admin (`POST /api/auth/sign-in`, spec 005).

## Setup

```bash
pnpm nx run-many -t build -p backend frontend
docker compose up --build
```

Confirm the backend log shows the `invitations` table migrated and no startup error from the
`EmailService` (a misconfigured SMTP host should not crash the process — same "surface via a
reported error, not a crash" pattern as spec 005's DB startup, per the spec's own Assumptions).

## Scenario A — Full account lifecycle (User Story 1)

1. `GET /api/accounts` as the bootstrap admin → expect `200` with exactly one row
   (`isLastActiveAdmin: true`). **(Acceptance #1)**
2. Create a second account (via Scenario B below, or a direct test-only insert), then
   `PATCH /api/accounts/:memberId/role { role: 'ADMIN' }` → expect `200`; sign in as that member,
   confirm their very next request reflects `ADMIN` privileges (e.g. `GET /api/accounts` no longer
   403s for them). **(Acceptance #7)**
3. `POST /api/accounts/:memberId/archive` → expect `200`, `status: 'ARCHIVED'`. Attempt sign-in for
   that email → expect `401`. If that member had an active session cookie from before archival,
   replay a request with it → expect `401` (session invalidated, not just sign-in blocked).
   **(Acceptance #2, SC-004)**
4. `POST /api/accounts/:memberId/reactivate` within the retention window → expect `200`,
   `status: 'ACTIVE'`; sign in with that account's original password → expect success, and confirm
   any data owned by that account (e.g. holdings) is unchanged. **(Acceptance #3)**
5. As a `MEMBER`-role session, call any `/api/accounts/*` route directly → expect `403 forbidden`,
   regardless of what the UI would show. **(Acceptance #4, FR-006)**
6. With only one `ACTIVE` admin remaining, attempt `PATCH .../role { role: 'MEMBER' }`,
   `POST .../archive`, and `DELETE /api/accounts/:selfId` on that admin → expect `409 last_admin`
   on all three. **(Acceptance #5, #6, SC-003)**

## Scenario B — Email invitation, end to end (User Story 2)

1. As admin, `POST /api/invitations { email: "new.member@example.com", role: "MEMBER" }` → expect
   `201`; confirm an email arrived at the configured SMTP catcher containing a link with a token.
   **(Acceptance #1)**
2. `GET /api/invitations` → confirm the new row's `status: 'PENDING'` and `createdAt` are visible.
   **(Acceptance #2)**
3. `POST /api/invitations { email: "new.member@example.com", role: "MEMBER" }` again (second
   invite, same email) → expect `201` for the new row, then confirm the _first_ row's status is now
   `SUPERSEDED` and its original token 410s on `GET /api/invitations/token/:oldToken`.
   **(Acceptance #4, FR-009)**
4. `POST /api/invitations { email: <existing active admin's email>, role: "MEMBER" }` → expect
   `409 account_exists`. **(Acceptance #3, FR-008)**
5. Open the _current_ (non-superseded) invite link: `GET /api/invitations/token/:token` → expect
   `200` with the invited email/role; `POST /api/invitations/token/:token/accept` with a
   policy-compliant password → expect `201` + `SessionUser` + session cookie; confirm subsequent
   sign-in with that email/password succeeds. **(Acceptance #5)**
6. Replay the same accept call (already used) → expect `410 invalid_invitation`, and confirm no
   duplicate account was created and the invitation row's `status` is still exactly `ACCEPTED` (not
   flipped to anything else). **(Acceptance #6, SC-002)**
7. Send a fresh invitation, then `POST /api/invitations/:id/cancel` before it's opened; attempt
   `GET /api/invitations/token/:token` for it → expect `410 invalid_invitation`.
   **(Acceptance #6, FR-012)**
8. (Manual/time-shifted) Let an invitation's `expires_at` pass without acceptance; open its link →
   expect `410 invalid_invitation` with no state change. **(Acceptance #6, SC-002)**
9. Temporarily point `SMTP_HOST` at an unreachable host, then `POST /api/invitations` → expect
   `502 email_delivery_failed`, but confirm the invitation row still exists (`GET /api/invitations`
   shows it `PENDING`) so the admin can `POST /api/invitations/:id/resend` once SMTP is restored.

## Expected outcome

All steps above pass with the exact status codes/bodies specified — this is the operational
definition of SC-001 through SC-004 being met.
