# Quickstart: Validating OpenAPI/Swagger API Documentation

## Prerequisites

- Backend and frontend running via the existing local Docker Compose setup (or `nx serve backend`
  - `nx serve frontend` for pure local dev), per the repo's normal dev workflow.
- A test-user login for the running instance (see the project's UI-verification test credentials
  in this repo's memory/skills — do not use `.env` for this).
- [Bruno](https://www.usebruno.com/) installed, for the Request Collection scenarios.

## Scenario 1 — Interactive documentation UI (User Story 1)

```bash
docker compose up -d   # or: nx serve backend & nx serve frontend
```

1. Open `http://localhost:4200/swagger` in a browser.
2. Confirm every module (`auth`, `holdings`, `accounts`, `invitations`, `signups`, `profile`,
   `account-overview`, `turnstile`, `health`) appears as a tag group with its routes.
3. Without logging in, expand a protected route (e.g. a `holdings` route) and "Try it out" →
   confirm the response is `401` with the same structured error body the real API returns, and
   that the UI's auth indicator makes clear a session is required.
4. In another tab, log into the app normally at `http://localhost:4200`.
5. Back in `/swagger` (same browser), retry the same protected route's "Try it out" → confirm it
   now succeeds and returns real data for the logged-in user.
6. Confirm at least one admin-only route returns the same `403`-style authorization error when
   tried from a non-admin session, matching the real API (Edge Cases in spec.md).

**Expected outcome**: matches spec.md Acceptance Scenarios 1–3 for User Story 1 and SC-002 (find +
successfully execute an endpoint in under 2 minutes without reading source).

## Scenario 2 — Exported specification + Bruno collection (User Story 2)

```bash
curl -s http://localhost:4200/api/openapi.yml -o /tmp/vaultfolio-openapi.yml
```

1. Import `/tmp/vaultfolio-openapi.yml` into a third-party API client (or re-import into Bruno
   itself via "Import Collection → OpenAPI") and confirm it produces one request definition per
   endpoint with correct method/path/parameters, with zero manual corrections (SC-003).
2. Open `api/bruno/` in Bruno directly (not the freshly-imported copy) and select the `local`
   environment.
3. Run `auth/Login.bru` with the test-user credentials → confirm Bruno's cookie jar captures the
   session cookie.
4. Run a representative request from each of an unauthenticated, an authenticated, and an
   admin-only folder → confirm each returns the same result the interactive UI/browser would.

**Expected outcome**: matches spec.md Acceptance Scenarios 1–3 for User Story 2 and SC-003.

## Scenario 3 — Docker/Portainer reachability (FR-006)

```bash
docker compose -f docker-compose.portainer.yml config   # sanity-check the compose file parses
# then deploy it (or a local stand-in) and repeat Scenario 1 step 1-2 against that host's origin
```

Confirm `/swagger` and `/api/openapi.yml` are reachable at the deployed host's origin exactly as in
local Compose, with no separate nginx/proxy change needed beyond what's committed in
`docker/frontend.nginx.conf`.

## Scenario 4 — Drift detection (User Story 3 / FR-010, FR-011)

```bash
nx run backend:openapi          # regenerates api/openapi.yml
git diff --exit-code api/openapi.yml   # should be empty on a clean tree
```

1. Temporarily add an undocumented field to any DTO's decorated class without regenerating →
   `nx run backend:openapi:check` (or the equivalent CI step) must fail.
2. Revert the temporary change; re-run the check → passes.
3. Confirm a Speckit feature spec/plan that adds an API endpoint produces a `tasks.md` entry
   explicitly calling out updating `@Api...` decorators and regenerating `api/openapi.yml` (per the
   `/speckit-tasks`/`/speckit-analyze` updates this feature ships).

**Expected outcome**: matches spec.md Acceptance Scenarios 1–2 for User Story 3 and SC-004/SC-005.
