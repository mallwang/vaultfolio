---
description: 'Task list for Profile, Password & Account Self-Service (008)'
---

# Tasks: Profile, Password & Account Self-Service

**Input**: Design documents from `/specs/008-profile-password-account/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/profile-api.md, quickstart.md

**Tests**: Not explicitly requested in the spec, but per Constitution III/IV this feature touches
security-sensitive deterministic logic (session invalidation, token expiry/purpose isolation,
last-admin reuse, forgot-password timing) that MUST follow test-first practice, and the codebase's
established precedent (`invitations.service.spec.ts`, `signups.service.spec.ts`,
`last-admin.spec.ts`) is to test every service/repository/controller — test tasks are included
throughout.

**Organization**: Tasks are grouped by user story per spec.md. US1 (display name + email change,
P2) and US2 (password change + forgot/reset, P2) are both P2 and independently testable; US1 is
listed first (spec/plan ordering, and it lands the `account_action_tokens`/token-purpose machinery
US2 also depends on). US3 (self-delete, P3) is last.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, or US3
- Paths are exact, from plan.md's Project Structure

## Path Conventions (from plan.md)

- Backend: `apps/backend/src/profile/` (new module), `apps/backend/src/auth/` (extended),
  `apps/backend/src/database/` (extended), `apps/backend/src/accounts/` (reused, unchanged)
- Frontend: `apps/frontend/src/app/settings/profile/` (new sub-tab), `apps/frontend/src/app/account/`
  (new, shell-less), `apps/frontend/src/app/core/layout/app-header/` (extended)
- Shared: `libs/api-contract/src/lib/profile.ts`, `libs/domain/auth/src/lib/account-action-token.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared DTOs and config both the token machinery and the `profile/` module depend on.

- [ ] T001 [P] Add `ProfileSummary`, `UpdateDisplayNameRequest`, `RequestEmailChangeRequest`,
      `ChangePasswordRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`,
      `ProfileErrorResponse` types to new `libs/api-contract/src/lib/profile.ts`, per
      contracts/profile-api.md's Shared DTOs section, and export it from
      `libs/api-contract/src/index.ts`
- [ ] T002 [P] Add `EMAIL_CHANGE_EXPIRY_HOURS` (default `24`) and `PASSWORD_RESET_EXPIRY_HOURS`
      (default `1`) entries to `.env.example`, documented alongside the existing
      `SMTP_*`/`APP_BASE_URL`/`INVITATION_EXPIRY_DAYS` vars (research.md #3)

**Checkpoint**: Shared types and config exist; no runtime behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, the generic token repository/domain helpers, and the `profile/` module
skeleton — both user stories create/consume `account_action_tokens` rows and both need
`ProfileController`/`ProfileService` to exist.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `migrateProfile()` to `apps/backend/src/database/database.service.ts`: idempotent
      `ALTER TABLE users ADD COLUMN pending_email TEXT NULL` (via `PRAGMA table_info` check, per
      006/007's pattern) plus creating the `account_action_tokens` table (`id`, `user_id NOT NULL
REFERENCES users(id)`, `purpose CHECK (purpose IN ('EMAIL_CHANGE','PASSWORD_RESET'))`,
      `new_email`, `token NOT NULL UNIQUE`, `status CHECK (...) DEFAULT 'PENDING'`, `created_at`,
      `expires_at`, `used_at`) and its two indexes (`account_action_tokens_token_idx` UNIQUE,
      `account_action_tokens_user_purpose_idx`), per data-model.md; call it from `onModuleInit`
      alongside the existing `migrate*()` calls
- [ ] T004 [P] Integration test for `migrateProfile()` against a real temp-file SQLite (column/
      table/index existence, `CHECK` constraints, FK) in
      `apps/backend/src/database/database.service.spec.ts` (extend existing file)
- [ ] T005 [P] Create `libs/domain/auth/src/lib/account-action-token.ts`: pure helpers
      `isTokenUsable(status, expiresAt, now)` (PENDING + unexpired) and
      `expiryWindowHours(purpose)` (24 for `EMAIL_CHANGE`, 1 for `PASSWORD_RESET`), sibling to
      `invitation-token.ts`'s pattern; export from `libs/domain/auth/src/index.ts`
- [ ] T006 [P] Unit tests for `isTokenUsable`/`expiryWindowHours` (all status/expiry combinations)
      in `libs/domain/auth/src/lib/account-action-token.spec.ts`
- [ ] T007 Create `apps/backend/src/profile/account-action-tokens.repository.ts`:
      `create({userId, purpose, newEmail?, token, expiresAt})` (supersedes any existing `PENDING`
      row for the same `(user_id, purpose)` to `SUPERSEDED` in the same transaction, research.md
      #3), `findByTokenAndPurpose(token, purpose)`, `findPendingByUserAndPurpose(userId, purpose)`,
      guarded `markUsed(id)` (`UPDATE ... WHERE status = 'PENDING' AND expires_at > now`), guarded
      `markSuperseded(id)` — mirror `invitations.repository.ts`'s `UPDATE ... RETURNING *` pattern
      exactly; lookups always filter by `(token, purpose)` together, never `token` alone
- [ ] T008 [P] Integration tests for `AccountActionTokensRepository` against a real temp-file
      SQLite (create-supersedes-prior-same-purpose-only, token+purpose lookup never cross-matches,
      guarded status transitions racing to 0-affected-rows, expiry-window persisted correctly) in
      `apps/backend/src/profile/account-action-tokens.repository.spec.ts`
- [ ] T009 [P] Add `updateDisplayName(id, displayName)`, `updateEmail(id, email)` (also clears
      `pending_email`), `setPendingEmail(id, pendingEmail)`, `clearPendingEmail(id)`,
      `updatePasswordHash(id, passwordHash)` to `apps/backend/src/auth/users.repository.ts`
- [ ] T010 [P] Unit/integration tests for the five new `UsersRepository` methods in
      `apps/backend/src/auth/users.repository.spec.ts` (extend existing file)
- [ ] T011 [P] Add `deleteAllForUserExcept(userId, exceptSessionId)` to
      `apps/backend/src/auth/sessions.repository.ts` (`DELETE FROM sessions WHERE user_id = $1 AND
id != $2`, research.md #5) — `deleteAllForUser` stays unchanged
- [ ] T012 [P] Integration test for `deleteAllForUserExcept` (excluded session survives, all
      others removed) in `apps/backend/src/auth/sessions.repository.spec.ts` (extend existing file)
- [ ] T013 Create `apps/backend/src/profile/profile.module.ts` wiring
      `ProfileController`/`ProfileService`/`AccountActionTokensRepository`, importing `AuthModule`
      (for `UsersRepository`/`SessionsRepository`) and `AccountsModule` (for
      `AccountsService.deleteSelf`, research.md #1); register it in
      `apps/backend/src/app/app.module.ts`; `ProfileController`/`ProfileService` may start as
      empty shells — filled in by each user story below

**Checkpoint**: Schema, generic token repository, and module skeleton exist — both user stories
can now be implemented.

---

## Phase 3: User Story 1 - Update display name and email (Priority: P2) 🎯 MVP

**Goal**: A signed-in user updates their display name (immediate, reflected in the header with no
reload) and separately requests an email change, verified via a 24h single-use link, with the old
address staying active until confirmed.

**Independent Test**: Change the display name and confirm it updates immediately without a page
reload; separately, request an email change and confirm sign-in still works with the old address
until the new one is verified.

### Implementation for User Story 1

- [ ] T014 [US1] Add `GET /api/profile` handling to `ProfileService`: `getProfile(userId)` maps
      the current user to `ProfileSummary` (including `pendingEmail` via
      `findPendingByUserAndPurpose(userId, 'EMAIL_CHANGE')`, `NULL` if none/expired)
- [ ] T015 [US1] Add `updateDisplayName(userId, displayName)` to `ProfileService`: validates
      1–100 characters (FR-001), rejects before any write with `invalid_display_name`, otherwise
      calls `UsersRepository.updateDisplayName`
- [ ] T016 [US1] Create `apps/backend/src/profile/email.service.ts` with
      `sendEmailChangeVerification(to, newEmail, token)`, following the exact lazy-transport-
      construction pattern of `invitations/email.service.ts`/`signups/email.service.ts`
      (research.md #4 — a deliberate third instance, not shared)
- [ ] T017 [US1] Add `requestEmailChange(userId, newEmail)` to `ProfileService`: calls
      `EmailAvailabilityService.check(newEmail)` and rejects any non-`available` result as
      `email_unavailable` (FR-003, research.md #2); on acceptance, generates a token
      (`randomBytes(32).toString('base64url')`) + `expiresAt` (`EMAIL_CHANGE_EXPIRY_HOURS`),
      creates the `account_action_tokens` row (purpose `EMAIL_CHANGE`, supersedes any prior pending
      one per T007) and sets `users.pending_email` in the same transaction, sends the verification
      email, and returns `email_delivery_failed` on send failure without rolling back the row
      (mirrors `InvitationsService.create()`)
- [ ] T018 [US1] Add `cancelEmailChange(userId)` to `ProfileService`: supersedes the user's pending
      `EMAIL_CHANGE` token (if any) and clears `users.pending_email`; idempotent no-op if nothing
      pending (design.md "Cancel request" banner)
- [ ] T019 [US1] Add `lookupEmailChangeToken(token)` to `ProfileService`: `findByTokenAndPurpose(
token, 'EMAIL_CHANGE')`, collapses not-found/wrong-status/expired into one `invalid_token` result
      (SC-002) via `isTokenUsable` (T005)
- [ ] T020 [US1] Add `confirmEmailChange(token)` to `ProfileService`: re-validates via the guarded
      `markUsed()` UPDATE (closing the page-load/confirm race), then `users.email = pending_email`,
      `users.pending_email = NULL`, all in one transaction (data-model.md); same `invalid_token`
      collapse as the lookup on failure
- [ ] T021 [US1] Create `apps/backend/src/profile/profile.controller.ts` with `GET /api/profile`
      (T014), `PATCH /api/profile/display-name` (T015), `POST /api/profile/email-change` (T017),
      `POST /api/profile/email-change/cancel` (T018), `@Public() GET
/api/profile/email-change/token/:token` (T019), `@Public() POST
/api/profile/email-change/token/:token/confirm` (T020) — no `@Roles()` on any authenticated route
      (research.md #1's gap-closing intent), exact status codes/bodies per
      contracts/profile-api.md
- [ ] T022 [P] [US1] Unit tests for `ProfileService.getProfile/updateDisplayName/
requestEmailChange/cancelEmailChange/lookupEmailChangeToken/confirmEmailChange` (all outcomes,
      including supersede-on-resubmit and expired/used/superseded collapse) in
      `apps/backend/src/profile/profile.service.spec.ts`
- [ ] T023 [P] [US1] Controller tests for the six routes in
      `apps/backend/src/profile/profile.controller.spec.ts`
- [ ] T024 [P] [US1] Create `apps/frontend/src/app/settings/profile/profile.service.ts` wrapping
      `GET /api/profile`, `PATCH /api/profile/display-name`, `POST /api/profile/email-change`,
      `POST /api/profile/email-change/cancel` (HttpClient, typed with the `libs/api-contract` DTOs
      from T001)
- [ ] T025 [US1] Create Profile sub-tab in
      `apps/frontend/src/app/settings/profile/profile.component.ts` (+ `.html`/`.css`): identity/
      display-name card (save → updates `CurrentUserStore` so the header reflects it with no
      reload, FR-004) and email card (current address read-only, "change to" field, `409`/`202`
      states, pending-email `banner--info` with "Cancel request" action per design.md), reusing
      006's mockup CSS custom properties/class names verbatim
- [ ] T026 [US1] Register `app-profile` as the first `p-tab`/`p-tabpanel` ("Profile") in
      `apps/frontend/src/app/settings/settings.component.ts`/`.html`, ahead of the existing
      Accounts/Invitations/Sign-ups tabs (design.md)
- [ ] T027 [US1] Add a `.role-badge` `<span>` bound to `user()?.role` in
      `apps/frontend/src/app/core/layout/app-header/app-header.component.html`/`.ts`, next to the
      existing display-name/avatar (research.md #7, FR-004) — template-only change, no new request
- [ ] T028 [US1] Create verify-email landing page in
      `apps/frontend/src/app/account/verify-email/verify-email.component.ts` (+ `.html`/`.css`):
      on load, calls `GET /api/profile/email-change/token/:token`; on confirm, calls the confirm
      POST; renders success or routes to the shared link-invalid page on `410` — shell-less,
      mirroring `invite/accept`'s rendering
- [ ] T029 [US1] Create shared `apps/frontend/src/app/account/link-invalid/link-invalid.component.ts`
      (+ `.html`/`.css`): one page for expired/used/superseded links of either purpose (design.md
      "Link-invalid page"), shell-less, mirroring `invite/expired`
- [ ] T030 [US1] Register `account/verify-email/:token` and `account/link-invalid` routes in
      `apps/frontend/src/app/app.routes.ts` (no `authGuard`, `@Public()`-backed), and add
      `/account/` to the route-based shell-toggle list in `app.ts` alongside `/invite/`/`/signup`

**Checkpoint**: User Story 1 fully functional and independently testable — display-name updates
reflect immediately with no reload, and an email change can be requested and verified end-to-end
while the old address keeps working.

---

## Phase 4: User Story 2 - Change password / recover a forgotten password (Priority: P2)

**Goal**: A signed-in user changes their password (current-password-gated, invalidating only their
other sessions); a signed-out user requests and uses a password-reset link with a uniform response
regardless of account existence.

**Independent Test**: Change password with the correct current password and confirm other active
sessions are invalidated; separately, request a password reset for an unknown address and confirm
the response is identical to a known one.

### Implementation for User Story 2

- [ ] T031 [US2] Add `sendPasswordReset(to, token)` to `apps/backend/src/profile/email.service.ts`
      (extends T016's file)
- [ ] T032 [US2] Add `changePassword(userId, currentSessionId, currentPassword, newPassword)` to
      `ProfileService`: `argon2.verify(user.passwordHash, currentPassword)` first (mirrors
      `AuthService.signIn`), rejects with `invalid_current_password` (401) on failure; then
      `validatePassword(newPassword)` (`@vaultfolio/domain-auth`, unchanged from 005), rejects
      `invalid_password` (400) on failure; on success, `UsersRepository.updatePasswordHash` then
      `SessionsRepository.deleteAllForUserExcept(userId, currentSessionId)` (research.md #5, FR-005)
- [ ] T033 [US2] Add `requestPasswordReset(email)` to `ProfileService`: always performs the same
      operation shape whether or not `email` matches a user (research.md #6) — on a match,
      generates a token + `expiresAt` (`PASSWORD_RESET_EXPIRY_HOURS`), supersedes any prior pending
      `PASSWORD_RESET` token for that user (T007), sends the reset email (delivery failure logged,
      never surfaced — research.md #6); on no match, performs an equivalent-shaped no-op lookup/
      write of the same depth; always resolves the same way, no exception either branch can throw
      that would produce a distinguishable response
- [ ] T034 [US2] Add `lookupPasswordResetToken(token)` to `ProfileService`:
      `findByTokenAndPurpose(token, 'PASSWORD_RESET')`, same `invalid_token` collapse as T019, no
      email revealed in the response (contracts/profile-api.md)
- [ ] T035 [US2] Add `confirmPasswordReset(token, newPassword)` to `ProfileService`:
      `validatePassword(newPassword)` (400 `invalid_password` on failure, no current-password
      check — the token is proof of ownership), guarded `markUsed()`, `updatePasswordHash`,
      `SessionsRepository.deleteAllForUser(userId)` (no session to spare on this path, research.md
      #5), creates and returns a fresh session (mirrors `AuthService.signIn`'s session-issuance
      shape) so the response can sign the user in
- [ ] T036 [US2] Add `POST /api/profile/password` (T032), `@Public() POST
/api/profile/forgot-password` (T033), `@Public() GET
/api/profile/reset-password/token/:token` (T034), `@Public() POST
/api/profile/reset-password/token/:token/confirm` (T035) to `ProfileController` (extends T021's
      file), setting the session cookie on the confirm route exactly as `AuthController`'s sign-in
      route does; exact status codes/bodies per contracts/profile-api.md
- [ ] T037 [P] [US2] Unit tests for `ProfileService.changePassword/requestPasswordReset/
lookupPasswordResetToken/confirmPasswordReset` in `apps/backend/src/profile/profile.service.spec.ts`
      (extend T022's file), including a response-shape/timing-uniformity assertion for
      `requestPasswordReset` (both branches resolve through the same number of awaited steps)
- [ ] T038 [P] [US2] Controller tests for the four new routes in
      `apps/backend/src/profile/profile.controller.spec.ts` (extend T023's file)
- [ ] T039 [US2] Integration test: two active sessions for one user, password change via session
      A invalidates session B but not session A, in
      `apps/backend/src/profile/profile.service.spec.ts` (real temp-file SQLite, per Constitution
      IV — extends T037's coverage)
- [ ] T040 [US2] Integration test: forgot-password for an existing vs. nonexistent address produces
      byte-identical response bodies (extends T037)
- [ ] T041 [US2] Integration test: a `PASSWORD_RESET` token never satisfies an `EMAIL_CHANGE`
      lookup and vice versa, using rows from both US1's and US2's token creation paths, in
      `apps/backend/src/profile/account-action-tokens.repository.spec.ts` (extends T008)
- [ ] T042 [P] [US2] Add `changePassword`/`requestPasswordReset`/`lookupResetToken`/
      `confirmPasswordReset` methods to `apps/frontend/src/app/settings/profile/profile.service.ts`
      (extends T024's file)
- [ ] T043 [US2] Add password card to `profile.component.ts`/`.html` (extends T025): current/new/
      confirm fields, wrong-current-password `field-error`, shared password-policy hint text
      ("8–200 characters") copied verbatim from the Assumptions section (FR-007, design.md)
- [ ] T044 [US2] Create `apps/frontend/src/app/account/forgot-password/forgot-password.component.ts`
      (+ `.html`/`.css`): email field, submits to `requestPasswordReset`, shows an identical "sent"
      confirmation regardless of outcome (SC-003) — shell-less
- [ ] T045 [US2] Create `apps/frontend/src/app/account/reset-password/reset-password.component.ts`
      (+ `.html`/`.css`): on load, calls `lookupResetToken`; on submit, calls
      `confirmPasswordReset` and, on success, stores the returned session (`CurrentUserStore`) and
      navigates to `/dashboard`; routes to the shared link-invalid page (T029) on `410` — shell-less
- [ ] T046 [US2] Register `account/forgot-password` and `account/reset-password/:token` routes in
      `apps/frontend/src/app/app.routes.ts` (extends T030), no `authGuard`

**Checkpoint**: User Stories 1 AND 2 both work independently — password change/reset and email
change/verification are both fully functional end-to-end.

---

## Phase 5: User Story 3 - Delete own account (Priority: P3)

**Goal**: A signed-in user can permanently delete their own account and its data from a "Danger
Zone", after an optional data-export nudge and an explicit final confirmation, blocked while they
are the sole active administrator.

**Independent Test**: Open the Danger Zone, cancel at the confirmation step and confirm nothing
changed; then complete the flow and confirm the account and its data are gone and the user is
signed out.

### Implementation for User Story 3

- [ ] T047 [US3] Add `deleteAccount(userId)` to `ProfileService`: delegates entirely to
      `AccountsService.deleteSelf(userId, userId)` (research.md #1, no duplicated last-admin
      logic), maps `last_admin`/`deletion_failed`/success straight through
- [ ] T048 [US3] Add `DELETE /api/profile/account` to `ProfileController` (extends T036's file):
      `204` on success, `409 last_admin`, `500 deletion_failed`, per contracts/profile-api.md;
      clears the session cookie on `204` exactly as sign-out does
- [ ] T049 [P] [US3] Unit tests for `ProfileService.deleteAccount` (success, last-admin-blocked,
      delegates-not-duplicates assertion) in `apps/backend/src/profile/profile.service.spec.ts`
      (extend T022's file)
- [ ] T050 [P] [US3] Controller tests for the new route in
      `apps/backend/src/profile/profile.controller.spec.ts` (extend T023's file)
- [ ] T051 [US3] Integration test: a `MEMBER` account (previously blocked by
      `/api/accounts`'s `@Roles('ADMIN')`) can successfully self-delete via
      `DELETE /api/profile/account`, in `apps/backend/src/profile/profile.service.spec.ts` (real
      temp-file SQLite, closes research.md #1's reachability gap) — extends T049
- [ ] T052 [US3] Integration test: sole active admin is blocked (`409`), then succeeds once a
      second admin exists, reusing 006's `canRemoveLastAdmin` fixture pattern — extends T049
- [ ] T053 [P] [US3] Add `deleteAccount()` to `profile.service.ts` (frontend, extends T024/T042)
- [ ] T054 [US3] Add Danger Zone card to `profile.component.ts`/`.html` (extends T025/T043): red-
      tinted `.danger-zone` card with "Export data" (optional, non-blocking) and "Delete Account"
      actions, and a two-step confirm dialog (step 1 advises export without requiring it; step 2 is
      type-to-confirm gating the destructive button); on `409 last_admin`, disables the final step
      and shows the same "sole administrator" messaging pattern as
      `settings/accounts/accounts.component.html`'s last-admin banner; on `500 deletion_failed`,
      shows a `form-alert` inside the dialog and leaves it open; on success, clears
      `CurrentUserStore` and navigates to `/sign-in` (design.md)

**Checkpoint**: All user stories independently functional — the full profile/password/account
self-service surface works end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and doc alignment across all three stories.

- [ ] T055 [P] Run quickstart.md's full walkthrough (Scenarios A, B, C) against a local dev stack
      with a test SMTP catcher; fix any deviation found
- [ ] T056 [P] Update `apps/backend/src/app/app.module.ts` doc comment / root `README.md` (if
      either enumerates feature modules) to list `profile/`, matching how `invitations/`/
      `signups/`/`accounts/` are already documented
- [ ] T057 Run `npm exec nx affected -t lint test build` (or `npm exec nx run-many -t lint test
build` for backend/frontend/api-contract/domain-auth) and fix any failures across all touched
      projects

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (needs `profile.ts` DTOs and env vars in place).
  BLOCKS both user stories — schema, generic token repository, and module wiring are shared.
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2. Reuses T007/T021/T029/T030 (token repository,
  controller file, link-invalid page, routes file) started/created in US1, so build US1 first even
  though the two stories are independently testable once both are done.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and reuses T025/T043's `profile.component.ts` and
  T036's `ProfileController` file — build after US1/US2 for the smallest diff, though its own logic
  (delegates to `AccountsService.deleteSelf`) has no functional dependency on either.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Service methods before controller routes before frontend pages (T014-T020 → T021 → T024-T030;
  T031-T035 → T036 → T042-T046; T047 → T048 → T053-T054).
- Tests for a story's service/controller are listed alongside their implementation task's file
  (marked [P] where they touch a distinct spec file).

### Parallel Opportunities

- T001/T002 in parallel (Setup).
- T004/T005/T006 in parallel once T003 lands; T009/T010, T011/T012 in parallel with the token-
  repository work (T007/T008) — all touch distinct files.
- Within US1: T022/T023/T024 are all [P] once T014-T021 land.
- Within US2: T037/T038/T042 are all [P] once T031-T036 land; T039/T040/T041 are integration tests
  that can run alongside T037 (same file, sequential edits, but conceptually parallel work items).
- Within US3: T049/T050/T053 are all [P] once T047-T048 land.
- T055/T056 in parallel (Polish).

---

## Parallel Example: User Story 1

```bash
# After T014-T021 (service + controller) land:
Task: "Unit tests for ProfileService.getProfile/updateDisplayName/... in apps/backend/src/profile/profile.service.spec.ts"
Task: "Controller tests for the six routes in apps/backend/src/profile/profile.controller.spec.ts"
Task: "Create profile.service.ts (frontend) in apps/frontend/src/app/settings/profile/profile.service.ts"
```

## Parallel Example: User Story 2

```bash
# After T031-T036 (service + controller) land:
Task: "Unit tests for ProfileService.changePassword/requestPasswordReset/... in apps/backend/src/profile/profile.service.spec.ts"
Task: "Controller tests for the four new routes in apps/backend/src/profile/profile.controller.spec.ts"
Task: "Add changePassword/... methods to profile.service.ts (frontend)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema, token repository, module skeleton — blocks everything).
3. Complete Phase 3: User Story 1 (display name + email change).
4. **STOP and VALIDATE**: run User Story 1's Independent Test — display-name reflects immediately,
   email change verifies while the old address stays active.
5. Deploy/demo if ready — basic profile self-service is usable on its own.

### Incremental Delivery

1. Setup + Foundational → shared foundation ready.
2. Add User Story 1 → validate independently → deploy/demo.
3. Add User Story 2 → validate independently → deploy/demo.
4. Add User Story 3 → validate independently → deploy/demo — full feature complete.
5. Polish → quickstart.md full walkthrough, lint/test/build across affected projects.

### Parallel Team Strategy

With multiple developers after Foundational is done:

- Developer A: User Story 1 (T014-T030).
- Developer B: User Story 2 (T031-T046) — can start once T007/T029/T030 (token repository,
  link-invalid page, routes file) exist from US1, working in the same `profile.controller.ts`/
  `profile.component.ts` files as Developer A (coordinate on those two files to avoid conflicts).
- Developer C: User Story 3 (T047-T054) — smallest, can start any time after Foundational; its
  service/controller/frontend additions are appends to files A/B are also touching.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Commit after each task or logical group (per this repo's existing hook-driven commit cadence).
- Verify tests fail before implementing where a test task precedes its implementation task in the
  same story; this codebase's precedent is test-alongside rather than strictly test-first (tests
  are not spec-mandated for this feature, only test-first for the security-sensitive logic called
  out in plan.md's Constitution Check).
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
