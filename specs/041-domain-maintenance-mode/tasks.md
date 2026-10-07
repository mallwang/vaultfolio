---
description: 'Task list for Domain Maintenance Mode'
---

# Tasks: Domain Maintenance Mode

**Input**: Design documents from `/specs/041-domain-maintenance-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/maintenance-api.md, design.md, mockup.html

**Tests**: Included. The plan's Constitution Check (Principles III/IV) requires tests for guard, service, controllers, reminder skip/catch-up, store, gate and components, plus integration tests against a real temp SQLite file.

**Organization**: Tasks are grouped by user story. Backend enforcement (US3) and the admin toggle (US1) are the backbone; UI notice (US2), admin view (US4) and reminders (US5) build on them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1..US5)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contract types used by backend and frontend.

- [ ] T001 Create `libs/api-contract/src/lib/maintenance.ts` with `MAINTENANCE_DOMAIN_IDS` (`holdings`, `retirement`, `insurances`, `haushaltsplaner`, `historic-wealth-development`, `account-overview`, `klaro`, `earnings`), `MaintenanceDomainId`, `DomainMaintenanceStatus`, `DomainMaintenanceListResponse`, `DomainMaintenanceAdminResponse`, `SetDomainMaintenanceRequest` and the `DOMAIN_MAINTENANCE` error code constant; export from `libs/api-contract/src/index.ts`
- [ ] T002 [P] Add a unit test in `libs/frontend/domain-access/src/lib/domain-registry.spec.ts` asserting `MAINTENANCE_DOMAIN_IDS` equals the ids of `DOMAIN_REGISTRY` (research D4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence and the backend service every story depends on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `domain_maintenance` and `domain_maintenance_audit` tables (`CREATE TABLE IF NOT EXISTS`, index on `(domain_id, changed_at)`) to `apps/backend/src/database/database.service.ts` per data-model.md
- [ ] T004 Create `apps/backend/src/maintenance/maintenance.repository.ts` with `isInMaintenance(domainId)`, `listInMaintenance()`, `listAll()` and a transactional `set(domainId, inMaintenance, actorId)` that upserts state and appends one audit row only when the state actually changes
- [ ] T005 Create `apps/backend/src/maintenance/maintenance.exceptions.ts` with `DomainMaintenanceException` (HTTP 503, body `{ error: 'DOMAIN_MAINTENANCE', message, domainId, correlationId }` using the existing structured error shape)
- [ ] T006 Create `apps/backend/src/maintenance/maintenance.service.ts` with `isInMaintenance()`, `listInMaintenance()`, `listForAdmin()` (resolves `updatedBy` to the admin display name) and `set(actor, domainId, inMaintenance)` that rejects unknown ids and logs a structured event (ids only, no personal data)
- [ ] T007 Create `apps/backend/src/maintenance/maintenance.module.ts` exporting `MaintenanceService`; register it in the app module (`apps/backend/src/app.module.ts`)
- [ ] T008 [P] Unit tests for repository and service (state default active, upsert, audit only on real change, unknown id rejected, transactional behaviour) in `apps/backend/src/maintenance/maintenance.repository.spec.ts` and `apps/backend/src/maintenance/maintenance.service.spec.ts` against a temp SQLite file

**Checkpoint**: Maintenance state can be stored, read and audited from the backend.

---

## Phase 3: User Story 1 - Admin puts a domain into maintenance (Priority: P1) MVP

**Goal**: Admins list domains and toggle each into/out of maintenance from a new "Domänen" tab; changes persist and are audited.

**Independent Test**: As admin, open Verwaltung > Domänen, put one domain into maintenance, reload, see "In Wartung"; switch back, see "Aktiv". A non-admin gets 403 on the endpoints.

### Tests for User Story 1

- [ ] T009 [P] [US1] E2E/integration tests for `GET /admin/domains` and `PUT /admin/domains/:domainId` (200, idempotent repeat writes no audit row, 400 bad body, 404 unknown id, 403 non-admin, 401 unauthenticated) in `apps/backend/src/maintenance/maintenance-admin.controller.spec.ts`
- [ ] T010 [P] [US1] Component tests for the Domänen tab (lists all domains with state tag, confirm dialog before toggling, shows last-changed name and time, error handling) in `libs/frontend/admin/src/lib/domains/domains.component.spec.ts`

### Implementation for User Story 1

- [ ] T011 [US1] Create `apps/backend/src/maintenance/maintenance-admin.controller.ts` with `GET /admin/domains` and `PUT /admin/domains/:domainId` restricted to `ADMIN`, validating the body and domain id; register in `maintenance.module.ts`
- [ ] T012 [P] [US1] Create Swagger DTO classes in `apps/backend/src/openapi/dto/maintenance.ts` for `DomainMaintenanceStatus`, admin list response, set request and the shared `503` response; add `@Api...` decorators to `maintenance-admin.controller.ts`
- [ ] T013 [US1] Run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [ ] T014 [P] [US1] Add Bruno requests for `GET /admin/domains` and `PUT /admin/domains/:domainId` under `api/bruno/`
- [ ] T015 [P] [US1] Create `libs/frontend/admin/src/lib/domains/domains.service.ts` (HTTP calls for list and set)
- [ ] T016 [US1] Create `libs/frontend/admin/src/lib/domains/domains.component.ts` (+ template/styles) following design.md and mockup.html: table of domains, state tag, p-toggleswitch with confirm dialog, last-changed column; add `data-testid` attributes per `docs/frontend/testid-conventions.md`
- [ ] T017 [US1] Register the "Domänen" tab and `admin/domains` child route in `libs/frontend/admin/src/lib/admin.component.ts` and `apps/frontend/src/app/app.routes.ts` (admin only), update `libs/frontend/admin/src/lib/admin.component.spec.ts`
- [ ] T018 [P] [US1] Add German and English i18n strings for the tab, states, dialog and errors in the frontend i18n files (locate via `libs/frontend/shared-ui/src/lib/i18n`)

**Checkpoint**: Admins can toggle and see persisted domain states.

---

## Phase 4: User Story 3 - API rejects member requests during maintenance (Priority: P1)

**Goal**: Every `@RequiresDomain` route returns `503 DOMAIN_MAINTENANCE` to entitled non-admins while the domain is in maintenance; admins and other domains are unaffected.

**Independent Test**: With a domain in maintenance, member read/write/export requests return 503 with the maintenance body; admin requests succeed; other domains return 200.

### Tests for User Story 3

- [ ] T019 [P] [US3] Unit tests for the extended guard (401 unchanged, 403 before 503, member 503, admin passes, other domain passes, active domain passes) in `apps/backend/src/auth/domain.guard.spec.ts`
- [ ] T020 [P] [US3] Integration test with real temp SQLite exercising a domain controller read, write and export route for member vs admin and an unaffected second domain in `apps/backend/src/maintenance/maintenance-enforcement.e2e.spec.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Extend `apps/backend/src/auth/domain.guard.ts`: after the entitlement check passes, if the `@RequiresDomain` id is in maintenance and the caller is not `ADMIN`, throw `DomainMaintenanceException` (inject `MaintenanceService`, import `MaintenanceModule` where the guard is provided)
- [ ] T022 [US3] Create `apps/backend/src/maintenance/maintenance.controller.ts` with `GET /domains/maintenance` (any signed-in user) returning `{ domains: string[] }`; register in `maintenance.module.ts`; add controller test `apps/backend/src/maintenance/maintenance.controller.spec.ts`
- [ ] T023 [US3] Add `@Api...` decorators (including the shared `503` response on domain controllers) and DTOs for `GET /domains/maintenance` in `apps/backend/src/openapi/dto/maintenance.ts` and its controller, then re-run `npx nx run backend:openapi` and commit `api/openapi.yml`
- [ ] T024 [P] [US3] Add Bruno request for `GET /domains/maintenance` under `api/bruno/`

**Checkpoint**: Server-side blocking works independent of any UI.

---

## Phase 5: User Story 2 - Member sees maintenance notice (Priority: P1)

**Goal**: Members keep the nav item (with wrench marker), see an orange centered notice on the domain page and an orange maintenance text on the dashboard tile.

**Independent Test**: Put a domain into maintenance; as an entitled member verify nav item visible with marker, tile shows maintenance text, domain page shows the notice; a non-entitled domain stays hidden.

### Tests for User Story 2

- [ ] T025 [P] [US2] Tests for `DomainMaintenanceStore` (loads once, `refresh()`, `isInMaintenance()`) in `apps/frontend/src/app/core/maintenance/domain-maintenance.store.spec.ts`
- [ ] T026 [P] [US2] Tests for `DomainMaintenanceGateComponent` (member sees notice, no outlet) in `apps/frontend/src/app/core/maintenance/domain-maintenance-gate.component.spec.ts`
- [ ] T027 [P] [US2] Tests for `MaintenanceNoticeComponent` and `MaintenanceTileComponent` in `libs/frontend/shared-ui/src/lib/maintenance/*.spec.ts`
- [ ] T028 [P] [US2] Extend `apps/frontend/src/app/core/http-error.interceptor.spec.ts` for the 503 `DOMAIN_MAINTENANCE` refresh behaviour and `apps/frontend/src/app/dashboard/dashboard.component.spec.ts` for the tile swap

### Implementation for User Story 2

- [ ] T029 [P] [US2] Create `libs/frontend/shared-ui/src/lib/maintenance/maintenance-notice.component.ts` (centered orange notice with icon, translated, `data-testid`) and export from the shared-ui index
- [ ] T030 [P] [US2] Create `libs/frontend/shared-ui/src/lib/maintenance/maintenance-tile.component.ts` (orange "Wartungsarbeiten" tile text, optional admin badge mode) and export from the shared-ui index
- [ ] T031 [P] [US2] Add `DOMAIN_MAINTENANCE_SOURCE` injection token and `isDomainInMaintenance()` helper in `libs/frontend/domain-access/src/lib/` (same pattern as `current-user-source.token.ts`) and export from the domain-access index
- [ ] T032 [US2] Create `apps/frontend/src/app/core/maintenance/domain-maintenance.store.ts` (signals; loads `GET /domains/maintenance` with the session on page load; provides the token from T031; no polling)
- [ ] T033 [US2] Create `apps/frontend/src/app/core/maintenance/domain-maintenance-gate.component.ts` (route data `domainId`; member in maintenance renders the notice, otherwise the router outlet) and wrap each domain route in `apps/frontend/src/app/app.routes.ts`
- [ ] T034 [US2] Add the wrench marker to maintained domain nav items (item stays visible, entitlement still decides visibility) in `apps/frontend/src/app/core/layout/app-sidebar/`
- [ ] T035 [US2] In `apps/frontend/src/app/dashboard/dashboard.component.ts`/`.html` render `MaintenanceTileComponent` instead of the domain widget for members when the domain is in maintenance (widget not loaded)
- [ ] T036 [US2] Update `apps/frontend/src/app/core/http-error.interceptor.ts` so a 503 with `error: 'DOMAIN_MAINTENANCE'` refreshes `DomainMaintenanceStore` and is not shown as a generic error
- [ ] T037 [P] [US2] Add German and English i18n strings for notice, tile and nav marker (shared-ui i18n files)

**Checkpoint**: Members get a clear, consistent maintenance experience.

---

## Phase 6: User Story 4 - Admin keeps working during maintenance (Priority: P2)

**Goal**: Admins still use the domain, with a banner on the page and a badge on the tile.

**Independent Test**: With a domain in maintenance, open it as admin: regular content plus orange banner; dashboard tile shows content plus badge.

- [ ] T038 [US4] Extend `domain-maintenance-gate.component.ts` to render an admin banner above the outlet (reusing `MaintenanceNoticeComponent` in banner mode) and extend its spec `domain-maintenance-gate.component.spec.ts`
- [ ] T039 [US4] In `apps/frontend/src/app/dashboard/dashboard.component.ts`/`.html` keep the widget for admins and render the maintenance badge via `MaintenanceTileComponent` badge mode; extend `dashboard.component.spec.ts`
- [ ] T040 [P] [US4] Add German and English i18n strings for the admin banner and badge

**Checkpoint**: Admins can reproduce and fix problems during maintenance.

---

## Phase 7: User Story 5 - Reminder emails pause and catch up (Priority: P2)

**Goal**: No insurance reminder mails during maintenance; skipped but still relevant reminders go out once afterwards.

**Independent Test**: Sweep during maintenance sends nothing and writes no log row; after maintenance one sweep sends exactly one mail; past deadlines are never sent.

- [ ] T041 [P] [US5] Integration tests with real temp SQLite for skip during maintenance, exactly-once catch-up after, no send after the deadline passed, and other domains unaffected in `apps/backend/src/insurances/insurances-reminder.service.spec.ts`
- [ ] T042 [US5] Update `apps/backend/src/insurances/insurances-reminder.service.ts` `sweep` to return early while `MaintenanceService.isInMaintenance('insurances')`; import `MaintenanceModule` in the insurances module

**Checkpoint**: Reminder behaviour matches FR-014/FR-015 without extra state.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Add data-preservation assertion (row counts of domain tables identical before/after a maintenance window) to `apps/backend/src/maintenance/maintenance-enforcement.e2e.spec.ts`
- [ ] T044 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` (Administration > Domänen) and `docs/development.md` if API/guard behaviour needs documenting
- [ ] T045 Run `npx nx run-many -t lint test typecheck` for affected projects and `npx nx run backend:openapi:check`; fix findings
- [ ] T046 Verify the UI with the `verify-ui` skill following quickstart.md sections 1, 2 and 4
- [ ] T047 Walk through quickstart.md sections 3, 5 and 6 (API block, data/audit, reminders)

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> user stories. T003 -> T004 -> T006 -> T007; T005 before T006.
- US1 (Phase 3) and US3 (Phase 4) both need Phase 2 and share `maintenance.module.ts`; do T011 before T022 to avoid module edit conflicts. US1 backend (T011-T014) is enough to demo the toggle; US3 T021 is the enforcement.
- US2 (Phase 5) needs T022 (member list endpoint) and T031/T032; T033-T036 need T029-T032.
- US4 (Phase 6) depends on US2 components (T029, T030, T033, T035).
- US5 (Phase 7) needs only Phase 2 and can run in parallel with Phases 3-6.
- Polish last.

## Parallel Opportunities

- Phase 2: T008 alongside T006/T007 once repository exists.
- US1: T009, T010, T012, T014, T015, T018 in parallel after T011 contract is fixed.
- US3: T019, T020 in parallel; T024 independent.
- US2: T025-T028 in parallel; T029, T030, T031, T037 in parallel.
- US5 can be done by a second developer concurrently with US1/US2.

## Implementation Strategy

**MVP**: Phase 1, Phase 2, US1 (toggle) plus US3 (server enforcement) gives a working, safe maintenance switch (admin can toggle, members are blocked). Then US2 for the member UX, followed by US4 and US5 incrementally; validate each checkpoint with the quickstart steps.
