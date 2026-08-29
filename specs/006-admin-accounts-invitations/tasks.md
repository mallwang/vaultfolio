---
description: 'Task list template for feature implementation'
---

# Tasks: Admin Account Management & Invitations

**Input**: Design documents from `/specs/006-admin-accounts-invitations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/accounts-api.md,
contracts/invitations-api.md, quickstart.md, design.md

**Tests**: Included — Constitution Principle III/IV are NON-NEGOTIABLE for this feature (plan.md's
Constitution Check explicitly calls out Red-Green-Refactor for the last-admin invariant, token
state machine, expiry math, and the integration scenarios in quickstart.md).

**Organization**: Tasks are grouped by user story (US1 = account lifecycle, US2 = invitations) to
enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 or US2
- Paths are exact, from plan.md's Project Structure

## Path Conventions (this feature)

- Backend: `apps/backend/src/accounts/`, `apps/backend/src/invitations/`, extends
  `apps/backend/src/auth/users.repository.ts` and `apps/backend/src/database/database.service.ts`
- Domain libs: `libs/domain/auth/src/lib/`, `libs/domain/invitations/src/lib/`
- Shared DTOs: `libs/api-contract/src/lib/`
- Frontend: `apps/frontend/src/app/settings/accounts/`, `apps/frontend/src/app/settings/invitations/`,
  `apps/frontend/src/app/invite/accept/`, `apps/frontend/src/app/invite/expired/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and scaffolding needed before any domain/foundational work

- [x] T001 Add `nodemailer` (+ `@types/nodemailer` dev dep) to `apps/backend/package.json` per
      research.md #1; run `npm install`
- [x] T002 [P] Generate `libs/domain/invitations` lib via Nx (`@nx/js:lib`, matching
      `libs/domain/auth`'s buildable/testable config in `libs/domain/auth/{package.json,tsconfig*.json,jest.config.cts}`)
- [x] T003 [P] Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
      `ACCOUNT_RETENTION_DAYS` (default 30), `INVITATION_EXPIRY_DAYS` (default 7) to the backend's
      env config loading and `docker-compose.yml`/`.env.example` (quickstart.md Prerequisites)

**Checkpoint**: Dependencies installed, `libs/domain/invitations` scaffold buildable/testable, env vars documented

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared DTOs, and pure domain logic that both user stories build on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Domain logic (test-first)

- [x] T004 [P] Write failing tests for `canRemoveLastAdmin(activeAdminCount, isTargetActiveAdmin)` in
      `libs/domain/auth/src/lib/last-admin.ts` (spec.ts) — zero-remaining-admin rejection, non-admin
      target always allowed, multi-admin allowed (research.md #3)
- [x] T005 [P] Implement `libs/domain/auth/src/lib/last-admin.ts` to pass T004; export from
      `libs/domain/auth/src/index.ts`
- [x] T006 [P] Write failing tests for token generation/expiry in
      `libs/domain/invitations/src/lib/invitation-token.ts` (spec.ts) — opaque base64url token shape,
      `computeExpiry(createdAt, days)` (research.md #2)
- [x] T007 [P] Implement `libs/domain/invitations/src/lib/invitation-token.ts` to pass T006
- [x] T008 [P] Write failing tests for the state machine in
      `libs/domain/invitations/src/lib/invitation-state.ts` (spec.ts) — every legal transition
      (pending→accepted/expired/cancelled/superseded) and every illegal one rejected (data-model.md
      Lifecycle)
- [x] T009 [P] Implement `libs/domain/invitations/src/lib/invitation-state.ts` to pass T008; export
      both from `libs/domain/invitations/src/index.ts`

### Schema & repositories

- [x] T010 Extend `apps/backend/src/database/database.service.ts` `migrateAuth()` (or equivalent
      migration step): add `users.archived_at TEXT NULL`, `users.retention_expires_at TEXT NULL` via
      `PRAGMA table_info` guard pattern (data-model.md)
- [x] T011 Add `invitations` table creation to `apps/backend/src/database/database.service.ts`
      (columns/CHECKs/indexes exactly per data-model.md: `invitations_token_idx` unique,
      `invitations_email_idx` on `email COLLATE NOCASE`)
- [x] T012 Extend `apps/backend/src/auth/users.repository.ts`: `findAll()` (all accounts, any
      status), `countActiveAdmins(excludingUserId?)`, `updateRole(id, role)`,
      `archive(id, retentionExpiresAt)` (sets `status='ARCHIVED'`, `archived_at`,
      `retention_expires_at`, guarded `UPDATE ... WHERE status='ACTIVE'`), `reactivate(id)` (guarded
      `UPDATE ... WHERE status='ARCHIVED'`, clears both columns), `deleteById(id)` (cascades owned
      data per spec 005's `deleteAllForUser` pattern)
- [x] T013 [P] Write/extend `apps/backend/src/auth/users.repository.spec.ts` for the T012 additions
      against a real temp-file SQLite DB (Principle IV): race guard (zero-rows-affected on
      already-archived/already-active), cascade-delete of owned data
- [x] T014 Create `apps/backend/src/invitations/invitations.repository.ts`: `create(...)`,
      `findById(id)`, `findByToken(token)`, `findPendingByEmail(email)`, `findAll()`,
      `supersede(id)` (guarded `WHERE status='PENDING'`), `cancel(id)` (guarded
      `WHERE status='PENDING'`), `markAccepted(id)` (guarded `WHERE status='PENDING' AND expires_at > now`),
      `markExpired(id)` (opportunistic write, research.md #4)
- [x] T015 [P] Write `apps/backend/src/invitations/invitations.repository.spec.ts` against a real
      temp-file SQLite DB (Principle IV): supersede-on-new-invite, cancel-only-from-pending,
      accept-guarded-by-status-and-expiry, race guard returns zero-rows-affected

### Shared DTOs

- [x] T016 [P] Create `libs/api-contract/src/lib/accounts.ts` per contracts/accounts-api.md
      (`AccountSummary`, `ChangeRoleRequest`, `AccountsErrorResponse`); export from
      `libs/api-contract/src/index.ts`
- [x] T017 [P] Create `libs/api-contract/src/lib/invitations.ts` per contracts/invitations-api.md
      (`InvitationSummary`, `CreateInvitationRequest`, `InvitationTokenLookup`,
      `AcceptInvitationRequest`, `InvitationsErrorResponse`); export from
      `libs/api-contract/src/index.ts`

**Checkpoint**: Domain logic proven correct in isolation, schema migrated, repositories tested
against real SQLite, DTOs published — user story implementation can now begin

---

## Phase 3: User Story 1 - Administrator manages the full account lifecycle (Priority: P1) 🎯 MVP

**Goal**: Admin can list every account, change roles, archive/reactivate, with the last-admin
invariant enforced everywhere and sessions invalidated on archive/delete.

**Independent Test**: Archive a member's account, confirm sign-in denied and active session
invalidated; reactivate within the retention window and confirm access/data restored
(quickstart.md Scenario A).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [x] T018 [P] [US1] Integration test in
      `apps/backend/src/accounts/accounts.controller.spec.ts` (real temp-file SQLite,
      Principle IV): `GET /api/accounts` returns all accounts incl. archived, `isLastActiveAdmin`
      correct (quickstart.md Scenario A.1, Acceptance #1)
- [x] T019 [P] [US1] Integration test: `PATCH /api/accounts/:id/role` — 200 + role takes effect on
      that user's very next request (re-fetch via `AuthGuard` path), 404 unknown id, 409 last-admin
      (Scenario A.2/A.6, Acceptance #2, #5, #7, FR-002/FR-004)
- [x] T020 [P] [US1] Integration test: `POST /api/accounts/:id/archive` — 200 + status ARCHIVED +
      retentionExpiresAt set, sign-in denied (401) after, replayed session cookie 401s, 409
      last-admin, 409 already_archived on race (Scenario A.3/A.6, Acceptance #2, #5, FR-003/FR-004/FR-005,
      SC-004)
- [x] T021 [P] [US1] Integration test: `POST /api/accounts/:id/reactivate` — 200 + status ACTIVE +
      original data intact, 404 already-active/unknown, 410 retention_expired past window
      (Scenario A.4, Acceptance #3, FR-003)
- [x] T022 [P] [US1] Integration test: `DELETE /api/accounts/:id` — 204 self-delete + sessions
      invalidated, 403 on non-self id, 409 last-admin (Scenario A.6, Acceptance #6, FR-004)
- [x] T023 [P] [US1] Integration test: non-admin (`MEMBER` role session) calling any
      `/api/accounts/*` route → 403 regardless of route (Scenario A.5, Acceptance #4, FR-006)

### Implementation for User Story 1

- [x] T024 [US1] Create `apps/backend/src/accounts/accounts.module.ts` (imports `DatabaseModule`,
      `AuthModule`)
- [x] T025 [US1] Create `apps/backend/src/accounts/accounts.service.ts`: `listAll()` (maps
      `UsersRepository.findAll()` → `AccountSummary[]`, computing `isLastActiveAdmin` per row via
      `countActiveAdmins`), `changeRole(id, role)`, `archive(id)`, `reactivate(id)`,
      `deleteSelf(callerId, targetId)` — every last-admin check routes through the single
      `libs/domain/auth` `canRemoveLastAdmin` predicate (research.md #3); archive/delete call
      `SessionsRepository.deleteAllForUser` in the same transaction (FR-005)
- [x] T026 [US1] Create `apps/backend/src/accounts/accounts.controller.ts`: `GET /`, `PATCH
/:id/role`, `POST /:id/archive`, `POST /:id/reactivate`, `DELETE /:id`, all under
      `@Roles('ADMIN')` + `AuthGuard` (spec 005 primitives), structured error bodies exactly per
      contracts/accounts-api.md
- [x] T027 [US1] Register `AccountsModule` in `apps/backend/src/app/app.module.ts`
- [x] T028 [US1] Confirm T018–T023 pass (Red→Green); add logging via `JsonLoggerService` for
      role-change/archive/reactivate/delete (actor, target, outcome — no password/token values,
      Principle V)
- [x] T029 [P] [US1] Create `apps/frontend/src/app/settings/accounts/accounts.component.ts` +
      `.html`/`.css`: table of all accounts (email, display name, role, status), inline role
      `<select>` disabled for the sole active admin, archived-row "N days left" pill + reactivate
      action, last-admin-blocked banner (design.md "Accounts tab", "Last-admin-blocked banner")
- [x] T030 [P] [US1] Create `apps/frontend/src/app/settings/accounts/archive-confirm-dialog` (or
      inline PrimeNG `ConfirmDialog`) naming the retention window and immediate sign-out
      (design.md "Archive-confirm dialog")
- [x] T031 [US1] Wire `AccountsComponent` into `apps/frontend/src/app/settings/settings.component.ts`
      as the "Accounts" sub-tab (matches existing `HealthStatusComponent` sub-tab pattern)
- [x] T032 [US1] Add an accounts API client (e.g. `apps/frontend/src/app/settings/accounts/accounts.service.ts`)
      calling `GET/PATCH/POST/DELETE /api/accounts*` using `libs/api-contract` DTOs

**Checkpoint**: User Story 1 fully functional and independently testable — admin can list, role-change,
archive, reactivate, self-delete, with last-admin invariant and session invalidation enforced

---

## Phase 4: User Story 2 - Email-based invitations (Priority: P2)

**Goal**: Admin invites by email only; invitee activates via single-use, time-limited link,
choosing their own password.

**Independent Test**: Invite a test email, confirm a usable single-use link is generated;
separately complete the invitation with a compliant password and confirm sign-in succeeds
(quickstart.md Scenario B).

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [x] T033 [P] [US2] Integration test in
      `apps/backend/src/invitations/invitations.controller.spec.ts` (real temp-file SQLite,
      Principle IV): `POST /api/invitations` — 201 + email sent (mock `EmailService`), 409
      account_exists for active/archived email, 502 email_delivery_failed with row still created
      (Scenario B.1/B.4/B.9, Acceptance #1/#3, FR-007/FR-008)
- [x] T034 [P] [US2] Integration test: second invite to same email supersedes the first — new row
      201, old row status SUPERSEDED, old token 410s on token-lookup (Scenario B.3, Acceptance #4,
      FR-009)
- [x] T035 [P] [US2] Integration test: `GET /api/invitations` lists all statuses with
      status/createdAt (Scenario B.2, Acceptance #2, FR-010)
- [x] T036 [P] [US2] Integration test: `POST /api/invitations/:id/cancel` — 200 CANCELLED, 404
      unknown, 409 already_resolved on non-pending/race (Scenario B.7, FR-010, FR-012)
- [x] T037 [P] [US2] Integration test: `POST /api/invitations/:id/resend` — 201 new row + old
      superseded + re-emailed, 404/409/502 paths (FR-009/FR-010)
- [x] T038 [P] [US2] Integration test: `GET /api/invitations/token/:token` — 200 with
      email/role for pending+unexpired, 410 invalid_invitation for
      not-found/accepted/expired/cancelled/superseded (no distinguishing detail in body)
      (Acceptance #6, FR-012)
- [x] T039 [P] [US2] Integration test: `POST /api/invitations/token/:token/accept` — 201 + user
      created + SessionUser + session cookie + subsequent sign-in works; 400 invalid_password; 410
      on replay (no duplicate account, invitation status still exactly ACCEPTED); 410 on
      expired/cancelled token re-checked atomically at accept time (Scenario B.5/B.6/B.8, Acceptance
      #5/#6, FR-011/FR-012, SC-002)

### Implementation for User Story 2

- [x] T040 [US2] Create `apps/backend/src/invitations/email.service.ts`: `nodemailer` SMTP
      transport from env vars, `sendInvitation(to: string, token: string): Promise<void>`, catches
      and rethrows delivery errors with context for the caller to log (research.md #1) — never
      crashes on misconfigured SMTP at startup
- [x] T041 [US2] Create `apps/backend/src/invitations/invitations.module.ts` (imports
      `DatabaseModule`, `AuthModule`)
- [x] T042 [US2] Create `apps/backend/src/invitations/invitations.service.ts`:
      `checkEmailAvailable(email)` (single source-of-truth: `UsersRepository.findByEmail` +
      `InvitationsRepository.findPendingByEmail`, research.md #6), `create(email, role, invitedBy)`
      (supersede-then-insert transaction, calls `EmailService`), `list()`, `cancel(id)`,
      `resend(id)` (supersede-then-insert + re-email), `lookupByToken(token)` (lazy-expire check,
      opportunistically calls `markExpired`), `accept(token, password, displayName)` (atomic
      status+expiry-guarded transition, creates `users` row via `UsersRepository`, hashes password
      with `argon2` per spec 005 policy, issues session via existing `AuthService`/session-cookie
      mechanism)
- [x] T043 [US2] Create `apps/backend/src/invitations/invitations.controller.ts`: admin routes
      (`POST /`, `GET /`, `POST /:id/cancel`, `POST /:id/resend`) under `@Roles('ADMIN')`; public
      routes (`GET /token/:token`, `POST /token/:token/accept`) under `@Public()`; structured error
      bodies exactly per contracts/invitations-api.md
- [x] T044 [US2] Register `InvitationsModule` in `apps/backend/src/app/app.module.ts`
- [x] T045 [US2] Confirm T033–T039 pass (Red→Green); add logging via `JsonLoggerService` for
      send/cancel/resend/accept (actor, target, outcome — no token value ever logged, Principle V)
- [x] T046 [US2] Create `apps/backend/src/accounts/retention-sweep.service.ts` (or similar,
      `OnModuleInit` + `setInterval`, hourly): permanently deletes `ARCHIVED` users past
      `retention_expires_at`, cascading owned data (research.md #5); register in `AccountsModule`
- [x] T047 [P] [US2] Write test for the retention sweep in
      `apps/backend/src/accounts/retention-sweep.service.spec.ts` (real temp-file SQLite): deletes
      only past-window archived users, leaves within-window and active users untouched
- [x] T048 [P] [US2] Create `apps/frontend/src/app/settings/invitations/invitations.component.ts` +
      `.html`/`.css`: pending/accepted/expired/cancelled/superseded list with resend/cancel row
      actions, "Invite member" primary action (design.md "Invitations tab")
- [x] T049 [P] [US2] Create `apps/frontend/src/app/settings/invitations/invite-dialog` component:
      email + role fields, invitee-sets-own-password hint, inline "already exists" error state
      (design.md "Invite dialog", "Invite dialog — already exists")
- [x] T050 [US2] Wire `InvitationsComponent` into `apps/frontend/src/app/settings/settings.component.ts`
      as the "Invitations" sub-tab
- [x] T051 [P] [US2] Add an invitations API client (e.g.
      `apps/frontend/src/app/settings/invitations/invitations.service.ts`) calling
      `POST/GET/POST/POST /api/invitations*` using `libs/api-contract` DTOs
- [x] T052 [P] [US2] Create `apps/frontend/src/app/invite/accept/accept.component.ts` + `.html`/`.css`:
      shell-less page, reads `:token` from route, `GET`s the lookup, shows invited email/role
      (read-only) + password/confirm fields, reuses spec 005's password-policy validation
      (design.md "Accept-invite page")
- [x] T053 [P] [US2] Create `apps/frontend/src/app/invite/expired/expired.component.ts` + `.html`/`.css`:
      shell-less neutral messaging page for used/cancelled/expired links (design.md
      "Invite-expired/used page")
- [x] T054 [US2] Add `/invite/:token` public routes to `apps/frontend/src/app/app.routes.ts` (accept
      page renders `expired.component` when the lookup 410s, no `authGuard` — matches `/sign-in`'s
      public-route precedent)

**Checkpoint**: All user stories independently functional — full invite→accept→sign-in round trip
works, superseded/expired/cancelled/reused tokens rejected uniformly, retention sweep runs

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening spanning both stories

- [x] T055 [P] Run `apps/backend/src/database/database.service.spec.ts` (or add coverage) confirming
      the `users.archived_at`/`retention_expires_at` migration and `invitations` table migration are
      idempotent (safe to run twice, matching spec 005's `PRAGMA table_info` pattern)
- [x] T056 [P] Add unit tests for `AccountsService`'s `isLastActiveAdmin` computation and
      `InvitationsService.checkEmailAvailable`'s three-way discriminated result
      (`available | has_account | has_pending_invitation`) in isolation (mocked repositories)
- [ ] T057 Execute quickstart.md Scenario A and Scenario B end-to-end against the Docker Compose
      stack with a local SMTP catcher (Mailpit/MailHog) per its Prerequisites; confirm every listed
      status code/body
- [x] T058 [P] Verify no password or invitation token value appears in any `JsonLoggerService`
      output across accounts/invitations flows (Principle V)
- [x] T059 Run `npm exec nx run-many -t lint test build -p backend frontend api-contract` (or
      `domain-auth`/`domain-invitations` lib project names as generated in T002) and fix any
      failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only — no dependency on US2
- **User Story 2 (Phase 4)**: Depends on Foundational; the invitation `accept` flow depends on
  `UsersRepository`'s create path (already present from spec 005) and its own migrations (Phase 2),
  not on US1's controller/service code — so US2 can, in principle, proceed in parallel with US1,
  but spec.md frames US1 as the priority-ordered prerequisite ("depends on account management (User
  Story 1) existing first" — Why this priority), so implement sequentially unless staffed for
  parallel work
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Tests (T018–T023 / T033–T039) MUST be written and FAIL before implementation
- Repository/service before controller
- Controller/service complete and green before frontend components
- Frontend components before route wiring

### Parallel Opportunities

- T002, T003 (Setup) in parallel with T001
- T004/T006/T008 (failing tests) in parallel with each other; each paired implementation (T005/T007/T009)
  follows its own test
- T013, T015, T016, T017 in parallel once T010–T012/T014 land
- All US1 tests (T018–T023) in parallel; all US2 tests (T033–T039) in parallel
- T029/T030 (US1 frontend) in parallel with each other and with backend T024–T028 once DTOs (T016)
  exist
- T048/T049/T052/T053 (US2 frontend) in parallel with each other and with backend T040–T047 once
  DTOs (T017) exist

---

## Parallel Example: User Story 1

```bash
# Launch all integration tests for User Story 1 together (writing first, confirm failing):
Task: "Integration test GET /api/accounts in apps/backend/src/accounts/accounts.controller.spec.ts"
Task: "Integration test PATCH /api/accounts/:id/role in apps/backend/src/accounts/accounts.controller.spec.ts"
Task: "Integration test POST /api/accounts/:id/archive in apps/backend/src/accounts/accounts.controller.spec.ts"
Task: "Integration test POST /api/accounts/:id/reactivate in apps/backend/src/accounts/accounts.controller.spec.ts"
Task: "Integration test DELETE /api/accounts/:id in apps/backend/src/accounts/accounts.controller.spec.ts"
Task: "Integration test non-admin 403 in apps/backend/src/accounts/accounts.controller.spec.ts"

# Launch frontend components for User Story 1 together (once T016 DTOs exist):
Task: "Create AccountsComponent in apps/frontend/src/app/settings/accounts/accounts.component.ts"
Task: "Create archive-confirm dialog in apps/frontend/src/app/settings/accounts/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — last-admin predicate, schema, repositories, DTOs)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Scenario A end-to-end
5. Deploy/demo if ready — admins can manage accounts even before invitations exist (manually
   provisioned accounts, per spec.md's Why this priority)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate via quickstart.md Scenario A → deploy/demo (MVP!)
3. Add User Story 2 → validate via quickstart.md Scenario B → deploy/demo
4. Polish phase → full quickstart.md run, lint/test/build clean

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: User Story 1 backend (T024–T028) then frontend (T029–T032)
- Developer B: User Story 2 backend (T040–T047) then frontend (T048–T054), since Foundational
  already provides everything US2's backend needs independent of US1's controller code

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests (T004/T006/T008 domain, T018–T023 US1, T033–T039 US2) MUST be written and confirmed failing
  before their corresponding implementation task
- Every last-admin check (T025, T042 indirectly via account-existence) routes through the single
  `libs/domain/auth` predicate — no duplicated logic (research.md #3, Edge Cases)
- Every race-prone mutation (archive/reactivate, cancel/resend, accept) uses a status-guarded
  `UPDATE` with affected-row-count check (research.md #4) — implemented once per repository method
  in Phase 2, reused by both stories
- Commit after each task or logical group
- Stop at either Phase 3 or Phase 4 checkpoint to validate that story independently
