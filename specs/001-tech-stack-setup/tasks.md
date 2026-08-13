---

description: "Task list template for feature implementation"
---

# Tasks: Tech Stack & Tooling Setup

**Input**: Design documents from `/specs/001-tech-stack-setup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/health-api.md, quickstart.md

**Tests**: Included — the constitution's Principle III (Test-First, NON-NEGOTIABLE) and Principle
IV (Integration Testing) apply to this scaffold: the health-check round trip and the exact-decimal
placeholder both require tests written before implementation.

**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3); Setup, Foundational,
  and Polish tasks carry no story label
- Paths are relative to the repository root

## Path Conventions

Nx monorepo per plan.md: `apps/backend/` (NestJS), `apps/frontend/` (Angular),
`libs/domain/example/`, `libs/api-contract/`, `libs/market-data/` (reserved/empty),
`docker-compose.yml`, `docker/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Nx workspace itself, before any app/lib code exists.

- [X] T001 Initialize the Nx integrated monorepo workspace at the repository root (`npx create-nx-workspace@latest vaultfolio --preset=apps --pm=npm` equivalent, run in place so `nx.json`, `package.json`, `tsconfig.base.json`, and `apps/`/`libs/` directories are created at repo root) — do not overwrite the existing `README.md`/`.gitignore`
- [X] T002 [P] Add `@nx/nest` and `@nx/angular` plugins to the workspace (`npx nx add @nx/nest`, `npx nx add @nx/angular`) so the NestJS/Angular generators used in later tasks are available
- [X] T003 [P] Configure root-level ESLint + Prettier per Nx defaults (`.eslintrc.json`, `.prettierrc`) so `npx nx lint <project>` and `npx nx format:check` work for every generated project
- [X] T004 [P] Extend root `.gitignore` with Nx/Node/Angular/NestJS build artifacts (`node_modules/`, `dist/`, `.nx/cache/`, `.angular/`) alongside the existing entries

**Checkpoint**: `npx nx --version` and `npx nx graph` run successfully; workspace is ready for app/lib generation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core project structure, contracts, and orchestration scaffolding that every user
story depends on. No user-story-specific behavior (health logic, domain math, isolation tests) is
implemented yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Generate the NestJS application shell via `npx nx g @nx/nest:app apps/backend` (creates `apps/backend/src/app.module.ts`, `apps/backend/src/main.ts`)
- [X] T006 Generate the Angular application shell via `npx nx g @nx/angular:app apps/frontend` (creates `apps/frontend/src/app/`, `apps/frontend/src/main.ts`)
- [X] T007 [P] Generate the shared contract library via `npx nx g @nx/js:library api-contract --directory=libs/api-contract --bundler=none --unitTestRunner=jest`
- [X] T008 [P] Generate the reserved, empty market-data library via `npx nx g @nx/js:library market-data --directory=libs/market-data --bundler=none --unitTestRunner=jest` and leave only a `README.md` noting `TODO(MARKET_DATA_PROVIDER)` — no implementation, per spec.md Assumptions
- [X] T009 [P] Define the `HealthStatus` shared type in `libs/api-contract/src/lib/health.ts` (fields: `status: "ok" | "degraded"`, `database: "connected" | "unreachable"`, `timestamp: string`) per data-model.md and contracts/health-api.md, exported from `libs/api-contract/src/index.ts`
- [X] T010 Configure Nx project-boundary tags in each project's `project.json`/`tags` (e.g., `scope:backend` on `apps/backend`, `scope:frontend` on `apps/frontend`, `scope:shared` on `libs/api-contract`, `scope:domain` on `libs/domain/*`) and add `@nx/enforce-module-boundaries` depConstraints to root `.eslintrc.json` so `apps/frontend` may depend on `scope:shared` but never on `scope:backend` (FR-001, Principle II)
- [X] T011 [P] Configure NestJS structured (JSON) logging in `apps/backend/src/main.ts` (e.g., `nestjs-pino` or a small custom `LoggerService`) so startup and request events log as JSON from the first boot (FR-010, Principle V)
- [X] T012 [P] Create `docker/backend.Dockerfile` (multi-stage Node LTS build running `apps/backend`) and `docker/frontend.Dockerfile` (multi-stage Node LTS build + static serve of the Angular build output)
- [X] T013 Create root `docker-compose.yml` defining `postgres` (image `postgres:16`, named volume for data persistence, env vars for db/user/password), `backend` (built from `docker/backend.Dockerfile`, depends_on `postgres`), and `frontend` (built from `docker/frontend.Dockerfile`, depends_on `backend`) services, exposing frontend on `4200` and backend on `3000` (FR-004, FR-005, research.md)

**Checkpoint**: Foundation ready — `npx nx build backend`, `npx nx build frontend`, and
`docker compose config` all succeed; user story implementation can now begin.

---

## Phase 3: User Story 1 - Run the full stack locally with one command (Priority: P1) 🎯 MVP

**Goal**: A developer runs `docker compose up` and gets a reachable frontend, a backend health
endpoint that confirms DB connectivity, and a database whose data survives a DB-only restart.

**Independent Test**: Clone the repo, run the single orchestration command, confirm the frontend
loads, `GET /health` returns 200 with `"status": "ok"`, and data inserted into `example_value`
survives `docker compose restart postgres` (spec.md User Story 1 Acceptance Scenarios 1–3).

### Tests for User Story 1 ⚠️

- [X] T014 [P] [US1] Write the backend integration test in `apps/backend/src/tests/health.e2e-spec.ts` using NestJS `Test` + `supertest` against a real running app instance, asserting `GET /health` returns HTTP 200 with body `{ status: "ok", database: "connected", timestamp: <ISO string> }` when the DB is reachable, and HTTP 503 with `{ status: "degraded", database: "unreachable", ... }` when it is not (contracts/health-api.md) — MUST fail before T017 is implemented
- [X] T015 [P] [US1] Write the frontend component test in `apps/frontend/src/app/health-status/health-status.component.spec.ts` using `HttpClientTestingModule` to mock the `/health` response and assert the component renders the returned `status`/`database` values — MUST fail before T019 is implemented

### Implementation for User Story 1

- [X] T016 [US1] Add a TypeORM (or NestJS-supported PostgreSQL client) connection module in `apps/backend/src/app.module.ts` configured from environment variables matching `docker-compose.yml`'s `postgres` service, plus a migration/init script creating the `example_value` table (`id UUID PRIMARY KEY`, `amount NUMERIC(20,8) NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`) per data-model.md Persistence section
- [X] T017 [US1] Implement `HealthModule` (`apps/backend/src/health/health.controller.ts`, `apps/backend/src/health/health.service.ts`) exposing `GET /health`: the service pings the database (per T016's connection) and returns the shared `HealthStatus` shape from `libs/api-contract`, HTTP 200 when connected / 503 when not, satisfying T014
- [X] T018 [US1] Register `HealthModule` in `apps/backend/src/app.module.ts` and confirm structured (JSON) logs are emitted for the health check request (using T011's logger)
- [X] T019 [US1] Implement the `HealthStatusComponent` in `apps/frontend/src/app/health-status/health-status.component.ts` that calls `GET /health` (via Angular `HttpClient`, typed with `HealthStatus` from `libs/api-contract`) and renders `status`/`database`, satisfying T015; wire it as the app's root-rendered page in `apps/frontend/src/app/app.component.html`
- [X] T020 [US1] Add a Docker Compose healthcheck to the `backend` service in `docker-compose.yml` pointing at `GET /health`, and a `depends_on: condition: service_healthy` from `frontend` to `backend`
- [X] T021 [US1] Run `npx nx test backend`, `npx nx test frontend`, and `docker compose up --build` locally to confirm T014/T015 now pass and quickstart.md steps 1–3 succeed (frontend reachable, health check green, `example_value` row survives `docker compose restart postgres`) — verified end-to-end: `nx test backend`/`frontend` green; `docker compose up --build` brought up all three containers healthy; `GET /health` returned 200 `{"status":"ok","database":"connected",...}`; frontend served 200 at `:4200`; a row inserted into `example_value` survived `docker compose restart postgres` (required regenerating `package-lock.json` and bumping the Dockerfiles' base image to `node:24-slim` to match the npm version that produced the lockfile — `node:22-slim`'s bundled npm rejected the lockfile via `npm ci`)

**Checkpoint**: User Story 1 is fully functional and independently testable — the full stack runs
end-to-end via one command (SC-001), and database data survives a DB-only restart (SC-003).

---

## Phase 4: User Story 2 - Add a new domain library independent of the API/UI (Priority: P2)

**Goal**: A developer can generate a new standalone library, add a function + test, and run those
tests without starting the backend or frontend — proven first by the scaffold's own
`libs/domain/example` library.

**Independent Test**: Run `npx nx test domain-example` in isolation (no backend/frontend running)
and confirm it passes; generate a second throwaway library and confirm its tests also run in
isolation (spec.md User Story 2 Acceptance Scenario 1).

### Tests for User Story 2 ⚠️

- [X] T022 [US2] Write the exact-decimal unit test in `libs/domain/example/src/lib/example-decimal-value.spec.ts` asserting `Decimal("0.1").plus("0.2").equals(Decimal("0.3"))` and that construction from a float literal (e.g., `new ExampleDecimalValue(0.1)`) is rejected/not permitted by the type signature (FR-008, data-model.md ExampleDecimalValue) — MUST fail before T024 is implemented

### Implementation for User Story 2

- [X] T023 [US2] Generate `libs/domain/example` via `npx nx g @nx/js:library example --directory=libs/domain/example --bundler=none --unitTestRunner=jest`, tagged `scope:domain` (per T010)
- [X] T024 [US2] Implement `ExampleDecimalValue` in `libs/domain/example/src/lib/example-decimal-value.ts` using an exact-decimal library (e.g., `decimal.js`), constructible only from a decimal-string input (never a native float literal), satisfying T022
- [X] T025 [US2] Verify the project-boundary lint rule from T010 rejects a direct `apps/frontend` → `apps/backend` import: temporarily add such an import, run `npx nx lint frontend` and confirm it fails, then remove the temporary import (spec.md User Story 2 Acceptance Scenario 2, quickstart.md step 6)
- [X] T026 [US2] Run `npx nx test domain-example` standalone (no other project running) to confirm T022 passes, satisfying SC-004

**Checkpoint**: User Stories 1 AND 2 both work independently — a new domain library builds and
tests in isolation, and boundary enforcement is proven.

---

## Phase 5: User Story 3 - Confirm the backend and frontend are independently runnable and testable (Priority: P3)

**Goal**: The backend's test suite passes with no frontend or browser present, and the frontend's
test suite passes with no live backend present — validating Principle II's decoupling structurally.

**Independent Test**: Run `npx nx test backend` with no frontend project running and no browser
present; separately run `npx nx test frontend` with no backend server running; confirm both suites
pass in isolation (spec.md User Story 3 Acceptance Scenarios 1–2).

### Implementation for User Story 3

- [X] T027 [US3] Confirm `apps/backend`'s Jest/e2e configuration (`apps/backend/jest.config.ts`, `apps/backend/src/tests/`) boots the NestJS app in-process for T014's `supertest` calls, requiring no separately running frontend process or browser
- [X] T028 [US3] Confirm `apps/frontend`'s Jest/Karma configuration for `health-status.component.spec.ts` (T015) relies solely on `HttpClientTestingModule`'s mocked responses, requiring no live backend server or network call
- [X] T029 [US3] Add root `package.json` npm scripts `test:backend`, `test:frontend`, `test:domain-example` wrapping the respective `nx test` targets, so each tier's isolation is a documented, one-command operation (supports FR-011, FR-006)
- [X] T030 [US3] Run `npx nx test backend` and `npx nx test frontend` back-to-back with the other tier's dev server stopped, confirming both pass independently (SC-002)

**Checkpoint**: All three user stories are independently functional — SC-002 (100% of tests pass
per-project in isolation) is confirmed for backend, frontend, and the domain library.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation spanning all user stories.

- [X] T031 [P] Update root `README.md` with: prerequisites (Docker + Compose only), the `docker compose up --build` startup command, and per-project test commands (`npx nx test backend`/`frontend`/`domain-example` or the `npm run test:*` scripts from T029) — satisfies FR-011
- [X] T032 [P] Add a brief note to `libs/market-data/README.md` (created in T008) confirming it remains an empty, reserved slot per the constitution's open `TODO(MARKET_DATA_PROVIDER)`
- [X] T033 Run the full quickstart.md validation end-to-end (steps 1–6) against a clean `docker compose up --build`, confirming SC-001 through SC-004 all hold — all six steps verified: full stack up via one command with all containers healthy (SC-001), `GET /health` 200 `ok`/`connected`, `example_value` row (`amount = 12.34567890`, column type `numeric(20,8)`) survived a `postgres`-only restart (SC-003), `nx test backend`/`frontend`/`domain-example` all pass in isolation (SC-002), a new library was generated and tested standalone (SC-004), and `nx lint frontend` rejected a temporary direct `apps/backend` import (FR-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion; no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational completion; T025's boundary check is easier
  to demonstrate once US1's `apps/frontend`/`apps/backend` code exists, but the story is otherwise
  independent
- **User Story 3 (Phase 5)**: Depends on Foundational completion; exercises the test suites T014
  and T015 already wrote as part of US1, so is easiest to complete after Phase 3, though it adds no
  new production code
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests (T014, T015, T022) MUST be written and confirmed to fail before their corresponding
  implementation tasks (T017/T019, T024)
- Database connection before health service; health service before health controller/module
  registration; backend health endpoint before frontend component that calls it

### Parallel Opportunities

- T002–T004 (Setup) can run in parallel
- T007, T008 (library generation) can run in parallel; T011, T012 (logging, Dockerfiles) can run
  in parallel once T005/T006 exist
- T014 and T015 (US1 tests, different projects/files) can run in parallel
- T031, T032 (Polish docs) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both US1 tests together (different projects, independent):
Task: "Write backend integration test for GET /health in apps/backend/src/tests/health.e2e-spec.ts"
Task: "Write frontend component test for HealthStatusComponent in apps/frontend/src/app/health-status/health-status.component.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md steps 1–3 against a real `docker compose up`
5. Demo the running stack

### Incremental Delivery

1. Setup + Foundational → Nx workspace, apps, contracts, Docker Compose scaffold ready
2. Add User Story 1 → full stack runs end-to-end (MVP!)
3. Add User Story 2 → new domain libraries scaffold and test in isolation
4. Add User Story 3 → backend/frontend test isolation confirmed and documented
5. Polish → README finalized, quickstart re-validated

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability; Setup/Foundational/Polish
  tasks carry no `[US*]` label (T009's `HealthStatus` type is Foundational, not US1-only, because
  it is consumed by both US1's health endpoint and US3's frontend isolation test — placed in the
  earliest-needed phase per the task-organization rule)
- Commit after each task or logical group
- Verify tests fail before implementing (T014/T015/T022)
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
