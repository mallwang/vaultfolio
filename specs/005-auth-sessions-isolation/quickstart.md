# Quickstart: Validating Authentication, Sessions & Per-User Data Isolation

**Feature**: `005-auth-sessions-isolation`

Validates the feature's two user stories end-to-end against a running stack. See
[data-model.md](./data-model.md) for schema and [contracts/auth-api.md](./contracts/auth-api.md)
for request/response shapes.

## Prerequisites

- Docker Compose stack runnable per the constitution's Technology & Architecture Constraints.
- A clean (or fresh) `DATABASE_PATH` SQLite file, so the bootstrap-admin migration runs from empty.
- Environment variables set before first backend startup:
  ```bash
  BOOTSTRAP_ADMIN_EMAIL=admin@example.com
  BOOTSTRAP_ADMIN_PASSWORD=a-valid-8-to-200-char-password
  ```

## Setup

```bash
pnpm nx run-many -t build -p backend frontend
docker compose up --build
```

On first startup, confirm the backend log shows the bootstrap admin was created (Principle V —
observability), and that any pre-existing `holdings` rows were backfilled to that account
(research.md #7 / data-model.md migration).

## Scenario A — Sign in / sign out with a server-side session (User Story 1)

1. `POST /api/auth/sign-in` with `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` → expect `200` + `SessionUser`
   body + a `Set-Cookie` session cookie. **(Acceptance #1, #2)**
2. `POST /api/auth/sign-in` with a wrong password for the same email → expect `401` with the
   generic `invalid_credentials` body — repeat with a nonexistent email and confirm the body is
   byte-for-byte identical. **(Acceptance #3, SC-005)**
3. Without any cookie, `GET /api/holdings` → expect `401`. **(Acceptance #5, SC-001)**
4. With the Scenario A.1 cookie, `GET /api/holdings` → expect `200`.
5. `POST /api/auth/sign-out` with that cookie, then repeat step 4 with the _same_ (now stale)
   cookie → expect `401`. **(Acceptance #6, SC-003)**
6. Submit 6 consecutive wrong passwords for one account in quick succession → expect the 6th (or
   whichever crosses the configured threshold) response to be `429 account_locked`, and confirm
   the delay before the next allowed attempt increases on further failures.
   **(Acceptance #7, SC-004)**
7. (Manual/time-shifted) Leave a session idle past `SESSION_INACTIVITY_TIMEOUT_MINUTES`, then use
   it → expect `401`. **(Acceptance #4)**

## Scenario B — Each user keeps their own private data (User Story 2)

1. Create a second account (via the bootstrap admin, once admin-management ships — for this
   feature alone, a second row may be inserted directly for test purposes) with role `MEMBER`.
2. Sign in as User A (bootstrap admin), create a holding via `POST /api/holdings`.
3. Sign in as User B, `GET /api/holdings` → expect the list to **not** contain User A's holding.
   **(Acceptance #1, SC-002)**
4. As User B, attempt `GET /api/holdings/:idOfAsHoldingCreatedByA` → expect `404` (not `403` — see
   contracts/auth-api.md's ownership-leak note).
5. As User A, `GET /api/holdings` → still contains A's holding (B's writes/reads didn't affect it).
   **(Acceptance #2)**
6. As User A, view any dashboard/aggregate figure → confirm it reflects only A's holdings.
   **(Acceptance #3)**
7. Confirm the bootstrap-admin-owned, migrated pre-existing holdings (from Setup) are visible to
   User A and invisible to User B. **(Acceptance #4)**
8. As an admin account, attempt any read of User B's holdings via the API directly → expect `404`,
   confirming admin role never implies cross-user data access. **(Acceptance #5)**
9. Inspect every response body from steps above → confirm no `owner_id`/ownership field appears
   anywhere (FR-010).

## Expected outcome

All steps above pass with the exact status codes/bodies specified — this is the operational
definition of SC-001 through SC-005 being met.
