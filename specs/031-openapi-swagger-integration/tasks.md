---
description: 'Task list template for feature implementation'
---

# Tasks: OpenAPI/Swagger API Documentation

**Input**: Design documents from `/specs/031-openapi-swagger-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/documentation-endpoints.md, quickstart.md

**Tests**: The feature spec/plan calls out a small unit/integration test (route-completeness) and a
script-level drift check as first-class deliverables (plan.md "Testing", research.md #6), so test
tasks ARE included below, scoped to exactly what plan.md asks for — not a general TDD sweep.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P2) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to the repo root; this is an Nx monorepo using `npm`/`npx nx` (not `pnpm`)

## Path Conventions

- `apps/backend/src/openapi/` — new doc-generation + Swagger wiring (this feature)
- `apps/backend/src/<module>/` — existing controllers, decorated in place
- `apps/backend/scripts/generate-openapi.ts` — new generation/drift-check script
- `api/openapi.yml`, `api/bruno/` — new top-level, non-Nx-project artifacts
- `docker/frontend.nginx.conf` — modified reverse-proxy config
- `.claude/skills/speckit-tasks/`, `.claude/skills/speckit-analyze/` — modified Speckit skill instructions (US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and scaffold the new `openapi` module before any wiring happens

- [x] T001 Add `@nestjs/swagger` and `js-yaml` (plus `@types/js-yaml` as a dev dependency) to
      `apps/backend/package.json` `dependencies`/`devDependencies` and run `npm install` at the
      workspace root (per [vaultfolio-uses-npm] memory — declare in the app's own package.json too)
- [x] T002 [P] Create the `apps/backend/src/openapi/` folder with an empty `dto/` subfolder and a
      barrel `apps/backend/src/openapi/dto/index.ts`
- [x] T003 [P] Enable the `@nestjs/swagger` CLI plugin in `apps/backend`'s Nest/webpack build config
      (research.md #1's supplementary code-gen aid) so primitive `@ApiProperty` boilerplate is
      inferred automatically for the decorated DTO classes added in Phase 3

**Checkpoint**: Dependencies installed, `openapi/` folder exists — ready for foundational wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared document-building pipeline every user story's surface (UI, export route,
generation script) reads from. No user story can be verified until this exists.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `apps/backend/src/openapi/openapi.setup.ts` exporting a `setupOpenApi(app)`
      function that builds a `DocumentBuilder` (title "Vaultfolio API", version read from
      `apps/backend/package.json`, description) with `.addCookieAuth('vaultfolio_session')`
      (research.md #2), calls `SwaggerModule.createDocument(app, config)`, and calls
      `SwaggerModule.setup('swagger', app, document)`
- [x] T005 Call `setupOpenApi(app)` from `apps/backend/src/main.ts` during bootstrap, before
      `app.listen(port)`
- [x] T006 [P] Create `apps/backend/src/openapi/openapi.controller.ts`: a `@Public()`
      `GET /openapi.yml` route that reuses the same `OpenAPIObject` built in T004 (export it from
      `openapi.setup.ts` or rebuild via the same config) and serializes it to YAML via `js-yaml`
      with `Content-Type: text/yaml`, per contracts/documentation-endpoints.md; register its module
      in `apps/backend/src/app/app.module.ts`
- [x] T007 [P] Add a `location /swagger` reverse-proxy block to `docker/frontend.nginx.conf`,
      alongside the existing `location /api/`, forwarding `/swagger` and its supporting asset/JSON
      paths (`/swagger-json`, `/swagger-yaml`, `/swagger/*`) to `http://backend:3000/` unstripped
      (research.md #2) — confirm this proxies `/openapi.yml` too so it is reachable at
      `/api/openapi.yml` through the pre-existing `location /api/` rule (research.md #3)

**Checkpoint**: `/swagger` and `/api/openapi.yml` are both reachable and show an (initially mostly
undecorated) API surface — user story implementation can now begin

---

## Phase 3: User Story 1 - Browse and try out the API from a live, always-current reference (Priority: P1) 🎯 MVP

**Goal**: Every existing REST endpoint is documented with full schema/auth detail and can be tried
out from `/swagger` using the developer's real session cookie.

**Independent Test**: Start the backend, open `/swagger`, confirm every endpoint is listed with its
schema; try a protected endpoint unauthenticated (expect a clear 401 prompt), then authenticated
(expect the real response) — per quickstart.md Scenario 1.

### Tests for User Story 1

- [x] T008 [P] [US1] Integration test in
      `apps/backend/src/openapi/openapi-completeness.e2e-spec.ts` asserting the generated
      `OpenAPIObject`'s `paths` contains every route NestJS actually registers (data-model.md's
      validation rule) and that every non-`@Public()` route's operation carries the
      `vaultfolio_session` cookie security requirement

### Implementation for User Story 1

- [x] T009 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/auth.ts` shapes in
      `apps/backend/src/openapi/dto/auth.ts` (`@ApiProperty`/`@ApiPropertyOptional`, `enum`/
      `example` where useful)
- [x] T010 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/accounts.ts` shapes
      in `apps/backend/src/openapi/dto/accounts.ts`
- [x] T011 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/holdings.ts` shapes
      in `apps/backend/src/openapi/dto/holdings.ts`
- [x] T012 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/invitations.ts`
      shapes in `apps/backend/src/openapi/dto/invitations.ts`
- [x] T013 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/signups.ts` shapes
      in `apps/backend/src/openapi/dto/signups.ts`
- [x] T014 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/profile.ts` shapes
      in `apps/backend/src/openapi/dto/profile.ts`
- [x] T015 [P] [US1] Create decorated DTO classes for `libs/api-contract/src/lib/account-overview.ts`
      shapes in `apps/backend/src/openapi/dto/account-overview.ts`
- [x] T016 [P] [US1] Create a decorated `ErrorResponseDto` mirroring
      `libs/api-contract/src/lib/error-response.ts` in `apps/backend/src/openapi/dto/error-response.ts`,
      used as the `@ApiResponse({ type: ErrorResponseDto })` for every documented error status
- [x] T017 [US1] Add `@ApiTags('auth')`, `@ApiOperation`, `@ApiResponse` (success + error, incl.
      `ErrorResponseDto`), `@ApiCookieAuth()` on protected routes, and typed
      `@Body()`/return annotations using the T009 DTOs in
      `apps/backend/src/auth/auth.controller.ts`
- [x] T018 [US1] Add the same annotation set (using T010 DTOs) to
      `apps/backend/src/accounts/accounts.controller.ts`
- [x] T019 [US1] Add the same annotation set (using T011 DTOs) to
      `apps/backend/src/holdings/holdings.controller.ts`
- [x] T020 [US1] Add the same annotation set (using T012 DTOs) to
      `apps/backend/src/invitations/invitations.controller.ts`
- [x] T021 [US1] Add the same annotation set (using T013 DTOs), including `@ApiOperation` notes on
      the `TurnstileGuard`-protected routes describing the required Turnstile token, to
      `apps/backend/src/signups/signups.controller.ts`
- [x] T022 [US1] Add the same annotation set (using T014 DTOs) to
      `apps/backend/src/profile/profile.controller.ts`
- [x] T023 [US1] Add the same annotation set (using T015 DTOs) to
      `apps/backend/src/account-overview/account-overview.controller.ts`
- [x] T024 [US1] Add `@ApiTags('health')`/`@ApiOperation`/`@ApiResponse` to
      `apps/backend/src/health/health.controller.ts` (public route, no auth decorator needed)
- [x] T025 [US1] Verify every controller's role-gated route (`@Roles(...)`) carries an
      `@ApiForbiddenResponse({ type: ErrorResponseDto })` describing the same 403 shape the real
      `RolesGuard` returns, across all controllers touched in T017–T024
- [x] T026 [US1] Run `npx nx test backend` and confirm the T008 completeness test passes now that
      every controller is decorated

**Checkpoint**: User Story 1 is fully functional — `/swagger` lists every endpoint with complete
schemas and "try it out" works with the real session cookie, independently of US2/US3

---

## Phase 4: User Story 2 - Exercise the API outside the browser via a portable spec and ready-made collection (Priority: P2)

**Goal**: A standards-compliant `api/openapi.yml` importable into a third-party client, plus a
checked-in Bruno collection that authenticates via the same session mechanism.

**Independent Test**: Download `api/openapi.yml`, import into an API client with zero corrections;
separately open `api/bruno/` in Bruno, log in via its `Login` request, and successfully call one
unauthenticated, one authenticated, and one admin-only endpoint — per quickstart.md Scenario 2.

### Implementation for User Story 2

- [x] T027 [US2] Create `apps/backend/scripts/generate-openapi.ts`: builds the Nest application
      context (as the existing e2e specs under `apps/backend/src/tests/` do), calls the same
      `setupOpenApi`-produced `OpenAPIObject` from T004/T006, serializes it via `js-yaml`, and
      writes `api/openapi.yml`
- [x] T028 [US2] Add an `openapi` target (running T027's script) to `apps/backend/package.json`'s
      `nx.targets`, invocable as `npx nx run backend:openapi`
- [x] T029 [US2] Run `npx nx run backend:openapi` to generate the first committed
      `api/openapi.yml` from the now-fully-decorated controllers (Phase 3)
- [x] T030 [P] [US2] Create `api/bruno/bruno.json` and `api/bruno/environments/local.bru` with
      `baseUrl = http://localhost:4200/api` (data-model.md's Request Collection layout)
- [x] T031 [P] [US2] Create `api/bruno/auth/Login.bru` (and any other representative `auth/`
      requests) posting to the real login endpoint so Bruno's cookie jar captures
      `vaultfolio_session`
- [x] T032 [P] [US2] Create representative `.bru` requests under `api/bruno/holdings/`,
      `api/bruno/accounts/` (one of which must be admin-only, per SC-003) mirroring the endpoints
      decorated in T018–T019
- [x] T033 [P] [US2] Create representative `.bru` requests under `api/bruno/invitations/`,
      `api/bruno/signups/`, `api/bruno/profile/`, `api/bruno/account-overview/`, `api/bruno/health/`
      (at least one unauthenticated request, per SC-003)
- [x] T034 [US2] Manually validate every `.bru` request's method + URL against `api/openapi.yml`
      (data-model.md's Request Collection validation rule — not machine-enforced)

**Checkpoint**: User Stories 1 AND 2 both work independently — the exported spec and Bruno
collection are usable without the browser UI

---

## Phase 5: User Story 3 - Documentation stays accurate as the product evolves (Priority: P2)

**Goal**: The drift check fails a build when `api/openapi.yml` is stale, and the Speckit
plan/tasks/analyze workflow forces API-affecting features to update it.

**Independent Test**: Add an undocumented DTO field, confirm `backend:openapi:check` fails; revert
and confirm it passes. Run `/speckit-tasks` for a feature that changes an API endpoint and confirm
it emits a documentation-update task; confirm `/speckit-analyze` flags a feature as inconsistent if
that task was skipped while the API changed — per quickstart.md Scenario 4.

### Implementation for User Story 3

- [x] T035 [US3] Add a `check` mode to `apps/backend/scripts/generate-openapi.ts` (or a sibling
      `apps/backend/scripts/check-openapi-drift.ts`) that generates to a temp path and diffs it
      against the committed `api/openapi.yml`, exiting non-zero on any difference
- [x] T036 [US3] Add an `openapi:check` configuration/target to `apps/backend/package.json`'s
      `nx.targets`, invocable as `npx nx run backend:openapi:check`
- [x] T037 [US3] Wire `npx nx run backend:openapi:check` into CI (the same workflow file that
      already runs `npx nx affected -t lint test build`) so a stale `api/openapi.yml` fails the
      build
- [x] T038 [P] [US3] Wire `npx nx run backend:openapi:check` into `.husky/pre-push` alongside the
      existing `npm run test:coverage:affected` step
- [x] T039 [US3] Update `.claude/skills/speckit-plan/` and/or `.claude/skills/speckit-tasks/`
      instructions so that when a feature's plan/spec touches a backend controller, DTO, or route,
      the generated `tasks.md` includes an explicit task to add/update `@Api...` decorators and run
      `npx nx run backend:openapi`
- [x] T040 [US3] Update `.claude/skills/speckit-analyze/` instructions so the consistency check
      flags a feature as incomplete/inconsistent when it changed the API surface (new/changed
      controller route or DTO) without a corresponding documentation-update task or without
      `api/openapi.yml` being regenerated
- [x] T041 [US3] Validate T039/T040 per quickstart.md Scenario 4 step 3: run `/speckit-tasks` on a
      sample API-changing feature (or dry-run against this feature's own history) and confirm the
      documentation-update task appears

**Checkpoint**: All three user stories are independently functional — drift cannot silently pass CI
or the Speckit workflow

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Deployment verification and final validation across all stories

- [x] T042 [P] Run `docker compose -f docker-compose.portainer.yml config` to sanity-check the
      nginx change parses, then deploy it (or a local stand-in) and repeat quickstart.md Scenario 1
      steps 1–2 against that host's origin (FR-006, quickstart.md Scenario 3) — DONE: config parses
      cleanly; `/swagger`, `/openapi.yml`, and the full unauth→login→authed flow were verified
      directly against a locally-run backend. The nginx-proxied hop itself (`/api/openapi.yml`,
      `/swagger` through `docker/frontend.nginx.conf`) could not be exercised in this sandbox — its
      nested Docker-in-Docker networking doesn't expose a reachable host port for `--network host`.
      Re-run `docker compose up` (or the Portainer stack) in a normal environment and hit
      `http://localhost:4200/swagger` once to close this out.
- [x] T043 [P] Update the root `README.md` (or backend-specific docs) with a short pointer to
      `/swagger`, `api/openapi.yml`, and `api/bruno/` for new contributors
- [x] T044 Run `npx nx run-many -t lint test build --projects=backend` and confirm everything
      passes with the new `openapi` module and decorators in place
- [x] T045 Execute quickstart.md Scenarios 1–4 end-to-end as a final sign-off pass — DONE for
      Scenarios 1 (direct, non-proxied — see T042 caveat), 2 (openapi.yml content verified; Bruno
      collection reviewed manually per T034, not run through the Bruno app itself), and 4 (drift
      check exercised both clean and dirty). Scenario 3's actual Portainer deploy is the same
      out-of-sandbox follow-up noted in T042.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; its `.bru` requests (T032–T033) target
  endpoints whose full schema comes from US1's decorators, so start Phase 4 only after Phase 3's
  controller-decoration tasks (T017–T024) are done, even though no file is shared
- **User Story 3 (Phase 5)**: Depends on Foundational + a first generated `api/openapi.yml`
  (T029, from US2) to diff against
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — the MVP
- **User Story 2 (P2)**: Reads the fully-decorated document US1 produces; not independently
  meaningful until US1's decorators exist, but touches entirely different files
- **User Story 3 (P2)**: Reads the generated `api/openapi.yml` from US2 (T029) as the diff baseline

### Within Each User Story

- DTO classes before controller annotations (US1: T009–T016 before T017–T024)
- Generation script before Nx target before first generation (US2: T027 → T028 → T029)
- Drift-check script before CI/pre-push wiring (US3: T035 → T036 → T037/T038)

### Parallel Opportunities

- T002, T003 in Setup
- T006, T007 in Foundational
- T009–T016 (all DTO files, different files) in US1
- T030–T033 (Bruno collection files, different folders) in US2
- T038 in US3 (different file from T037)
- T042, T043 in Polish

---

## Parallel Example: User Story 1

```bash
# Launch all DTO-layer tasks together (different files, no dependencies):
Task: "Create decorated DTO classes for auth.ts in apps/backend/src/openapi/dto/auth.ts"
Task: "Create decorated DTO classes for accounts.ts in apps/backend/src/openapi/dto/accounts.ts"
Task: "Create decorated DTO classes for holdings.ts in apps/backend/src/openapi/dto/holdings.ts"
Task: "Create decorated DTO classes for invitations.ts in apps/backend/src/openapi/dto/invitations.ts"
Task: "Create decorated DTO classes for signups.ts in apps/backend/src/openapi/dto/signups.ts"
Task: "Create decorated DTO classes for profile.ts in apps/backend/src/openapi/dto/profile.ts"
Task: "Create decorated DTO classes for account-overview.ts in apps/backend/src/openapi/dto/account-overview.ts"
Task: "Create decorated ErrorResponseDto in apps/backend/src/openapi/dto/error-response.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — unlocks `/swagger` and `/openapi.yml`)
3. Complete Phase 3: User Story 1 — full decorator retrofit + completeness test
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 end-to-end
5. Demo `/swagger` with real try-it-out behavior

### Incremental Delivery

1. Setup + Foundational → `/swagger` and `/api/openapi.yml` reachable (minimal schemas)
2. Add User Story 1 → full schemas + try-it-out → validate → demo (MVP!)
3. Add User Story 2 → exported spec + Bruno collection → validate → demo
4. Add User Story 3 → CI/pre-push drift check + Speckit workflow integration → validate → demo
5. Polish → deployment verification, docs, final sign-off

### Parallel Team Strategy

1. One contributor completes Setup + Foundational
2. Once Foundational is done, User Story 1's DTO/controller pairs (T009–T024) can be split across
   contributors by module (auth, accounts, holdings, invitations, signups, profile,
   account-overview, health each pair independently)
3. User Story 2 (Bruno collection) and User Story 3 (CI/Speckit wiring) can proceed once User Story
   1's controllers are decorated and a first `api/openapi.yml` exists

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- FR-012's full-surface retrofit is deliberately placed entirely in US1 (Phase 3), since US1's own
  acceptance scenarios require every endpoint to show a complete schema, not just be listed
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
