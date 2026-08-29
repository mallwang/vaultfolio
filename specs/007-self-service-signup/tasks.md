---
description: 'Task list for Public Self-Service Sign-Up with Admin Approval (007)'
---

# Tasks: Public Self-Service Sign-Up with Admin Approval

**Input**: Design documents from `/specs/007-self-service-signup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/signups-api.md, quickstart.md

**Tests**: Not explicitly requested in the spec, but this codebase follows TDD/integration-testing
conventions for every service/repository/controller (Constitution III/IV, `invitations.service.spec.ts`
precedent) — test tasks are included per that established practice, mirroring `invitations/`'s
existing spec files.

**Organization**: Tasks are grouped by user story per spec.md (US1 = submit + verify, US2 = admin
review/resolve). Both are P2 and, per the plan, ship together as the two halves of one usable flow —
US1 is still buildable and independently testable first (a request can be submitted and verified
with no admin action taken, per its own Independent Test).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 or US2
- Paths are exact, from plan.md's Project Structure

## Path Conventions (from plan.md)

- Backend: `apps/backend/src/signups/`, `apps/backend/src/shared/`, `apps/backend/src/database/`,
  `apps/backend/src/invitations/` (modified)
- Frontend: `apps/frontend/src/app/signup/` (public), `apps/frontend/src/app/settings/signups/` (admin)
- Shared contracts: `libs/api-contract/src/lib/signups.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared DTOs and schema that both the extracted availability service and the new
`signups/` module depend on.

- [ ] T001 [P] Add `SignupSummary`, `CreateSignupRequest`, `SignupSubmitted`, `RejectSignupRequest`,
      `SignupsErrorResponse` types to new `libs/api-contract/src/lib/signups.ts`, per
      contracts/signups-api.md's Shared DTOs section, and export it from
      `libs/api-contract/src/index.ts`
- [ ] T002 Add `PUBLIC_SIGNUP_ENABLED` (default `true`) and `SIGNUP_EXPIRY_HOURS` (or `_DAYS`,
      mirroring `INVITATION_EXPIRY_DAYS`) entries to `.env.example`, documented alongside the
      existing `SMTP_*`/`APP_BASE_URL`/`INVITATION_EXPIRY_DAYS` vars (research.md #5)

**Checkpoint**: Shared types and config exist; no runtime behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, the extracted `EmailAvailabilityService`, and the `signups/` module
skeleton — these block both user stories since US1 (submission) and US2 (admin queue) both read/
write the same tables through the same availability check.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `migrateSignups()` to `apps/backend/src/database/database.service.ts`, creating the
      `signup_requests` table (id, email, password_hash, token, status CHECK
      PENDING/VERIFIED/APPROVED/REJECTED, created_at, expires_at, verified_at, resolved_at,
      resolved_by FK → users.id) and the `email_blacklist` table (email PK COLLATE NOCASE, reason,
      created_at, signup_request_id FK → signup_requests.id), plus
      `signup_requests_token_idx` (UNIQUE) and `signup_requests_email_idx` (COLLATE NOCASE)
      indexes, per research.md #3 and data-model.md; call it from the same idempotent
      `PRAGMA table_info` pattern as `migrateAccountsAndInvitations`
- [ ] T004 [P] Integration test for `migrateSignups()` against a real temp-file SQLite (table/index
      existence, CHECK constraint, FK) in `apps/backend/src/database/database.service.spec.ts`
      (extend existing file), mirroring `retention-sweep.service.spec.ts`'s real-DB approach
- [ ] T005 Add `findAllByRole(role)` to `apps/backend/src/auth/users.repository.ts` (needed by
      admin-notification email recipient lookup, research.md #2)
- [ ] T006 Create `apps/backend/src/shared/email-availability.service.ts`: extract
      `InvitationsService.checkEmailAvailable()`'s logic into `EmailAvailabilityService.check(email)`,
      extending the result union with `has_pending_signup` (query `signup_requests` where
      `status IN ('PENDING','VERIFIED')`) and `blacklisted` (query `email_blacklist`), per
      research.md #1's discriminated-union shape; queries `users`, `invitations`, `signup_requests`,
      `email_blacklist` in the order given in data-model.md's "Combined availability lookup"
- [ ] T007 [P] Unit test for `EmailAvailabilityService.check()` covering all five outcomes
      (`available`, `has_account`, `has_pending_invitation`, `has_pending_signup`, `blacklisted`)
      in `apps/backend/src/shared/email-availability.service.spec.ts`
- [ ] T008 Modify `apps/backend/src/invitations/invitations.service.ts`: remove the private
      `checkEmailAvailable` logic, inject `EmailAvailabilityService`, and adapt `create()`/`resend()`
      call sites to the new result union (map `has_pending_signup`/`blacklisted` the same way
      `has_account` was previously handled, since invitations only care about "is this address
      already spoken for" — no new admin-facing distinction requested for 007)
- [ ] T009 Update `apps/backend/src/invitations/invitations.service.spec.ts` and
      `apps/backend/src/invitations/invitations.module.ts` for the `EmailAvailabilityService`
      dependency (provide/mock it); confirm `invitations.controller.spec.ts` still passes unchanged
- [ ] T010 Create `apps/backend/src/signups/signups.repository.ts`: `create()`, `findById()`,
      `findByToken()`, `findAll()`, race-guarded `markVerified()` (`UPDATE ... WHERE status =
    'PENDING' AND expires_at > now`), `markApproved()`/`markRejected()`
      (`UPDATE ... WHERE status = 'VERIFIED'`, affected-row-count check → `already_resolved` on 0
      rows, per data-model.md's state-transition guard), `deleteById()`, plus
      `EmailBlacklistRepository`-equivalent methods (`create`, `deleteByEmail`) on the same file or
      a sibling `email-blacklist.repository.ts` — mirror `invitations.repository.ts`'s
      `UPDATE ... RETURNING *` pattern exactly
- [ ] T011 [P] Integration tests for `SignupsRepository`/blacklist repository against a real
      temp-file SQLite (create, token lookup, guarded status transitions racing to 0-affected-rows,
      delete-cascades-blacklist) in `apps/backend/src/signups/signups.repository.spec.ts`
- [ ] T012 [P] Create `apps/backend/src/signups/email.service.ts` with `sendVerification(to, token)`,
      `sendAdminNotification(adminEmails, email)`, `sendWelcome(to)`, `sendRejection(to)` (never
      includes the reason, FR-009), following the exact lazy-transport-construction pattern of
      `invitations/email.service.ts`
- [ ] T013 Create `apps/backend/src/signups/signups.module.ts` wiring
      `SignupsController`/`SignupsService`/`SignupsRepository`/`email.service.ts`/
      `SignupExpirySweepService`, importing `AuthModule` for `UsersRepository`/`SessionsRepository`
      reuse (mirrors `invitations.module.ts`); register it in `apps/backend/src/app.module.ts`

**Checkpoint**: Schema, shared availability check, and module skeleton exist — both user stories
can now be implemented.

---

## Phase 3: User Story 1 - Visitor submits a sign-up request and verifies their email (Priority: P2) 🎯 MVP

**Goal**: A visitor can submit email+password on a public page and verify via emailed link,
landing the request in `VERIFIED` status with admins notified — no admin action required for this
story's own independent test.

**Independent Test**: Submit a sign-up with a fresh email address, open the verification link, and
confirm the request reaches `VERIFIED` status with no admin action taken (per spec.md).

### Implementation for User Story 1

- [ ] T014 [US1] Create `apps/backend/src/signups/signups.service.ts` `submit(email, password)`:
      validates password via `validatePassword` (`@vaultfolio/domain-auth`), calls
      `EmailAvailabilityService.check()` and rejects non-`available` results uniformly
      (`email_unavailable`, FR-002/SC-004), hashes the password (argon2, matching
      `invitations.service.ts`'s `accept()`), generates a token + `expiresAt`
      (`SIGNUP_EXPIRY_HOURS`/`_DAYS` env var, default per research.md/Assumptions), creates the
      `PENDING` row, sends the verification email, and returns `email_delivery_failed` on send
      failure without rolling back the row (mirrors `InvitationsService.create()`)
- [ ] T015 [US1] Add `lookupByToken(token)` to `SignupsService`: lazy-expires a `PENDING` row past
      `expires_at` (deletes it, frees the address, no residual blacklist — Edge Cases) and
      collapses not-found/wrong-status/expired into one `invalid_token` result, mirroring
      `InvitationsService.lookupByToken()`
- [ ] T016 [US1] Add `verify(token)` to `SignupsService`: re-checks validity atomically via the
      guarded `markVerified()` UPDATE (closing the page-load/submit race per contracts), fetches
      admin emails via `UsersRepository.findAllByRole('ADMIN')`, sends the admin-notification email,
      and returns `email_delivery_failed` (verification itself still committed) on send failure
- [ ] T017 [US1] Add `SignupsController` `@Public() POST /signups` (T014), `@Public() GET
    /signups/token/:token` (T015), `@Public() POST /signups/token/:token/verify` (T016) in
      `apps/backend/src/signups/signups.controller.ts`, mapping results to the exact status
      codes/bodies in contracts/signups-api.md (201/400/409/403/502 for submit; 200/410 for lookup;
      200/410/502 for verify); short-circuit every visitor-facing route to `403 signup_disabled`
      when `PUBLIC_SIGNUP_ENABLED=false`, per contracts.md's module-inert note
- [ ] T018 [P] [US1] Unit tests for `SignupsService.submit/lookupByToken/verify` (all outcomes,
      including the lazy-expiry-on-lookup path) in `apps/backend/src/signups/signups.service.spec.ts`
- [ ] T019 [P] [US1] Controller tests for the three public routes (incl. `signup_disabled` toggle
      behavior) in `apps/backend/src/signups/signups.controller.spec.ts`
- [ ] T020 [US1] Create `apps/backend/src/signups/signup-expiry-sweep.service.ts`
      (`OnModuleInit`, hourly `setInterval(...).unref()`) deleting `PENDING` rows past
      `expires_at`, mirroring `retention-sweep.service.ts` exactly (research.md #4); register in
      `signups.module.ts` (T013)
- [ ] T021 [P] [US1] Unit/integration test for `SignupExpirySweepService.sweep()` against a real
      temp-file SQLite in `apps/backend/src/signups/signup-expiry-sweep.service.spec.ts`
- [ ] T022 [P] [US1] Add `SignupsService` to `apps/frontend/src/app/signup/signup.service.ts`
      wrapping `POST /api/signups`, `GET /api/signups/token/:token`,
      `POST /api/signups/token/:token/verify` (HttpClient, typed with the `libs/api-contract`
      DTOs from T001)
- [ ] T023 [US1] Create public sign-up form page in `apps/frontend/src/app/signup/signup.component.ts`
      (+ `.html`/`.css`): email+password fields, password-policy validation reusing the existing
      pattern from the invite-accept page, submit → success/`email_unavailable`/`signup_disabled`/
      `email_delivery_failed` states
- [ ] T024 [US1] Create verify-link landing page in
      `apps/frontend/src/app/signup/verify/verify.component.ts` (+ `.html`/`.css`): on load, calls
      `GET /api/signups/token/:token`; on confirm/auto, calls the verify POST; renders
      success/"link no longer valid" (410) states — no app shell, mirroring
      `invite/accept`/`invite/expired`'s shell-less rendering
- [ ] T025 [US1] Register `signup` (public form) and `signup/verify/:token` routes in
      `apps/frontend/src/app/app.routes.ts`, no `authGuard`, and add both to the route-based
      shell-toggle list in `app.ts` alongside `invite/*` (per the routes-file doc comment)

**Checkpoint**: User Story 1 fully functional and independently testable — a fresh sign-up can be
submitted and verified end-to-end with zero admin involvement.

---

## Phase 4: User Story 2 - Administrator reviews and resolves sign-up requests (Priority: P2)

**Goal**: Admins see verified requests in a dedicated queue and approve (creates account, sends
welcome email) or reject (sends rejection email, blacklists address, no reason exposed) each one,
with resolved/unverified requests refusing a second resolution.

**Independent Test**: Approve one verified request and confirm sign-in works; reject a second and
confirm resubmission is blocked until the admin deletes the rejected entry (per spec.md).

### Implementation for User Story 2

- [ ] T026 [US2] Add `list()` to `SignupsService` returning all `signup_requests` rows mapped to
      `SignupSummary` (all statuses, audit history — mirrors `InvitationsService.list()`)
- [ ] T027 [US2] Add `approve(id, adminId)` to `SignupsService`: `not_found` if missing,
      `not_verified` if not `VERIFIED` (FR-012), guarded `markApproved()` → `already_resolved` on
      0 affected rows (FR-008, concurrent-admin edge case), creates an `ACTIVE`/`MEMBER` `users` row
      via `UsersRepository.create()` (mirroring `InvitationsService.accept()`'s account creation,
      minus session issuance — admin is not the new user), sends the welcome email, returns
      `email_delivery_failed` on send failure (account still created)
- [ ] T028 [US2] Add `reject(id, adminId, reason?)` to `SignupsService`: same
      not_found/not_verified/already_resolved guards as `approve`, guarded `markRejected()`,
      creates the `email_blacklist` row (email, reason, `signup_request_id`) in the same
      transaction as the status transition, sends the rejection email with no reason text (FR-009),
      returns `email_delivery_failed` on send failure (rejection+blacklist still committed)
- [ ] T029 [US2] Add `delete(id)` to `SignupsService`: `not_found` if missing; if the row's status
      is `REJECTED`, delete its `email_blacklist` row (freeing the address, FR-011) then the
      `signup_requests` row; otherwise just delete the row (nothing to clear, per data-model.md's
      Lifecycle section)
- [ ] T030 [US2] Add `@Roles('ADMIN')` routes to `SignupsController`: `GET /signups` (T026),
      `POST /signups/:id/approve` (T027), `POST /signups/:id/reject` (T028),
      `DELETE /signups/:id` (T029) — status codes/bodies exactly per contracts/signups-api.md
      (200/404/400/409/502 for approve/reject; 200/404 for delete); these remain available
      regardless of `PUBLIC_SIGNUP_ENABLED` (quickstart.md's Toggle check)
- [ ] T031 [P] [US2] Unit tests for `SignupsService.list/approve/reject/delete` (all outcomes incl.
      the concurrent-resolution race and delete-clears-blacklist-only-when-rejected cases) in
      `apps/backend/src/signups/signups.service.spec.ts` (extend T018's file)
- [ ] T032 [P] [US2] Controller tests for the four admin routes in
      `apps/backend/src/signups/signups.controller.spec.ts` (extend T019's file)
- [ ] T033 [P] [US2] Add `SignupsAdminService` methods to
      `apps/frontend/src/app/settings/signups/signups.service.ts` wrapping the four admin
      endpoints (mirrors `settings/invitations/invitations.service.ts`)
- [ ] T034 [US2] Create admin sign-up queue table in
      `apps/frontend/src/app/settings/signups/signups.component.ts` (+ `.html`/`.css`): lists
      email/status/submission date (FR-005), approve/reject (with optional-reason prompt)/delete
      row actions gated by status (only `VERIFIED` rows show approve/reject, per FR-012), mirroring
      `settings/invitations/invitations.component.ts`'s table+action-row shape
- [ ] T035 [US2] Register `app-signups` as a new `p-tab`/`p-tabpanel` ("Sign-ups") in
      `apps/frontend/src/app/settings/settings.component.ts`/`.html`, alongside the existing
      "Invitations" tab

**Checkpoint**: Both user stories complete — the full submit → verify → approve/reject flow works
end-to-end, matching quickstart.md Story 2.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation and doc alignment across both stories.

- [ ] T036 [P] Run quickstart.md's full walkthrough (Story 1, Story 2, expiry path, concurrency
      check, toggle check) against a local dev stack with a test SMTP catcher; fix any deviation
      found
- [ ] T037 [P] Update `apps/backend/src/app.module.ts` doc comment / root `README.md` (if either
      enumerates feature modules) to list `signups/`, matching how `invitations/`/`accounts/` are
      already documented
- [ ] T038 Run `npm exec nx affected -t lint test build` (or `npm exec nx run-many -t lint test
    build` for backend/frontend/api-contract) and fix any failures across all touched projects

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (needs `signups.ts` DTOs and env vars in place).
  BLOCKS both user stories — schema, `EmailAvailabilityService`, and module wiring are shared.
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on Phase 2. Reads/writes rows created in US1 for its
  Independent Test, but its own code (approve/reject/delete/list) has no compile-time dependency
  on US1's files — both can be built in parallel by different people once Phase 2 is done.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each User Story

- Service methods before controller routes before frontend pages (T014→T016→T017→T022→T025;
  T026→T029→T030→T033→T035).
- Tests for a story's service/controller can be written alongside or just after each method
  (marked [P] where they touch a distinct spec file from the implementation task).

### Parallel Opportunities

- T001/T002 in parallel (Setup).
- T004, T007 in parallel with each other once T003/T006 land (different spec files).
- T011, T012 in parallel (different files) once T010 lands.
- Within US1: T018/T019/T021/T022 are all [P] (distinct spec/service files) once their
  corresponding implementation tasks land.
- Within US2: T031/T032/T033 are all [P].
- Once Phase 2 (Foundational) is done, US1 and US2 backend work (T014-T021 vs. T026-T032) can
  proceed in parallel on different branches/by different developers, since neither reads the
  other's new files (US2 only needs the `signups_requests`/`email_blacklist` schema and
  `SignupsRepository` from Phase 2).

---

## Parallel Example: User Story 1

```bash
# After T014-T017 (service + controller) land:
Task: "Unit tests for SignupsService.submit/lookupByToken/verify in apps/backend/src/signups/signups.service.spec.ts"
Task: "Controller tests for the three public routes in apps/backend/src/signups/signups.controller.spec.ts"
Task: "Unit/integration test for SignupExpirySweepService.sweep() in apps/backend/src/signups/signup-expiry-sweep.service.spec.ts"
Task: "Add SignupsService (frontend) in apps/frontend/src/app/signup/signup.service.ts"
```

## Parallel Example: User Story 2

```bash
# After T026-T030 (service + controller) land:
Task: "Unit tests for SignupsService.list/approve/reject/delete in apps/backend/src/signups/signups.service.spec.ts"
Task: "Controller tests for the four admin routes in apps/backend/src/signups/signups.controller.spec.ts"
Task: "Add SignupsAdminService (frontend) in apps/frontend/src/app/settings/signups/signups.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema, `EmailAvailabilityService`, module skeleton — blocks
   everything).
3. Complete Phase 3: User Story 1 (submit + verify).
4. **STOP and VALIDATE**: run User Story 1's Independent Test — submit, verify, confirm no admin
   action was needed.
5. Note: per spec.md, US1 alone is not a shippable/safe feature on its own (approval is "the gate
   that makes public sign-up safe to offer at all") — treat this as an internal validation
   checkpoint, not a standalone deploy.

### Incremental Delivery

1. Setup + Foundational → shared foundation ready.
2. Add User Story 1 → validate independently (submission/verification works).
3. Add User Story 2 → validate independently (approve/reject/delete works) → full feature is now
   safe to enable (`PUBLIC_SIGNUP_ENABLED=true`) in a real deployment.
4. Polish → quickstart.md full walkthrough, lint/test/build across affected projects.

### Parallel Team Strategy

With two developers after Foundational is done:

- Developer A: User Story 1 (T014-T025).
- Developer B: User Story 2 (T026-T035) — can start immediately since it only depends on Phase 2's
  schema/repository, not on US1's controller/frontend code; needs at least one `VERIFIED` row
  (seeded directly in tests) to exercise approve/reject before US1's real submit-flow exists.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Commit after each task or logical group (per this repo's existing hook-driven commit cadence).
- Verify tests fail before implementing, where a test task precedes its implementation task in the
  same story (T018/T019/T021 are listed after their implementation counterparts here since this
  codebase's precedent, `invitations.service.spec.ts`, was written test-alongside rather than
  strictly test-first — follow whichever order the assigned developer prefers, as tests are not
  spec-mandated for this feature).
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
