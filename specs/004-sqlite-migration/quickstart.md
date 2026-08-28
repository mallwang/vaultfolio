# Quickstart: Validating the SQLite Migration

Prerequisites: Docker + Docker Compose. No local PostgreSQL/SQLite installation required.

## 1. Fresh stack start (User Story 1, SC-001, SC-003)

```bash
rm -rf ./data   # simulate a fresh checkout
docker compose up --build
```

**Expect**: the stack starts with exactly two application services running (`backend`,
`frontend`) — `docker compose ps` shows no `postgres` (or any other database) service/container.

## 2. Data persists across container recreation (User Story 1, SC-002)

```bash
# with the stack up from step 1:
curl -X POST http://localhost:3000/holdings \
  -H 'Content-Type: application/json' \
  -d '{"assetType":"GOLD","management":"Home safe","weightGrams":"12.34567800"}'

docker compose down          # removes containers, NOT ./data (it's a bind mount, not a volume)
docker compose up            # recreate
curl http://localhost:3000/holdings   # the Gold holding created above is still present
```

**Expect**: the holding created before `down` is present in the `GET /holdings` response after
`up`, with `weightGrams` exactly `"12.34567800"` (no rounding drift, SC-005).

## 3. Database file is inspectable on the host (SC-006)

```bash
ls -la ./data
# expect: vaultfolio.db (and, while the stack is running, vaultfolio.db-wal / vaultfolio.db-shm)
```

**Expect**: an operator can back up all application data with a single `cp -r ./data /backup/`.

## 4. Existing automated tests pass unmodified (User Story 2, FR-010, SC-004)

```bash
npm exec nx run backend:test
npm exec nx run backend:e2e   # or whichever target runs holdings.e2e-spec.ts — confirm via `nx show project backend`
```

**Expect**: the existing health + holdings unit/e2e suites pass with no changes to their
assertions' intent (implementation details like connection setup may differ internally).

## 5. Manual exercise of every asset type (User Story 2)

Through the running frontend (<http://localhost:4200>) or `curl` against
`POST /holdings`, create, list, edit, and delete one holding of each type — ETF, Share, Gold,
Bitcoin — confirming decimal fields (quantity, purchase price, weight, current value) round-trip
exactly as entered.

## 6. ETF/Gold upsert-matching still works (User Story 2, FR-007)

Create an ETF holding, then submit another `POST /holdings` for the same `(management, isin)` pair
— **expect** the existing holding to be updated in place (same `id`), not duplicated, exactly as
before the migration.

## 7. Documentation reflects SQLite (User Story 3, SC gate)

```bash
grep -ri postgres README.md .specify/memory/constitution.md
```

**Expect**: no remaining reference presents PostgreSQL as the current/ratified database choice
(historical mentions in the constitution's Sync Impact Report changelog are fine — see
plan.md's Constitution Check).
