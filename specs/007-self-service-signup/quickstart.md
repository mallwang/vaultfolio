# Quickstart: Public Self-Service Sign-Up with Admin Approval

Validates the two user stories end-to-end. Assumes the backend is running with
`PUBLIC_SIGNUP_ENABLED=true`, valid `SMTP_*`/`APP_BASE_URL` config (or a test SMTP catcher such
as MailHog/Mailpit), and at least one existing admin account (from spec 005/006 bootstrap).

## Prerequisites

- `npm exec nx serve backend` and `npm exec nx serve frontend` (or the Docker Compose stack) running.
- An email sink to read outgoing mail — e.g. a local SMTP catcher — since verification, admin
  notification, welcome, and rejection emails are all real sends in dev.
- One admin session (sign in with the bootstrap admin from 005/006).

## Story 1 — Visitor submits and verifies a sign-up

1. `POST /api/signups` with a fresh email + policy-compliant password → expect `201`, body
   `{ email }`. See [contracts/signups-api.md](./contracts/signups-api.md).
2. Read the verification email from the sink; extract the token from its link.
3. `GET /api/signups/token/:token` → expect `200`, `{ email }` matching step 1.
4. `POST /api/signups/token/:token/verify` → expect `200`, `{ email, status: 'VERIFIED' }`.
5. Confirm an admin-notification email arrived in the sink.
6. Repeat step 1 with the **same** email again → expect `409 email_unavailable` (data-model.md
   combined-lookup step 3, `has_pending_signup`).

**Expiry path**: submit a new sign-up, do not open the verification link, wait past the
configured expiry (or lower it via env var for the test), then confirm `GET
/api/signups/token/:token` on that token returns `410`, and that a fresh `POST /api/signups`
with the same email now succeeds (address freed with no residual blacklist — Edge Cases).

## Story 2 — Admin reviews and resolves

1. Sign in as an admin; `GET /api/signups` → the verified request from Story 1 appears with
   `status: 'VERIFIED'`, distinct from `GET /api/invitations` and `GET /api/accounts`.
2. `POST /api/signups/:id/approve` → expect `200`, `status: 'APPROVED'`; confirm a welcome email
   arrived in the sink.
3. Sign in as the new user with the password from Story 1 step 1 → succeeds (account is active).
4. Submit a second sign-up with a new email, verify it, then `POST /api/signups/:id/reject` with
   `{ reason: "test" }` → expect `200`, `status: 'REJECTED'`; confirm a rejection email arrived
   **without** the reason text in it (FR-009).
5. `POST /api/signups` again with that same rejected email → expect `409 email_unavailable`
   (indistinguishable from any other unavailable case — SC-004).
6. `DELETE /api/signups/:id` on the rejected entry → expect `200 { deleted: true }`; then repeat
   step 5 → now expect `201` (blacklist cleared, address available again — FR-011).
7. Concurrency check: verify a third request, then fire two concurrent
   `POST /api/signups/:id/approve` calls → expect exactly one `200` and one `409
already_resolved`, and exactly one new account created (FR-008, Edge Cases).
8. Attempt `POST /api/signups/:id/approve` on a still-`PENDING` (unverified) request → expect
   `400 not_verified` (FR-012).

## Toggle check

With `PUBLIC_SIGNUP_ENABLED=false`, repeat Story 1 step 1 → expect `403 signup_disabled`; admin
routes (`GET /api/signups`, approve/reject/delete) remain available regardless of the toggle, so
existing queued requests can still be resolved.
