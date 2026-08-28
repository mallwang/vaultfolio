# Quickstart: Tech Stack & Tooling Setup

Validation guide for this feature. Follows spec.md's User Story 1 (P1)
acceptance scenarios. See [contracts/health-api.md](./contracts/health-api.md)
for the exact response shape and [data-model.md](./data-model.md) for the
`example_value` table used in the persistence check.

## Prerequisites

- Docker + Docker Compose (or equivalent OCI-compatible container runtime)
  installed and running.
- No local Node.js, PostgreSQL, or other tooling installation required —
  everything runs inside containers per the constitution's Technology &
  Architecture Constraints.

## 1. Bring up the full stack (User Story 1, Scenario 1)

```bash
docker compose up --build
```

**Expected**: `backend`, `frontend`, and `postgres` containers all report
healthy/running. The frontend is reachable at `http://localhost:4200` (or
whatever port `docker-compose.yml` maps) and renders the health-status page.

## 2. Verify the backend health check (User Story 1, Scenario 2)

```bash
curl -s http://localhost:3000/health | jq .
```

**Expected**: HTTP 200 with a body matching the `200 OK` shape in
[contracts/health-api.md](./contracts/health-api.md) — `"status": "ok"`,
`"database": "connected"`.

## 3. Verify database persistence across restarts (User Story 1, Scenario 3)

```bash
# Insert a row via the backend's example endpoint or a direct psql insert
docker compose exec postgres psql -U vaultfolio -d vaultfolio \
  -c "INSERT INTO example_value (id, amount) VALUES (gen_random_uuid(), '12.34567890');"

# Restart only the database container
docker compose restart postgres

# Confirm the row is still present
docker compose exec postgres psql -U vaultfolio -d vaultfolio \
  -c "SELECT amount FROM example_value;"
```

**Expected**: The previously inserted row (`amount = 12.34567890`) is still
present after the restart, and `amount`'s type is `numeric`
(`\d example_value` in `psql` confirms — never `double precision`).

## 4. Run each project's tests in isolation (User Story 3)

```bash
# Backend only — no frontend, no running containers required
npx nx test backend

# Frontend only — no backend required (uses HttpClientTestingModule)
npx nx test frontend

# Domain library only — proves Principle I isolation
npx nx test domain-example
```

**Expected**: All three test runs pass independently. The `domain-example`
suite specifically asserts an exact decimal equality (e.g.,
`Decimal("0.1").plus("0.2").equals(Decimal("0.3"))`), demonstrating FR-008.

## 5. Generate a new library (User Story 2)

```bash
npx nx g @nx/js:library some-new-domain-lib --directory=libs/domain/some-new-domain-lib
npx nx test some-new-domain-lib
```

**Expected**: The new library scaffolds with its own test setup and its
tests run and pass without starting `apps/backend` or `apps/frontend`.

## 6. Confirm project-boundary enforcement

```bash
# From apps/frontend, attempting to import backend source directly should
# fail Nx's dependency-constraint lint rule:
npx nx lint frontend
```

**Expected**: If `apps/frontend` contains an import from `apps/backend` (add
one temporarily to verify), `nx lint frontend` reports a boundary violation.
Remove the temporary import afterward — this step is a one-time verification,
not a permanent test fixture.

## Success criteria mapping

| Quickstart step | spec.md criterion |
|---|---|
| 1 | SC-001 (stack runs in one command) |
| 2 | FR-002, User Story 1 Scenario 2 |
| 3 | SC-003 (no data loss on DB-only restart) |
| 4 | SC-002 (100% of tests pass in isolation), FR-006 |
| 5 | SC-004 (new library added in a single session) |
| 6 | FR-001 (enforced project boundaries) |
