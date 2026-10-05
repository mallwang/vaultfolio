---
description: 'Task list for 039 Insurances Management'
---

# Tasks: Versicherungen (Insurances Management)

**Input**: Design documents from `/specs/039-insurances-management/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/insurances-api.md, contracts/insurances-lib.md, research.md, quickstart.md, design.md
**Tests**: Included. The plan and constitution (Principles III/IV) require exact-decimal, table-driven date and backend e2e tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1..US6 (maps to spec.md user stories)

## Path Conventions

Nx monorepo: `libs/insurances/` (new, pure domain), `apps/backend/src/insurances/`, `libs/frontend/domain/insurances/src/lib/`, `libs/api-contract/`, `libs/notifications/`.

---

## Phase 1: Setup

- [x] T001 Amend `.specify/memory/constitution.md` to 3.11.0: add Insurances bullet to Product Scope, name it under the sensitive-personal-data rules, relax the contract-number rule, extend the data-origin rule to name the server-side derivation from Earnings (see plan Complexity Tracking)
- [x] T002 Generate Nx lib `@vaultfolio/insurances` (scope:shared, no framework deps) in `libs/insurances/` (package.json, project.json, tsconfig, jest config, `src/index.ts`); run `npm install` at root so the workspace symlink exists
- [x] T003 [P] Add `INSURANCES_ENCRYPTION_KEY` to `.env.example`, `docker-compose.yml`, `docker-compose.portainer.yml` (same pattern as the other domain keys; do not read `.env`)
- [x] T004 [P] Declare `echarts` in `libs/frontend/domain/insurances/package.json` (as Earnings/Wealth do)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T005 [P] Define model types (Contract, Money, Interval, Settings, Profile, SocialKind, CancellationInfo) in `libs/insurances/src/lib/model.ts`
- [x] T006 [P] Implement catalog (INSURANCE_TYPES with group, classification, detailFields, usuallyIncludedIn; REQUIREMENTS with appliesWhen/satisfiedBy; `typeDef`) in `libs/insurances/src/lib/catalog.ts`
- [x] T007 Implement strict whitelist validation (`validateContract`, `validateSettings`, error codes REQUIRED/INVALID/UNKNOWN_FIELD/OUT_OF_RANGE/DATE_ORDER/LIMIT, FR-002, FR-003, FR-018) in `libs/insurances/src/lib/validation.ts`
- [x] T008 [P] Write catalog tests (ids stable, classifications per data-model) in `libs/insurances/src/lib/catalog.spec.ts`
- [x] T009 [P] Write validation tests (whitelist, negative premium, end before start, paymentMonth only non-monthly, 29.02./30.02. fixedDate, alsoCovers rules, social types monthly only, detail keys per type) in `libs/insurances/src/lib/validation.spec.ts`
- [x] T010 [P] Add DTO types (`InsuranceContract`, `InsuranceSettings`, `LinkedSocialLine`, `InsurancesData`) in `libs/api-contract/src/lib/insurances.ts` and export from the lib index
- [x] T011 Add `insurance_contracts`, `insurance_settings`, `insurance_reminder_log` (idempotent `CREATE TABLE IF NOT EXISTS`, owner index) in `apps/backend/src/database/database.service.ts`
- [x] T012 [P] Create `insurances-crypto.service.ts` (AES-256-GCM `v1:` payload, AAD `table|id|owner`, key version) and `insurances.exceptions.ts` in `apps/backend/src/insurances/`
- [x] T013 [P] Create `insurances-available.guard.ts` (503 `INSURANCES_UNAVAILABLE` when key missing/invalid/mismatched) in `apps/backend/src/insurances/`
- [x] T014 Create `insurances.repository.ts` (owner-scoped CRUD for contracts, settings, reminder log; 200-contract limit; delete-all) in `apps/backend/src/insurances/`
- [x] T015 Create `insurances.module.ts` and register in `apps/backend/src/app/app.module.ts`; wire account deletion cleanup in `apps/backend/src/auth/users.repository.ts`
- [x] T016 [P] Add OpenAPI DTO classes in `apps/backend/src/openapi/dto/insurances.ts`
- [x] T017 [P] Add `libs/frontend/shared-ui/src/lib/i18n/translations/insurances.de.ts`, `insurances.en.ts` (base keys; extended per story) and `insurances-translations.spec.ts` (de/en key parity)

**Checkpoint**: foundation ready.

---

## Phase 3: User Story 1 - Record and manage contracts (P1) MVP

**Goal**: CRUD of insurance contracts, owner-private, with monthly/yearly equivalent in the list.
**Independent Test**: create a household contract with yearly premium, reopen, see it with correct data, edit premium, delete; other user never sees it.

### Tests

- [x] T018 [P] [US1] Premium normalization tests (all intervals, exact decimals, payment months, active-in-period) in `libs/insurances/src/lib/premium.spec.ts`
- [x] T019 [P] [US1] Backend e2e helpers in `apps/backend/src/tests/insurances-e2e.helpers.ts`
- [x] T020 [US1] Backend e2e: create/read/update/delete, whitelist rejection, validation errors, 200 limit, owner isolation, 404 for foreign id, 503 without key, ciphertext at rest in `apps/backend/src/tests/insurances.e2e-spec.ts`

### Implementation

- [x] T021 [P] [US1] Implement `paymentsPerYear`, `yearlyCost`, `monthlyCost`, `paymentMonths`, `isActiveIn` in `libs/insurances/src/lib/premium.ts`
- [x] T022 [US1] Implement `insurances.service.ts` (GET data with `today`, POST/PUT/DELETE contracts, delete-all, validation via lib) in `apps/backend/src/insurances/`
- [x] T023 [US1] Implement `insurances.controller.ts` (`GET /insurances`, `POST|PUT|DELETE /insurances/contracts`, `DELETE /insurances`, `@RequiresDomain('insurances')`, guard) in `apps/backend/src/insurances/`
- [x] T024 [US1] Add `@Api...` decorators on the controller and DTOs, then run `npx nx run backend:openapi` and commit regenerated `api/openapi.yml`
- [x] T025 [P] [US1] Add Bruno requests in `api/bruno/insurances/`
- [x] T026 [US1] Implement frontend `insurances.service.ts` (HTTP via api-contract types) in `libs/frontend/domain/insurances/src/lib/`
- [x] T027 [US1] Replace placeholder with `insurances-area/` (toolbar, tabs Übersicht/Verträge/Lückencheck, available guard, unavailable state) in `libs/frontend/domain/insurances/src/lib/insurances-area/`; update route in `apps/frontend/src/app/app.routes.ts`
- [x] T028 [US1] Implement `contract-form/` (catalog picker grouped by area with classification tag, premium, interval, payment month, cancellation fields, type-specific details, alsoCovers, notes, validation messages) in `libs/frontend/domain/insurances/src/lib/contract-form/`
- [x] T029 [US1] Implement `contracts/` table (name/insurer/key detail, classification tag, premium with interval, per month, edit/delete, status handling, empty-state hook) in `libs/frontend/domain/insurances/src/lib/contracts/`
- [x] T030 [P] [US1] Add i18n keys (de/en) for area, form, list and validation messages in the insurances translation files
- [x] T031 [US1] Add `data-testid`s per `docs/frontend/testid-conventions.md` for new interactive elements; component specs for form and table
- [x] T032 [US1] Verify in the running app with `verify-ui` (create, edit, deactivate, delete contract)

**Checkpoint**: US1 independently functional.

---

## Phase 4: User Story 2 - Cost overview and charts (P1)

**Goal**: KPIs, cost by group, month-by-month payment timeline.
**Independent Test**: three contracts with different intervals match hand-calculated totals; empty state when none.

- [x] T033 [P] [US2] Summary tests (monthly/yearly totals, private vs statutory, by group shares, timeline per year, empty) in `libs/insurances/src/lib/summary.spec.ts`
- [x] T034 [US2] Implement `summarize` (totals, byGroup, timeline[12], upcoming placeholder wired by US3) in `libs/insurances/src/lib/summary.ts`
- [x] T035 [P] [US2] ECharts option builders (donut by group, monthly payments bar) with specs in `libs/frontend/domain/insurances/src/lib/charts/insurances-charts.ts`
- [x] T036 [US2] Implement `overview/` (four KPI tiles, donut and timeline panels, year filter, social-insurance toggle, empty state with CTAs) in `libs/frontend/domain/insurances/src/lib/overview/`
- [x] T037 [P] [US2] Add i18n keys (de/en) for overview, charts and empty state
- [x] T038 [US2] Verify overview and dark theme with `verify-ui`

---

## Phase 5: User Story 3 - Cancellation deadlines (P1)

**Goal**: derived next cancellation date, highlighting, upcoming-deadlines section.
**Independent Test**: 3-month period and term end 31 Dec gives 30 Sep; highlight within window.

- [x] T039 [P] [US3] Table-driven deadline tests (month-end clamping, leap day, fixed 30.11., renewal after passed deadline, ended, open-ended, weeks vs months) in `libs/insurances/src/lib/deadline.spec.ts`
- [x] T040 [US3] Implement `nextCancellationDate` (DEADLINE/ENDS/ANYTIME/NONE) in `libs/insurances/src/lib/deadline.ts`
- [x] T041 [US3] Fill `upcoming` (id, name, date, daysLeft, withinWindow) in `libs/insurances/src/lib/summary.ts`
- [x] T042 [US3] Show next cancellation column and highlight in `contracts/`; live derived summary in `contract-form/`; upcoming-deadlines panel and "next deadline" KPI in `overview/`; filters (group, status, classification) and sorting (premium, next cancellation) per FR-009
- [x] T043 [P] [US3] Add i18n keys (de/en) for deadline states and filters
- [x] T044 [US3] Verify deadline display and highlighting with `verify-ui`

---

## Phase 6: User Story 4 - Reminder emails (P2)

**Goal**: toggleable, deduplicated deadline reminder emails in the user's language.
**Independent Test**: lead time 30 days, deadline in 20 days gives exactly one email; disabled gives none.

- [x] T045 [P] [US4] Add `'insurance-deadline-reminder'` type in `libs/notifications/src/lib/types.ts` and de/en subject/html/text templates in `libs/notifications/src/lib/templates/insurance-deadline-reminder/` (view model `{ typeLabel, contractName, deadlineDate, areaUrl }`, no amounts/insurer/number); template specs
- [x] T046 [P] [US4] Settings validation tests (reminders enabled/leadDays 7..120, dismissals ≤ 50) in `libs/insurances/src/lib/validation.spec.ts`
- [x] T047 [US4] Add `PUT /insurances/settings` to controller/service/repository; update `@Api...` decorators and regenerate `api/openapi.yml` via `npx nx run backend:openapi`; add Bruno request
- [x] T048 [US4] Implement `insurances-reminder.service.ts` (hourly `setInterval` sweep, dedup via `insurance_reminder_log`, skip inactive/deleted/disabled, user language, stub-mailer friendly; log ids/counts only) in `apps/backend/src/insurances/`; clear log rows of changed deadlines on PUT contract
- [x] T049 [US4] Backend e2e: one email per contract+deadline, none when disabled globally or per contract, none for inactive, new reminder after renewal, language, restart-safe dedup in `apps/backend/src/tests/insurances.e2e-spec.ts`
- [x] T050 [US4] Implement `reminders/` view (global switch default off, lead-time select default 30, per-contract switches) in `libs/frontend/domain/insurances/src/lib/reminders/` and bell column in `contracts/`
- [x] T051 [P] [US4] Add i18n keys (de/en) for reminders
- [x] T052 [US4] Verify reminders view with `verify-ui`

---

## Phase 7: User Story 5 - Social insurances linked to Earnings (P2)

**Goal**: read-only statutory lines from Earnings with manual fallback and no double counting.
**Independent Test**: with payslips the four statutory lines show "from Earnings"; without, manual entry works.

- [x] T053 [P] [US5] Social tests (latest period, regular part only, suppression by active manual contract) in `libs/insurances/src/lib/social.spec.ts`
- [x] T054 [US5] Implement `linkedLinesFromEarnings` and `effectiveSocialLines` in `libs/insurances/src/lib/social.ts`; include linked lines and `includeSocial` in `summarize`
- [x] T055 [US5] Export `EarningsService` from `apps/backend/src/earnings/earnings.module.ts`; implement `insurances-linked-social.service.ts` (only if caller entitled to `earnings` and Earnings key available; nothing stored) in `apps/backend/src/insurances/`; include `linkedSocial` in `GET /insurances`
- [x] T056 [US5] Backend e2e: linked lines with and without Earnings data/access, update after newer payslip, manual override suppresses linked line, no double counting in `apps/backend/src/tests/insurances.e2e-spec.ts`
- [x] T057 [US5] Show linked rows in `contracts/` (green-tinted, read-only, source tag "aus Einkommen MM/YYYY", no deadline/reminder) plus manual-override action and info note
- [x] T058 [P] [US5] Add i18n keys (de/en) for linked rows and source tags
- [x] T059 [US5] Verify linked rows with synthetic Earnings data via `verify-ui`

---

## Phase 8: User Story 6 - Gap check (P2)

**Goal**: profile-based missing/covered/redundant/dismissed report as general guidance.
**Independent Test**: owns property without natural-hazard contract is reported missing; adding it turns covered.

- [x] T060 [P] [US6] Gap tests per profile combination (owner/no car/pets/self-employed), combination products via alsoCovers/usuallyIncludedIn, OPTIONAL never missing, dismissals, redundancy in `libs/insurances/src/lib/gap-check.spec.ts`
- [x] T061 [US6] Implement `checkGaps` in `libs/insurances/src/lib/gap-check.ts`
- [x] T062 [US6] Implement `gap-check/` (profile switches and employment, missing with explanation and classification tag, covered, redundant, dismissed with restore; guidance-not-advice note) in `libs/frontend/domain/insurances/src/lib/gap-check/`; add gap summary panel to `overview/` and "Kombi-Überschneidung" tag in `contracts/`
- [x] T063 [P] [US6] Add i18n keys (de/en) for gap check texts and explanations
- [x] T064 [US6] Verify gap check with `verify-ui`

---

## Phase 9: Polish & Cross-Cutting

- [x] T065 [P] Replace dashboard placeholder with `insurances-dashboard-widget/` and update `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` (FR-017)
- [x] T066 [P] Implement real `insurances-export.definition.ts` (replaces disabled placeholder) and update `apps/frontend/src/app/export/feature-export.registry.ts` with spec
- [x] T067 Backend e2e: delete-all removes contracts, settings and reminder-log rows; account deletion cleanup in `apps/backend/src/tests/insurances.e2e-spec.ts`
- [x] T068 [P] Remove the placeholder component and disabled export definition from `libs/frontend/domain/insurances/`
- [x] T069 [P] Update `README.md`, `README.de.md`, `docs/user-guide.md`, `docs/user-guide.de.md` (feature, `INSURANCES_ENCRYPTION_KEY`, reminders, linked lines, guidance disclaimer) and `docs/frontend/testid-conventions.md` if needed
- [ ] T070 Run `npx nx run backend:openapi:check`, lint, typecheck, and tests for `insurances`, `backend`, `api-contract`, `notifications`, frontend insurances; run the coverage audit (>= 80 % per project)
- [ ] T071 Run the quickstart.md validation end to end (including SC-001..SC-007 spot checks) and a final `verify-ui` pass in light and dark theme

---

## Dependencies & Execution Order

- Phase 1 then Phase 2 (blocks all stories). T001 first.
- US1 (Phase 3) is the MVP and provides the backend CRUD and UI shell used by later stories.
- US2 depends on US1 (premium lib, area shell). US3 depends on US1 and extends US2's `summarize`/`overview`.
- US4 depends on US1 and US3 (deadline derivation). US5 depends on US1 and US2 (summary). US6 depends on US1 (catalog, contracts); independent of US3-US5 apart from `overview/` panel.
- Polish after all desired stories.

## Parallel Examples

- Phase 2: T005, T006, T008, T009, T010, T012, T013, T016, T017 in parallel after T002.
- US1: T018, T019, T021, T025, T030 in parallel; backend (T022-T024) and frontend (T026-T029) proceed in parallel once T010 and T023 contracts exist.
- US2/US3/US6 lib work (T033/T039/T060) can run in parallel by different developers.

## Implementation Strategy

- **MVP**: Phases 1-3 (US1): contracts CRUD end to end.
- **Incremental**: add US2 and US3 (all P1), validate, then US4, US5, US6 (P2) in any order, then Polish.
- Every backend controller/DTO change is followed by `npx nx run backend:openapi` and a committed `api/openapi.yml`.
