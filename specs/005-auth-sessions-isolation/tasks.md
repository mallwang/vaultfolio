---
description: 'Task list template for feature implementation'
---

# Tasks: Authentication, Sessions & Per-User Data Isolation

**Input**: Design documents from `/specs/005-auth-sessions-isolation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, quickstart.md

**Tests**: Included — Principle III/IV (Test-First, Integration Testing) are non-negotiable per
plan.md's Constitution Check, and the spec's own Independent Test criteria are integration-level.

**Organization**: Tasks are grouped by user story. Both stories are P1 and ship in the same
increment per plan.md ("Existing `holdings` rows are scoped ... and migrated"), but US1
(authentication) is the structural prerequisite US2 (isolation) is layered on top of, so US1 is
built and independently verifiable first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions (Nx monorepo, per plan.md's Project Structure)

- Backend: `apps/backend/src/`
- Frontend: `apps/frontend/src/app/`
- Domain lib: `libs/domain/auth/src/lib/`
- Shared DTOs: `libs/api-contract/src/lib/`
- Backend tests colocated as `*.spec.ts` next to source (existing repo convention — see
  `apps/backend/src/holdings/*.spec.ts`); domain lib tests colocated under `libs/domain/auth/src/lib/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and scaffold the new lib/module directories

- [ ] T001 Add `argon2` and `@nestjs/throttler` to `apps/backend/package.json` (or root
      `package.json` per existing dependency convention) and install via `pnpm install`
- [ ] T002 [P] Generate `libs/domain/auth` Nx library (`pnpm nx g @nx/js:lib domain-auth --directory=libs/domain/auth`, matching `libs/domain/holdings`'s existing structure/tsconfig)
- [ ] T003 [P] Create `apps/backend/src/auth/` directory with `auth.module.ts` placeholder (empty
      `@Module({})`, wired into `apps/backend/src/app.module.ts` imports) so subsequent tasks have
      a target module
- [ ] T004 [P] Create `apps/frontend/src/app/auth/` directory placeholder for sign-in
      component/service/guard/interceptor files added in later phases

**Checkpoint**: Project structure exists; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain logic, schema, DTOs, and the global guard skeleton that every user story
depends on. **No user story work can begin until this phase is complete.**

### Domain logic (`libs/domain/auth`) — Test-First per Principle III

- [ ] T005 [P] Write failing unit tests for password-policy validation (8–200 chars; empty,
      too-short, too-long, boundary 8 and 200, valid) in
      `libs/domain/auth/src/lib/password-policy.spec.ts`
- [ ] T006 [P] Write failing unit tests for lockout-delay calculation (threshold 5, geometric
      escalation 30s/60s/120s/... capped at 15 min, resets on success) in
      `libs/domain/auth/src/lib/lockout-policy.spec.ts`
- [ ] T007 [P] Implement password-policy validation in `libs/domain/auth/src/lib/password-policy.ts`
      to make T005 pass (depends on T005)
- [ ] T008 [P] Implement lockout-delay calculation in `libs/domain/auth/src/lib/lockout-policy.ts`
      to make T006 pass — pure function `(failedAttempts: number) => { locked: boolean; delaySeconds?: number }` (depends on T006)
- [ ] T009 Export `password-policy.ts` and `lockout-policy.ts` from `libs/domain/auth/src/index.ts`
      (depends on T007, T008)

### Shared DTOs (`libs/api-contract`)

- [ ] T010 [P] Create `SignInRequest`, `SessionUser`, `AuthErrorResponse` interfaces in
      `libs/api-contract/src/lib/auth.ts` per contracts/auth-api.md, and export from
      `libs/api-contract/src/index.ts`

### Database schema (`DatabaseService`)

- [ ] T011 Add `users` table creation (`CREATE TABLE IF NOT EXISTS users ...` with columns/CHECKs
      per data-model.md: id, email UNIQUE COLLATE NOCASE, display_name, password_hash, role CHECK,
      status CHECK DEFAULT 'ACTIVE', failed_attempts DEFAULT 0, locked_until, created_at,
      updated_at) to `apps/backend/src/database/database.service.ts`
- [ ] T012 Add `sessions` table creation (id, user_id REFERENCES users(id), created_at,
      last_active_at, expires_at) plus `CREATE INDEX sessions_user_id_idx` to
      `apps/backend/src/database/database.service.ts` (depends on T011)
- [ ] T013 Add `holdings.owner_id` migration: `PRAGMA table_info(holdings)` check →
      `ALTER TABLE holdings ADD COLUMN owner_id TEXT NULL` → ensure bootstrap admin exists (creates
      from `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` env vars, argon2-hashing the password,
      role `ADMIN`, if `users` table is empty; logs a clear startup error and skips auth-route
      readiness if unset with no existing users) → `UPDATE holdings SET owner_id = ? WHERE owner_id
    IS NULL` → `CREATE INDEX IF NOT EXISTS holdings_owner_id_idx ON holdings (owner_id)`, all in
      `apps/backend/src/database/database.service.ts` (depends on T011, T012)
- [ ] T014 [P] Write integration test that boots `DatabaseService` against a fresh temp-file SQLite
      DB and asserts: `users`/`sessions` tables exist, bootstrap admin created from env vars,
      pre-existing `holdings` rows backfilled with the bootstrap admin's id, migration is idempotent
      on second run, in `apps/backend/src/database/database.service.spec.ts` (extend existing file)
      (depends on T013)

### Repositories (`apps/backend/src/auth/`)

- [ ] T015 [P] Write failing unit/integration tests for `UsersRepository`
      (findByEmail case-insensitive, create, incrementFailedAttempts, resetFailedAttempts,
      setLockedUntil, findById) against a temp-file SQLite DB in
      `apps/backend/src/auth/users.repository.spec.ts`
- [ ] T016 [P] Write failing unit/integration tests for `SessionsRepository` (create, findById,
      touch/updateLastActiveAt, deleteById, deleteAllForUser, and that an expired row is treated as
      a miss) against a temp-file SQLite DB in `apps/backend/src/auth/sessions.repository.spec.ts`
- [ ] T017 Implement `UsersRepository` in `apps/backend/src/auth/users.repository.ts` to make T015
      pass (depends on T015, T011)
- [ ] T018 Implement `SessionsRepository` in `apps/backend/src/auth/sessions.repository.ts`,
      including `deleteAllForUser(userId)` (research.md #4/FR-012 primitive) and lazy
      delete-on-read for expired/inactive rows, to make T016 pass (depends on T016, T012)

### Global guard skeleton

- [ ] T019 [P] Create `@Public()` decorator in `apps/backend/src/auth/public.decorator.ts`
- [ ] T020 [P] Create `@Roles()` decorator in `apps/backend/src/auth/roles.decorator.ts`
- [ ] T021 [P] Create `@CurrentUser()` param decorator in
      `apps/backend/src/auth/current-user.decorator.ts` (reads `request.user`)
- [ ] T022 Implement `AuthGuard` in `apps/backend/src/auth/auth.guard.ts`: reads session cookie,
      looks up via `SessionsRepository`, 401s on miss/expired, attaches
      `request.user = { id, role }`, bumps `last_active_at`, honors `@Public()` (depends on T018,
      T019, T021)
- [ ] T023 Implement `RolesGuard` in `apps/backend/src/auth/roles.guard.ts`: reads `@Roles()`
      metadata and `request.user.role`, 403s on mismatch (depends on T020, T021)
- [ ] T024 Register `AuthGuard` as a global guard via `APP_GUARD` in
      `apps/backend/src/auth/auth.module.ts`, mark `/health` (and any other existing public route)
      with `@Public()` (depends on T022)

**Checkpoint**: Schema, domain logic, repositories, and the global auth guard exist and are unit/
integration tested. Nothing is reachable through HTTP yet — user story phases wire up the
controller and consumers next.

---

## Phase 3: User Story 1 - Sign in / sign out with a server-side session (Priority: P1) 🎯 MVP

**Goal**: A user can sign in with email/password, receive an httpOnly session cookie, reach
protected routes, sign out (which destroys the session server-side), have inactive/expired
sessions rejected, and be locked out after repeated failed attempts — all enforced by default via
the global guard from Phase 2.

**Independent Test**: Create two accounts, sign in as each in turn under their own identity;
confirm every authenticated route redirects/401s an unauthenticated visitor; confirm sign-out
immediately invalidates the old cookie.

### Tests for User Story 1 ⚠️

- [ ] T025 [P] [US1] Integration test: `POST /api/auth/sign-in` with valid bootstrap-admin
      credentials → 200 + `SessionUser` body + `Set-Cookie`; with wrong password → 401
      `invalid_credentials`; with nonexistent email → byte-for-byte identical 401 body (FR-008,
      SC-005) in `apps/backend/src/auth/auth.controller.spec.ts`
- [ ] T026 [P] [US1] Integration test: sign-in → cookie → `GET /api/auth/session` returns
      `SessionUser`; without cookie → 401 `unauthenticated`; any existing protected route (e.g.
      `GET /api/holdings`) without cookie → 401, with cookie → 200 in
      `apps/backend/src/auth/auth.controller.spec.ts`
- [ ] T027 [P] [US1] Integration test: `POST /api/auth/sign-out` → 204 + cookie cleared; subsequent
      request with the same stale cookie → 401 (FR-003, SC-003) in
      `apps/backend/src/auth/auth.controller.spec.ts`
- [ ] T028 [P] [US1] Integration test: 6 consecutive wrong-password attempts on one account →
      6th (threshold-crossing) response is 429 `account_locked`, with escalating delay confirmed on
      further attempts (FR-007, SC-004) in `apps/backend/src/auth/auth.controller.spec.ts`
- [ ] T029 [P] [US1] Integration test: a session past `SESSION_INACTIVITY_TIMEOUT_MINUTES` (or
      `SESSION_ABSOLUTE_LIFETIME_HOURS`) is rejected with 401 on next use (FR-004, Acceptance #4) in
      `apps/backend/src/auth/sessions.repository.spec.ts` (extend from T016) or
      `auth.controller.spec.ts`

### Implementation for User Story 1

- [ ] T030 [US1] Implement `AuthService` in `apps/backend/src/auth/auth.service.ts`: `signIn(email,
    password)` (lockout check → `libs/domain/auth` lockout-policy → argon2 verify → on success
      reset failed_attempts + create session; on failure increment failed_attempts + maybe set
      locked_until, per research.md #3), `signOut(sessionId)`, using `UsersRepository`/
      `SessionsRepository` (depends on T017, T018, T008)
- [ ] T031 [US1] Implement `AuthController` in `apps/backend/src/auth/auth.controller.ts`:
      `POST /api/auth/sign-in` (`@Public()`, sets cookie, returns `SessionUser` or 401/429 per
      contracts/auth-api.md), `POST /api/auth/sign-out` (204, clears cookie), `GET /api/auth/session`
      (returns `SessionUser` or 401) — request/response bodies typed via
      `libs/api-contract/src/lib/auth.ts` (depends on T030, T010, T022, makes T025–T027 pass)
- [ ] T032 [US1] Wire `@nestjs/throttler` as a secondary global per-IP rate limit on
      `POST /api/auth/sign-in` in `apps/backend/src/auth/auth.module.ts` / `app.module.ts`
      (research.md #3) (depends on T024)
- [ ] T033 [US1] Add cookie parsing (`cookie-parser` or Nest's built-in) and session cookie
      read/write helpers (name, httpOnly, `Secure` in prod, `SameSite=Lax`, path `/`) to
      `apps/backend/src/auth/auth.controller.ts` / `main.ts` (depends on T031)
- [ ] T034 [US1] Register `AuthController`, `AuthService`, `UsersRepository`, `SessionsRepository`
      in `apps/backend/src/auth/auth.module.ts` (depends on T030, T031)

**Checkpoint**: Backend authentication is fully functional and independently testable via the
API (T025–T029 all pass). Frontend pieces below make it usable end-to-end but are not required for
the backend Independent Test criterion.

### Frontend for User Story 1

- [ ] T035 [P] [US1] Implement `AuthService` (`signIn`, `signOut`, `getSession`) in
      `apps/frontend/src/app/auth/auth.service.ts` calling the `/api/auth/*` endpoints, typed via
      `libs/api-contract`
- [ ] T036 [P] [US1] Implement `SignInComponent` (email/password form, generic error display, calls
      `AuthService.signIn`) in `apps/frontend/src/app/auth/sign-in/sign-in.component.ts`
- [ ] T037 [US1] Implement functional `authGuard` (calls `GET /api/auth/session`, redirects to
      `/sign-in` on failure) in `apps/frontend/src/app/auth/auth.guard.ts` (depends on T035)
- [ ] T038 [US1] Implement `authInterceptor` (redirects to `/sign-in` on any 401 response) in
      `apps/frontend/src/app/auth/auth.interceptor.ts`, register in
      `apps/frontend/src/app/app.config.ts`
- [ ] T039 [US1] Add `/sign-in` route (public) and apply `authGuard` to existing protected routes in
      `apps/frontend/src/app/app.routes.ts` (depends on T036, T037)

**Checkpoint**: User Story 1 fully functional and independently testable end-to-end (backend +
frontend). This is the MVP.

---

## Phase 4: User Story 2 - Each user keeps their own private data (Priority: P1)

**Goal**: Every `holdings` read/write is scoped to `request.user.id`; no cross-account leakage
through any list, detail view, dashboard, search, or export; ownership never appears in any
response; admin role never implies cross-user access; a foreign-owned record 404s rather than 403s.

**Independent Test**: User A creates a holding; sign in as User B and confirm it's absent from
every list/dashboard/search/export; edits/deletes by A don't affect B; an admin account is denied
access to another user's holdings through the API.

### Tests for User Story 2 ⚠️

- [ ] T040 [P] [US2] Integration test: as User A, `POST /api/holdings` creates a holding; as User B,
      `GET /api/holdings` does not contain it (Acceptance #1, SC-002) in
      `apps/backend/src/holdings/holdings.controller.spec.ts` (extend existing file)
- [ ] T041 [P] [US2] Integration test: as User B, `GET /api/holdings/:idOwnedByA` → 404 (not 403);
      `PATCH`/`DELETE /api/holdings/:idOwnedByA` → 404 (data-model.md ownership-leak note) in
      `apps/backend/src/holdings/holdings.controller.spec.ts`
- [ ] T042 [P] [US2] Integration test: User A edits/deletes their own holding; User B's holdings/
      views are unaffected (Acceptance #2) in `apps/backend/src/holdings/holdings.controller.spec.ts`
- [ ] T043 [P] [US2] Integration test: any aggregate/summary endpoint reflects only the requesting
      user's holdings (Acceptance #3) in `apps/backend/src/holdings/holdings.controller.spec.ts`
- [ ] T044 [P] [US2] Integration test: pre-existing (migrated) holdings from the bootstrap-admin
      backfill are visible to the bootstrap admin and invisible to a second `MEMBER` account
      (Acceptance #4) in `apps/backend/src/holdings/holdings.controller.spec.ts`
- [ ] T045 [P] [US2] Integration test: signed in as an `ADMIN`, reading another user's holding by ID
      → 404, confirming role never implies cross-user access (Acceptance #5) in
      `apps/backend/src/holdings/holdings.controller.spec.ts`
- [ ] T046 [P] [US2] Integration test: every `holdings` response body (list, detail, export) across
      the above tests contains no `owner_id`/ownership field (FR-010) in
      `apps/backend/src/holdings/holdings.controller.spec.ts`

### Implementation for User Story 2

- [ ] T047 [US2] Add `ownerId` parameter and `AND owner_id = $N` predicate to every
      `HoldingsRepository` method (`findAll`, `findById`, `findUpsertMatch`, `insert` — sets
      `owner_id`, `updateById`, `deleteById`) in `apps/backend/src/holdings/holdings.repository.ts`
      (depends on T013)
- [ ] T048 [US2] Update `HoldingsController` to read `request.user.id` (via `@CurrentUser()`) and
      pass it as `ownerId` on every call into `HoldingsRepository`; ensure no response DTO ever
      serializes `owner_id` in `apps/backend/src/holdings/holdings.controller.ts` (depends on T047,
      T021, makes T040–T046 pass)
- [ ] T049 [US2] Audit and update any aggregate/dashboard/export endpoints in
      `apps/backend/src/holdings/` (or wherever they live) to scope by `owner_id` the same way
      (depends on T047)

**Checkpoint**: Both user stories independently functional — full auth + strict per-user isolation.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Observability, documentation, and end-to-end validation across both stories

- [ ] T050 [P] Add structured logging (via existing `JsonLoggerService`) for sign-in
      success/failure/lockout events, logging account id (never the password) in
      `apps/backend/src/auth/auth.service.ts` (Principle V)
- [ ] T051 [P] Update root `README.md` / deployment docs with `BOOTSTRAP_ADMIN_EMAIL`,
      `BOOTSTRAP_ADMIN_PASSWORD`, `SESSION_INACTIVITY_TIMEOUT_MINUTES`,
      `SESSION_ABSOLUTE_LIFETIME_HOURS` env vars and add them to `docker-compose.yml` / `.env.example`
- [ ] T052 Run the full `quickstart.md` validation (Scenarios A and B) manually against
      `docker compose up --build` and confirm every step's exact status code/body
- [ ] T053 [P] Run `pnpm nx run-many -t lint test` across affected projects
      (`domain-auth`, `api-contract`, `backend`, `frontend`) and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion — no dependency on US2
- **User Story 2 (Phase 4)**: Depends on Foundational completion; also depends on US1's
  `AuthGuard`/`@CurrentUser()` being wired (T022, T024) so `request.user` exists on every request —
  in practice, do Phase 3 backend tasks (T030–T034) before Phase 4, even though both are "P1"
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). Fully self-contained.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2), but functionally requires US1's
  `request.user` to exist on incoming requests (i.e., T022/T024/T030/T031 done) — not independent
  of US1 the way the template's "most stories are independent" default assumes, because isolation
  has no meaning without an authenticated identity to scope by. This mirrors spec.md's own framing
  ("ships in the same increment as sign-in").

### Within Each User Story

- Tests before implementation (Red-Green-Refactor, Principle III)
- Repositories before services; services before controllers
- Backend before frontend (US1)

### Parallel Opportunities

- Phase 1: T002, T003, T004 in parallel (after T001)
- Phase 2: T005/T006 in parallel; T007/T008 in parallel (after their respective tests); T010 in
  parallel with the domain-lib tasks; T015/T016 in parallel; T019/T020/T021 in parallel
- Phase 3: T025–T029 (all test tasks) in parallel; T035/T036 in parallel
- Phase 4: T040–T046 (all test tasks) in parallel
- Phase 5: T050, T051, T053 in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# Domain-logic tests, in parallel:
Task: "Write failing unit tests for password-policy validation in libs/domain/auth/src/lib/password-policy.spec.ts"
Task: "Write failing unit tests for lockout-delay calculation in libs/domain/auth/src/lib/lockout-policy.spec.ts"

# Repository tests, in parallel:
Task: "Write failing tests for UsersRepository in apps/backend/src/auth/users.repository.spec.ts"
Task: "Write failing tests for SessionsRepository in apps/backend/src/auth/sessions.repository.spec.ts"
```

## Parallel Example: User Story 2 tests

```bash
Task: "Integration test: cross-account list isolation in apps/backend/src/holdings/holdings.controller.spec.ts"
Task: "Integration test: foreign-owned record 404s in apps/backend/src/holdings/holdings.controller.spec.ts"
Task: "Integration test: admin has no cross-user access in apps/backend/src/holdings/holdings.controller.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — schema, domain logic, guard)
3. Complete Phase 3: User Story 1 (sign-in/out, lockout, both backend and frontend)
4. **STOP and VALIDATE**: Run quickstart.md Scenario A independently
5. Deploy/demo if ready — note that without Phase 4, `holdings` still has no `owner_id` scoping
   applied at the query layer, so this MVP checkpoint is auth-only, not yet isolation-safe

### Incremental Delivery

1. Setup + Foundational → foundation ready (schema, guard, domain logic all tested)
2. Add User Story 1 → validate quickstart Scenario A → auth works end-to-end
3. Add User Story 2 → validate quickstart Scenario B → isolation enforced
4. Polish → logging, docs, full quickstart pass, lint/test clean

### Parallel Team Strategy

With multiple developers, once Foundational (Phase 2) is done:

- Developer A: US1 backend (T030–T034)
- Developer B: US1 frontend (T035–T039, can start once T010/api-contract DTOs exist, stub against
  contracts/auth-api.md while backend is in progress)
- Once US1 backend lands: Developer A or C picks up US2 (T047–T049), since it depends on
  `request.user` existing

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Both user stories are P1 per spec.md; they are sequenced (US1 before US2) here because isolation
  has no meaning without authentication, not because US2 is lower priority
- Verify tests fail before implementing (Principle III, Red-Green-Refactor)
- Commit after each task or logical group
- Stop at either checkpoint to validate independently
- The 404-not-403 ownership-leak rule (data-model.md, contracts/auth-api.md) applies to every new
  `holdings` test and implementation task in Phase 4 — never assert or return 403 for a
  foreign-owned record ID
