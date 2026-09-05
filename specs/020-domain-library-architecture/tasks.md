---
description: 'Task list for Domain Library Architecture (020)'
---

# Tasks: Domain Library Architecture

**Input**: Design documents from `/specs/020-domain-library-architecture/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md),
[research.md](research.md), [contracts/module-boundaries.md](contracts/module-boundaries.md),
[contracts/domain-access.md](contracts/domain-access.md), [quickstart.md](quickstart.md)

**Tests**: Not explicitly requested for holdings itself (its existing tests move unchanged, per
plan.md's Testing note). Constitution Principle IV requires an integration test for the new
`PATCH /accounts/:id/domain-scopes` contract and unit-test coverage for the new boolean
`isDomainEntitled` logic — both are included below.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to US1/US2/US3
- File paths are exact, relative to the repo root

## Path Conventions

Nx monorepo (per plan.md's Project Structure):

- `apps/frontend/src/app/` (Angular app-shell)
- `apps/backend/src/` (NestJS)
- `libs/frontend/domain/holdings/` (NEW — `@vaultfolio/frontend-domain-holdings`, `scope:frontend-domain`)
- `libs/frontend/domain-access/` (NEW — `@vaultfolio/frontend-domain-access`, `scope:shared`)
- `libs/api-contract/src/lib/` (shared DTOs)

---

## Phase 1: Setup

**Purpose**: Bring the two new libraries into existence as empty, correctly-tagged, correctly-resolvable
Nx projects before any real code moves into them.

- [x] T001 Add `libs/frontend/*` and `libs/frontend/domain/*` to the `workspaces` array in
      package.json (plan.md's Structure Decision)
- [x] T002 [P] Scaffold `libs/frontend/domain/holdings` as an Nx TS project: `package.json` (name
      `@vaultfolio/frontend-domain-holdings`, `"nx": { "tags": ["scope:frontend-domain"] }`,
      `"exports"` restricted to `"."` and `"./package.json"` per
      [contracts/module-boundaries.md](contracts/module-boundaries.md) guarantee 5),
      `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.cts` (mirror
      `libs/domain/example`'s files), and an empty `src/index.ts`
- [x] T003 [P] Scaffold `libs/frontend/domain-access` as an Nx TS project the same way: `package.json`
      (name `@vaultfolio/frontend-domain-access`, tag `scope:shared`, same restricted `"exports"`),
      `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.cts`, empty `src/index.ts`

**Checkpoint**: `npm install` resolves both new packages; `npx nx show projects` lists both.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The boundary rule and the entitlement mechanism itself — every user story either
verifies against this rule or consumes this mechanism.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add the `scope:frontend-domain` `depConstraints` entries to the
      `@nx/enforce-module-boundaries` block in eslint.config.mjs: a new rule for `sourceTag:
'scope:frontend-domain'` with `onlyDependOnLibsWithTags: ['scope:shared']` (deliberately excluding
      `scope:frontend-domain` itself), and add `'scope:frontend-domain'` to the existing
      `scope:frontend` rule's `onlyDependOnLibsWithTags` array (
      [contracts/module-boundaries.md](contracts/module-boundaries.md))
- [x] T005 [P] Add a nullable `domain_scopes TEXT` column to the `CREATE TABLE IF NOT EXISTS users`
      statement in apps/backend/src/database/database.service.ts, defaulted so existing rows read as
      `'["holdings"]'` (FR-009, data-model.md)
- [x] T006 [P] Add `domainScopes: string[]` to the `User`/`UserRow` interfaces in
      apps/backend/src/auth/users.repository.ts, wire it through `rowToUser()`, and add an
      `updateDomainScopes(id: string, domainScopes: string[]): Promise<User | null>` method
      (mirrors `updateRole`)
- [x] T007 [P] Add `domainScopes: string[]` to the `SessionUser` interface in
      libs/api-contract/src/lib/auth.ts
- [x] T008 [P] Add `domainScopes: string[]` to the `AccountSummary` interface in
      libs/api-contract/src/lib/accounts.ts
- [x] T009 Update `toSessionUser()` in apps/backend/src/auth/auth.service.ts to populate
      `domainScopes` from the user row (decode `domain_scopes` JSON; malformed/absent → `[]`, fail
      closed per data-model.md's Validation rules)
- [x] T010 Implement `libs/frontend/domain-access/src/lib/domain-registry.ts` (`DomainDescriptor`
      interface + `DOMAIN_REGISTRY: DomainDescriptor[]` with one `holdings` entry: `{ id:
'holdings', labelKey: 'nav.holdings', path: 'holdings', icon: 'briefcase' }`),
      `libs/frontend/domain-access/src/lib/is-domain-entitled.ts` (`isDomainEntitled(user:
SessionUser | null, domainId: string): boolean` — `false` for `null`, `true` for `role ===
'ADMIN'`, else membership in `domainScopes`), and
      `libs/frontend/domain-access/src/lib/domain.guard.ts` (`domainGuard(domainId: string):
CanActivateFn`, modeled on `apps/frontend/src/app/auth/admin.guard.ts`, redirecting to
      `/app/dashboard` when not entitled); export all three from `src/index.ts`
      ([contracts/domain-access.md](contracts/domain-access.md))
- [x] T011 [P] Unit tests for `isDomainEntitled()` in
      libs/frontend/domain-access/src/lib/is-domain-entitled.spec.ts covering: `user === null` →
      `false`; `role === 'ADMIN'` with empty `domainScopes` → `true`; `domainId` present in
      `domainScopes` → `true`; `domainId` absent → `false`

**Checkpoint**: `npx nx test frontend-domain-access` passes; `npx nx build backend` typechecks with
the new `domainScopes` fields threaded through.

---

## Phase 3: User Story 1 - Boundary between domains is enforced, not just assumed (Priority: P1) 🎯

**Goal**: A cross-domain internal import fails the lint/build step; intra-domain and
shell→domain-public-API imports keep working.

**Independent Test**: Add a throwaway `scope:frontend-domain` library, import a non-exported file
from `libs/frontend/domain/holdings/src/lib/...` into it, run its lint target, and confirm failure;
remove the throwaway library afterward.

### Implementation for User Story 1

- [x] T012 [US1] Run `npx nx run-many -t lint` and confirm the workspace still passes clean with the
      T004 `depConstraints` additions in place (no existing project violates the new rules)
- [ ] T013 [US1] Per [quickstart.md](quickstart.md) #1: scaffold a throwaway `scope:frontend-domain`
      library, add an import of a non-exported file from
      `libs/frontend/domain/holdings/src/lib/...` (available once T015 in Phase 4 has moved holdings'
      code — see Dependencies), run `npx nx lint <throwaway>`, confirm it fails with an
      `@nx/enforce-module-boundaries` error, then delete the throwaway library
- [ ] T014 [US1] Confirm (by inspection of eslint.config.mjs) that `apps/frontend`
      (`scope:frontend`) is allowed to depend on `scope:frontend-domain` (Acceptance Scenario 3) and
      that no `depConstraints` entry restricts imports within a single project (Acceptance Scenario 2)

**Checkpoint**: The boundary rule is proven to hold in both directions (blocks cross-domain, allows
shell→domain and intra-domain) — this is the structural guarantee every future domain relies on.

---

## Phase 4: User Story 2 - Holdings becomes the first domain, without breaking today's functionality (Priority: P1) 🎯 MVP

**Goal**: Holdings' existing feature code lives inside `libs/frontend/domain/holdings`, routed to via
its public entry point and guarded by `domainGuard('holdings')`, with zero behavior change.

**Independent Test**: Exercise every existing holdings flow (create/edit/delete a holding, import,
view the distribution-by-type chart) after the retrofit and confirm behavior is unchanged.

### Implementation for User Story 2

- [x] T015 [US2] Move `apps/frontend/src/app/holdings/holdings.component.{ts,html,css,spec.ts}`,
      `asset-type-fields.ts`, `holdings.service.ts`, `holding-form/**`, and
      `holdings-distribution/**` into `libs/frontend/domain/holdings/src/lib/`, preserving their
      relative folder structure
- [x] T016 [US2] Fix up the moved files' relative imports (e.g. `../../shared/icon/...`,
      `../../core/i18n/translate.pipe`, `../../auth/current-user.store`) so they resolve correctly
      from the new library location; imports of `@vaultfolio/api-contract` and other package-scoped
      libraries are unaffected
- [x] T017 [US2] Create `libs/frontend/domain/holdings/src/index.ts` exporting the public entry
      point (`HoldingsComponent`, and any types the app-shell route needs), matching the `"exports"`
      restriction from T002
- [x] T018 [US2] Update the `holdings` route in apps/frontend/src/app/app.routes.ts to
      `loadComponent: () => import('@vaultfolio/frontend-domain-holdings').then((m) =>
m.HoldingsComponent)` and add `canActivate: [domainGuard('holdings')]` (importing `domainGuard`
      from `@vaultfolio/frontend-domain-access`), per FR-005
- [x] T019 [US2] Add `domainId: 'holdings'` to the `holdings` entry in
      apps/frontend/src/app/core/layout/application-areas.ts, and add the optional `domainId?:
string` field to the `ApplicationArea` interface
- [x] T020 [US2] Delete the now-empty `apps/frontend/src/app/holdings/` directory
- [x] T021 [US2] Run `npx nx test frontend-domain-holdings` (or the project name the `@nx/js`
      inference assigns) and confirm every moved holdings unit/component test passes unchanged
- [x] T022 [US2] Run `npx nx lint frontend-domain-holdings` and `npx nx lint frontend` and confirm
      both pass (the real domain library satisfies the boundary it now sits behind — Acceptance
      Scenario 3, US1)
- [ ] T023 [US2] Per [quickstart.md](quickstart.md) #2: manually verify, signed in as an existing
      user with prior holdings access, that viewing the holdings list, the distribution-by-type
      chart, creating/editing/deleting a holding, and running a CSV/JSON import at `/app/imports` all
      behave identically to before the retrofit

**Checkpoint**: Holdings is fully functional from its new library location; User Stories 1 and 2
both hold together.

---

## Phase 5: User Story 3 - Who can see a domain is decided in one place (Priority: P2)

**Goal**: The sidebar nav filter and the route guard both consult `isDomainEntitled`; an admin can
grant/revoke a user's `holdings` scope from the existing Accounts screen and see both change
together.

**Independent Test**: Change a test user's domain access via the admin Accounts screen and confirm
both the navigation entry and the route guard's behavior change together, for holdings.

### Implementation for User Story 3

- [x] T024 [US3] Update the `areas` computed in
      apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.ts to also filter out an
      area when it has a `domainId` and `isDomainEntitled(currentUserStore.current(),
area.domainId)` is `false`, alongside the existing `roles` filter (FR-006)
- [x] T025 [US3] Add `PATCH /accounts/:id/domain-scopes` to
      apps/backend/src/accounts/accounts.controller.ts, mirroring the existing `:id/role` route
      (`@Roles('ADMIN')`, same `NOT_FOUND`/response-shape conventions)
- [x] T026 [US3] Add `changeDomainScopes(actorId: string, id: string, domainScopes: string[])` to
      apps/backend/src/accounts/accounts.service.ts: reject any id not present in the known domain-id
      set (mirroring `DOMAIN_REGISTRY`'s ids, per data-model.md's Validation rules), otherwise call
      `users.updateDomainScopes()` and return the updated `AccountSummary`
- [x] T027 [P] [US3] Add `ChangeDomainScopesRequest { domainScopes: string[] }` and an
      `invalid_domain` variant on `AccountsErrorResponse` in libs/api-contract/src/lib/accounts.ts
- [x] T028 [P] [US3] Add an integration test for `PATCH /accounts/:id/domain-scopes` in
      apps/backend/src/accounts/accounts.controller.spec.ts covering: success (valid domain ids
      persisted and returned), and rejection of an unknown domain id (Principle IV)
- [x] T029 [US3] Add an `updateDomainScopes(id: string, body: ChangeDomainScopesRequest):
Observable<AccountSummary>` method to apps/frontend/src/app/admin/accounts/accounts.service.ts,
      calling `PATCH ${baseUrl}/${id}/domain-scopes`
- [x] T030 [US3] Extend apps/frontend/src/app/admin/accounts/accounts.component.ts and
      accounts.component.html with a multi-select control (driven by `DOMAIN_REGISTRY` from
      `@vaultfolio/frontend-domain-access`) for each account's domain scopes, calling
      `updateDomainScopes()` on change and refetching the list on success (matching the existing
      `changeRole` pattern)
- [ ] T031 [US3] Per [quickstart.md](quickstart.md) #3: as an Administrator, revoke `holdings` from
      a non-admin test account via Accounts; confirm that user's next session shows no Holdings nav
      entry and `/app/holdings` redirects away; re-grant it and confirm both return together; confirm
      an Administrator account keeps Holdings access throughout regardless of its own `domainScopes`
      (FR-008)

**Checkpoint**: All three user stories are independently functional; nav visibility and route access
never diverge for the same user/domain pair.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the structure generalizes and nothing regressed workspace-wide.

- [x] T032 [P] Confirm by inspection (SC-004, [quickstart.md](quickstart.md) #4) that adding a next
      domain requires only: one new `libs/frontend/domain/<name>` library, one new
      `DOMAIN_REGISTRY` entry, and one new route using `domainGuard('<name>')` — no change to
      holdings' code, tests, or deploy path
- [x] T033 Run `npx nx run-many -t lint test build` across the whole workspace and confirm no
      regressions (SC-002, SC-005)
- [ ] T034 Execute the full [quickstart.md](quickstart.md) validation end-to-end as a final sign-off

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T003) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational; T013 additionally depends on holdings'
  real code existing in the library (Phase 4's T015), since the throwaway-import test needs a real
  internal file to attempt importing — sequence Phase 4's move before running T013, even though both
  phases are nominally parallel-eligible
- **User Story 2 (Phase 4)**: Depends on Foundational (T004's boundary rule, T010's `domainGuard`)
- **User Story 3 (Phase 5)**: Depends on Foundational (T010's `isDomainEntitled`/`DOMAIN_REGISTRY`)
  and on User Story 2 (T019's `domainId` on the holdings `ApplicationArea`, T018's route) existing —
  matches spec.md's stated dependency ("depends on User Stories 1–2 existing first")
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Phase 4: move code (T015–T017) → wire routing/nav (T018–T019) → cleanup (T020) → verify
  (T021–T023)
- Phase 5: entitlement consumer (T024) → backend endpoint (T025–T028, T027/T028 parallel) →
  frontend wiring (T029–T030) → manual verification (T031)

### Parallel Opportunities

- T002 and T003 (Setup) — different libraries
- T005, T006, T007, T008 (Foundational) — different files
- T011 alongside T012–T014 once T010 lands
- T027 and T028 (US3) — different files

---

## Parallel Example: Foundational Phase

```bash
# Launch together once T001–T004 (Setup + boundary rule) are done:
Task: "Add domain_scopes column in apps/backend/src/database/database.service.ts"
Task: "Add domainScopes to User/UserRow + updateDomainScopes() in apps/backend/src/auth/users.repository.ts"
Task: "Add domainScopes to SessionUser in libs/api-contract/src/lib/auth.ts"
Task: "Add domainScopes to AccountSummary in libs/api-contract/src/lib/accounts.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (boundary enforcement proven)
4. Complete Phase 4: User Story 2 (holdings retrofitted, zero regressions)
5. **STOP and VALIDATE**: holdings works exactly as before, from its new library, behind the new
   boundary — this alone is deployable and de-risks the highest-priority, highest-risk step
6. Deploy/demo if ready — User Story 3 (centralized entitlements) can follow as its own increment

### Incremental Delivery

1. Setup + Foundational → boundary rule and entitlement mechanism exist
2. User Story 1 → boundary provably holds (still zero real domains moved yet, but the throwaway-lib
   test needs Phase 4's move — see Dependencies)
3. User Story 2 → holdings retrofitted and gated by `domainGuard('holdings')` → MVP
4. User Story 3 → nav + admin UI centralize entitlement, on top of MVP
5. Polish → generalization check + full-workspace regression pass

---

## Notes

- [P] tasks = different files, no dependencies
- Holdings' existing tests move with its code (T015) and are not rewritten — Constitution Principle
  IV's new integration-test requirement applies only to the new `PATCH
/accounts/:id/domain-scopes` contract (T028) and the new boolean `isDomainEntitled` logic (T011)
- Commit after each task or logical group
- Stop at the Phase 4 checkpoint to validate the MVP independently before starting Phase 5
