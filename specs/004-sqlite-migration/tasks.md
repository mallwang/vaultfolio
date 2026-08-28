---
description: 'Task list for SQLite Migration & Self-Hosted Persistence'
---

# Tasks: SQLite Migration & Self-Hosted Persistence

**Input**: Design documents from `/specs/004-sqlite-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/deployment-contract.md, quickstart.md

**Tests**: Not explicitly requested as new TDD scaffolding, but Principle III/IV (plan.md's
Constitution Check) make exact-decimal round-trip tests and the full e2e suite a **hard
obligation** for this feature — they are included below as required tasks, not optional ones.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to allow
independent implementation and verification of each.

## Path Conventions

This is an Nx monorepo. This feature touches only `apps/backend/src/database/`,
`apps/backend/src/holdings/`, `apps/backend/src/tests/`, plus repo-root `docker-compose.yml`,
`package.json`, `README.md`, and `.specify/memory/constitution.md`. No new Nx projects/libraries
(plan.md Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the new driver dependency in place and the old one removed, ahead of any code
changes.

- [x] T001 Add `better-sqlite3` and `@types/better-sqlite3` to `package.json` dependencies; remove
      `pg` and `@types/pg`; run `npm install` to update `package-lock.json` (research.md #1)
- [x] T002 [P] Verify `better-sqlite3`'s native binding builds cleanly under `docker/backend.Dockerfile`'s
      `node:24-slim` base image (rebuild the backend image locally); adjust the Dockerfile with
      any missing native-build toolchain packages (e.g. `python3`, `make`, `g++`) only if the
      build fails

**Checkpoint**: Dependencies are swapped; nothing compiles against the new driver yet — that's
Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace the persistence adapter itself (`DatabaseService`, `HoldingsRepository`) —
this is the core of the migration and every user story depends on it.

**⚠️ CRITICAL**: No user story below is independently testable until this phase is complete.

- [x] T003 In `apps/backend/src/database/database.service.ts`, replace the `pg` `Pool` with a
      `better-sqlite3` `Database` handle: read `DATABASE_PATH` (default `./data/vaultfolio.db`),
      `fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true })` before opening, then set
      `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` on the opened handle
      (research.md #6, #7)
- [x] T004 In `apps/backend/src/database/database.service.ts`, wrap directory creation + database
      open + PRAGMA setup in `try`/`catch`; on failure, `Logger.error` loudly and leave the
      service in a "not ready" state (an internal flag) so `ping()` returns `false` instead of
      throwing, without crashing the process (research.md #7, edge case, FR-008)
- [x] T005 In `apps/backend/src/database/database.service.ts`, rewrite `migrate()`'s
      `CREATE TABLE example_value` and `CREATE TABLE holdings` DDL to the SQLite column types in
      data-model.md's translation table (`TEXT PRIMARY KEY` ids, `TEXT` decimal/timestamp columns,
      `CAST(column AS REAL) > 0` CHECK constraints, `STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')`
      defaults), preserving the `holdings_fields_match_asset_type` CHECK and the
      `holdings_upsert_lookup_idx` index verbatim (data-model.md)
- [x] T006 In `apps/backend/src/database/database.service.ts`, rewrite `ping()` to run a
      synchronous `SELECT 1` against the `better-sqlite3` handle inside a `try`/`catch`, returning
      `false` (and `Logger.warn`) on any error or when the service is in the "not ready" state from
      T004
- [x] T007 In `apps/backend/src/database/database.service.ts`, rewrite the generic `query<T>()`
      method to run synchronously against `better-sqlite3` (`db.prepare(sql).all(params)` for
      `SELECT`/`RETURNING`, `.run(params)` otherwise) while keeping its existing async signature
      (`Promise<T[]>`) so callers (`HoldingsRepository`, tests) need no call-site changes; translate
      the existing `$1, $2, ...` positional placeholders used by callers into `better-sqlite3`'s
      numbered `?1, ?2, ...` form inside this method (single translation point, so
      `HoldingsRepository`'s query strings do not need per-callsite edits)
- [x] T008 In `apps/backend/src/database/database.service.ts`, implement `onModuleDestroy` to close
      the `better-sqlite3` handle (`db.close()`) instead of `pool.end()`
- [x] T009 [US-independent] In `apps/backend/src/holdings/holdings.repository.ts`, generate the row
      `id` in the application layer with `crypto.randomUUID()` and pass it as a bound parameter on
      `insert()` (add `id` to the column list and `VALUES`), since SQLite has no
      `gen_random_uuid()` column default (research.md #2)
- [x] T010 [US-independent] In `apps/backend/src/holdings/holdings.repository.ts`, replace the
      `updated_at = now()` expression in `updateById()`'s `UPDATE` statement with
      `updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')` (research.md #4)
- [x] T011 [P] Write exact-decimal round-trip unit tests (Principle III obligation, plan.md
      Constitution Check) for `quantity`, `purchase_price`, `weight_grams`, and `current_value`
      through the new `TEXT`-column storage — insert a value with 8 decimal places via
      `HoldingsRepository.insert`, read it back, and assert byte-for-byte string equality — in
      `apps/backend/src/holdings/holdings.repository.spec.ts` (new file; write these first per
      Principle III, confirm they fail against the old `pg`-based code before T003–T010 land, then
      confirm they pass after)

**Checkpoint**: `DatabaseService`/`HoldingsRepository` now run entirely on SQLite. All three user
stories can be verified from here.

---

## Phase 3: User Story 1 - Self-host the stack on a single-file database (Priority: P1) 🎯 MVP

**Goal**: `docker compose up` runs the whole stack with one file-based database and no separate
database container; data survives a stop/remove/recreate cycle via a host bind mount.

**Independent Test** (quickstart.md #1–#3): `docker compose up` on a fresh checkout, create a
holding, `docker compose down` + `docker compose up`, confirm the holding is still present, backed
by a file under `./data`.

### Implementation for User Story 1

- [x] T012 [US1] In `docker-compose.yml`, remove the `postgres` service block entirely (image,
      environment, volumes, ports, healthcheck) and the top-level `postgres-data` named volume
      (contracts/deployment-contract.md)
- [x] T013 [US1] In `docker-compose.yml`, on the `backend` service: remove `depends_on: postgres`
      and the `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_USER`/`DATABASE_PASSWORD`/`DATABASE_NAME`
      environment variables; add `DATABASE_PATH: /data/vaultfolio.db` and a bind-mount volume entry
      `./data:/data` (contracts/deployment-contract.md)
- [x] T014 [US1] Update `package.json`'s `dev` script to drop `docker compose up -d postgres` (no
      database container to pre-start); confirm `nx run-many -t serve -p backend frontend` alone is
      sufficient for local dev now that SQLite needs no separate service
- [x] T015 [P] [US1] Write a new integration test exercising the stop/remove/recreate persistence
      scenario (SC-002, quickstart.md #2, Principle IV obligation): start the Nest app against a
      `DATABASE_PATH` file in a temp directory, insert a holding, close/destroy the app module
      (simulating container teardown) while keeping the temp file, boot a fresh app instance
      against the same `DATABASE_PATH`, and assert the holding is still returned by
      `GET /holdings` — in `apps/backend/src/tests/holdings-persistence.e2e-spec.ts` (new file)
- [x] T016 [US1] Run quickstart.md steps 1–3 manually (`docker compose up --build` from a fresh
      `./data`, confirm no `postgres` service in `docker compose ps`, create a holding, `down`/`up`,
      confirm it persists, inspect `./data` for `vaultfolio.db`/`-wal`/`-shm`) and fix any issues
      found

**Checkpoint**: User Story 1 is independently functional — the stack self-hosts on a single file,
verified both by an automated test (T015) and the manual quickstart run (T016).

---

## Phase 4: User Story 2 - Existing functionality keeps working unchanged (Priority: P2)

**Goal**: Health check, and full holdings CRUD + upsert-matching for all four asset types, keep
working exactly as before against SQLite, with zero decimal-precision drift.

**Independent Test** (quickstart.md #4–#6): run the existing backend unit/e2e suites against the
new database; manually exercise create/list/edit/delete for ETF/Share/Gold/Bitcoin.

### Implementation for User Story 2

- [x] T017 [US2] In `apps/backend/src/tests/holdings.e2e-spec.ts`, point `DATABASE_PATH` at a
      per-test-run temp file (created under the OS temp dir in `beforeAll`, removed in `afterAll`)
      instead of relying on the shared dev Postgres connection, per research.md #8; keep every
      existing assertion's intent unchanged (FR-010)
- [x] T018 [US2] In `apps/backend/src/tests/health.e2e-spec.ts`, verify the existing
      `DatabaseService` mocking (`overrideProvider(DatabaseService).useValue(...)`) still exercises
      `HealthService.check()` correctly against the new `ping()` signature/behavior from T006; fix
      any type/behavior drift
- [x] T019 [US2] Run `npm exec nx run backend:test` and `npm exec nx run backend:e2e` (or the
      project's actual e2e target per `nx show project backend`); fix any failures until all
      existing health + holdings unit/e2e suites pass unmodified in intent (FR-010, SC-004,
      quickstart.md #4)
- [x] T020 [P] [US2] Manually exercise quickstart.md #5 through the running app or `curl`: create,
      list, edit, and delete one holding of each type (ETF, Share, Gold, Bitcoin), confirming every
      decimal field (quantity, purchase price, weight, current value) round-trips exactly as
      entered (FR-005, SC-005)
- [x] T021 [US2] Manually exercise quickstart.md #6: create an ETF holding, submit a second
      `POST /holdings` for the same `(management, isin)` pair, and confirm the existing row is
      updated in place (same `id`), not duplicated (FR-007)

**Checkpoint**: User Stories 1 AND 2 both work independently — the app functions identically to
before the migration, now backed by SQLite.

---

## Phase 5: User Story 3 - Project documentation reflects the new database choice (Priority: P3)

**Goal**: The constitution and README document SQLite (not PostgreSQL) as the ratified database
choice, via the standard governance process.

**Independent Test** (quickstart.md #7): read the constitution and README after the change; no
remaining reference presents PostgreSQL as the current/ratified choice.

### Implementation for User Story 3

- [x] T022 [US3] Run the project's `/speckit-constitution` governance process to amend
      `.specify/memory/constitution.md`: replace the "database MUST run as its own
      container/service, not embedded in the backend process" bullet and the "Database: PostgreSQL"
      Stack Decision line with SQLite-as-embedded-file-based-bind-mounted-database language, and
      record the change in the constitution's amendment/Sync Impact Report history (FR-011,
      plan.md's "Known, intentional gate violation" section)
- [x] T023 [US3] Update `README.md`'s tech stack and running-locally/deployment sections to
      describe SQLite (not PostgreSQL) as the database, the `docker-compose` stack with no separate
      database container, and the `./data` directory as where persisted data lives (FR-011,
      SC-006)
- [x] T024 [US3] Run quickstart.md #7 (`grep -ri postgres README.md .specify/memory/constitution.md`)
      and confirm no remaining reference presents PostgreSQL as the current/ratified choice (historical
      Sync Impact Report changelog mentions are acceptable)

**Checkpoint**: All three user stories are independently functional; documentation matches the
shipped database choice.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup once all user stories are verified.

- [x] T025 [P] Remove any now-unused `pg`-specific types/imports left behind in
      `apps/backend/src/database/database.service.ts` or `apps/backend/src/holdings/holdings.repository.ts`
      (e.g. stray `import { Pool } from 'pg'`)
- [x] T026 [P] Update any developer-facing setup docs/comments referencing Postgres env vars
      (`DATABASE_HOST`/`PORT`/`USER`/`PASSWORD`/`NAME`) outside of `README.md` (already covered by
      T023) to instead reference `DATABASE_PATH`
- [x] T027 Add `./data/` (and `*.db`, `*.db-wal`, `*.db-shm`) to `.gitignore` so a developer's local
      SQLite file is never accidentally committed
- [x] T028 Run the full quickstart.md validation end-to-end (all 7 steps in order) as a final gate
      before calling this feature complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001's dependency swap) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion; independent of User Story 1 but
  naturally verified after it since both exercise the same `DatabaseService`
- **User Story 3 (Phase 5)**: Depends on Foundational completion only (pure documentation); has no
  code dependency on User Story 1 or 2, so it can run in parallel with either
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — no dependency on US1/US3 (though
  in practice it re-runs the same test suites US1's manual quickstart also touches)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — no dependency on US1/US2, purely
  documentation

### Within Each Phase

- Phase 2: T003 → T004 → T005 → T006/T007/T008 (all touch `database.service.ts` sequentially, same
  file) → T009/T010 (repository changes, can follow once `DatabaseService` compiles) → T011 (tests,
  written first per Principle III, then confirmed passing after T003–T010)
- Phase 3: T012 → T013 (same file, sequential) → T014 → T015 [P] → T016 (manual validation last)
- Phase 4: T017 and T018 [P] (different files) → T019 (run suites) → T020 [P] and T021 (manual)
- Phase 5: T022 → T023 → T024 (verification last)

### Parallel Opportunities

- T001 and T002 can be sequenced tightly but T002 only needs T001's `package.json` change
- T009 and T010 (both in `holdings.repository.ts`) touch the same file — not truly parallel despite
  both being small; treat as sequential within Phase 2
- T015 (new persistence e2e test) is parallelizable with T014 (package.json dev script) — different
  files
- T017 and T018 (different test files) are parallelizable
- T020 (manual exercise) is parallelizable with T019 once T017/T018 land, since it doesn't touch
  code
- User Story 3 (Phase 5, T022–T024) can run fully in parallel with Phases 3–4 by a second
  contributor, since it has no file overlap with the backend/docker-compose changes

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T009 and T010 are both in holdings.repository.ts — do NOT run in parallel.
# Instead, once T003–T008 (database.service.ts) are done:
Task: "Generate app-layer UUID on insert in apps/backend/src/holdings/holdings.repository.ts"
# then
Task: "Replace now() with STRFTIME(...) in the UPDATE statement in the same file"
```

## Parallel Example: User Stories 1 & 3

```bash
# Once Phase 2 (Foundational) is complete, these can run concurrently on different files:
Task: "US1 — remove postgres service and add ./data bind mount in docker-compose.yml"
Task: "US3 — amend .specify/memory/constitution.md via /speckit-constitution"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (swap dependency)
2. Complete Phase 2: Foundational (CRITICAL — the actual SQLite persistence-adapter rewrite)
3. Complete Phase 3: User Story 1 (docker-compose shape, persistence-survives-recreate test)
4. **STOP and VALIDATE**: run quickstart.md #1–#3 — `docker compose up`, create data, recreate
   containers, confirm data survives, confirm no `postgres` service
5. This alone delivers the entire point of the migration (self-hosting on one file, per spec.md's
   Why-this-priority for US1)

### Incremental Delivery

1. Setup + Foundational → SQLite persistence adapter works, nothing user-visible changed yet
2. Add User Story 1 → self-hosting works (MVP!) → validate via quickstart.md #1–#3
3. Add User Story 2 → confirm zero behavior regression, exact-decimal guarantee holds → validate
   via quickstart.md #4–#6
4. Add User Story 3 → documentation catches up → validate via quickstart.md #7
5. Polish (Phase 6) → final cleanup and full quickstart re-run as the completion gate

### Constitution Gate Reminder

Per plan.md's "Known, intentional gate violation" section, **T022 (the constitution amendment) is
a gate for calling this feature complete** (spec.md Acceptance Scenario 3.1) even though it doesn't
block Phase 0/1 design or Phases 1–4's implementation work — do not skip it as "just docs."
