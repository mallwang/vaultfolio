---
description: 'Task list template for feature implementation'
---

# Tasks: Data Export (Per-Feature and Full Account)

**Input**: Design documents from `/specs/029-export-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/export-lib.md, quickstart.md

**Tests**: Included — plan.md's Constitution Check (Principles III/IV) explicitly commits to
exact-value and real-serialized-format tests for this feature; quickstart.md's "Automated coverage"
section enumerates them.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- `libs/export/` — new Nx library, `scope:shared`, framework-agnostic generation logic
- `libs/frontend/shared-ui/src/lib/export-control/` — new Angular export split-button control
- `libs/frontend/shared-ui/src/lib/i18n/translations/{en,de}.ts` — shared translation dictionaries
- `libs/frontend/domain/{holdings,account-overview,retirement,insurances,haushaltsplaner,historic-wealth-development}/src/lib/` — per-domain registration files
- `apps/frontend/src/app/export/feature-export.registry.ts` — app-level contribution wiring (mirrors `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`)
- `apps/frontend/src/app/settings/profile/` — "Export my data" wiring

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new library and dependencies

- [ ] T001 Generate `libs/export` Nx library (`scope:shared` tag, alongside `libs/api-contract`, per plan.md Structure Decision) with `project.json`/`tsconfig` boilerplate
- [ ] T002 [P] Add `exceljs`, `pdfmake`, `jszip` runtime dependencies to `apps/frontend/package.json` and the root `package.json` (per project memory: declare runtime deps in the app's own package.json too)
- [ ] T003 [P] Configure Jest (`jsdom` environment) for `libs/export` in `libs/export/jest.config.ts`, and Nx module-boundary lint tags so `libs/export` cannot import Angular/`@angular/*`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared generation library, registry, and Angular export control that every user
story (single-feature export, per-feature reuse, full export) depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Define shared contract types (`ExportFormat`, `ExportColumn`, `ExportRow`, `FeatureExportDefinition`) per `contracts/export-lib.md` in `libs/export/src/lib/feature-export-definition.ts`
- [ ] T005 Implement `FeatureExportRegistry` class (`register`/`getAll`/`getById`; `register` throws on duplicate `featureId`) in `libs/export/src/lib/feature-export-registry.ts`
- [ ] T006 [P] Implement JSON exporter (`FeatureExportDefinition` + rows → JSON bytes) in `libs/export/src/lib/json-exporter.ts`
- [ ] T007 [P] Implement RFC 4180 CSV exporter (comma/quote/newline escaping, decimal-string passthrough) in `libs/export/src/lib/csv-exporter.ts`
- [ ] T008 [P] Implement XLSX exporter using `exceljs` (typed columns: text/number/decimal/date, decimal strings converted to numeric cells only at serialization) in `libs/export/src/lib/xlsx-exporter.ts`
- [ ] T009 [P] Implement PDF exporter using `pdfmake` (infobox + chart images + data table, per `design.md` layout) in `libs/export/src/lib/pdf-exporter.ts`
- [ ] T010 Implement `exportFeature(definition, format, chartImages?)` dispatcher per `contracts/export-lib.md` in `libs/export/src/lib/export-feature.ts` (depends on T006-T009)
- [ ] T011 [P] Export public API barrel (`ExportFormat`, `ExportColumn`, `FeatureExportDefinition`, `FeatureExportRegistry`, `exportFeature`) in `libs/export/src/index.ts`
- [ ] T012 [P] Unit tests for json-exporter (0 rows and several rows, exact decimal-string round-trip per Principle III) in `libs/export/src/lib/json-exporter.spec.ts`
- [ ] T013 [P] Unit tests for csv-exporter (RFC 4180 escaping incl. commas/quotes/newlines, decimal round-trip, 0 rows) in `libs/export/src/lib/csv-exporter.spec.ts`
- [ ] T014 [P] Unit tests for xlsx-exporter, reading the real bytes back via `exceljs` (typed cells, decimal round-trip, 0 rows → header-only) in `libs/export/src/lib/xlsx-exporter.spec.ts`
- [ ] T015 [P] Unit tests for pdf-exporter (infobox text present, table content, empty-table case) in `libs/export/src/lib/pdf-exporter.spec.ts`
- [ ] T016 [P] Unit tests for feature-export-registry (duplicate `featureId` throws, `getAll`/`getById`) in `libs/export/src/lib/feature-export-registry.spec.ts`
- [ ] T017 Create export-control Angular component skeleton (split-button + format menu, `severity` input, per `contracts/export-lib.md`'s `<app-export-control>` API) in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.ts` and `.html`
- [ ] T018 Implement chart-image capture seam (off-screen unattached `echarts.init`, fed an `EChartsOption`, `getDataURL({type:'png',pixelRatio:2})`, `dispose()`) as an injectable function in `libs/frontend/shared-ui/src/lib/export-control/chart-image-capture.ts`
- [ ] T019 Wire export-control component to look up its `FeatureExportDefinition` from the app-wide registry, resolve `titleKey`/`infoboxKey`/column `labelKey`s via `TranslateService`, capture chart images when `getChartOptions` is present, call `exportFeature`, and trigger the browser download (`<featureId>.<ext>`) in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.ts` (depends on T010, T017, T018)
- [ ] T020 [P] Unit tests for export-control component (menu opens with JSON/CSV/XLSX/PDF items, mocked `fetchData`/chart-capture, download triggered per format) in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.spec.ts`
- [ ] T021 [P] Add shared i18n keys (export menu labels, format names, generic "no data" hints) to `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`
- [ ] T022 Create the app-level `FeatureExportRegistry` provider and contribution wiring point (mirrors `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`), starting with an empty contributions list, in `apps/frontend/src/app/export/feature-export.registry.ts`

**Checkpoint**: Foundation ready — `libs/export`, the export-control component, and the app-level
registry all exist; user story work can now begin

---

## Phase 3: User Story 1 - Export holdings in a single format (Priority: P1) 🎯 MVP

**Goal**: A user on Holdings can export their holdings as JSON, CSV, Excel, or PDF (with charts +
infobox), in their own language, including the empty-data case

**Independent Test**: Open Holdings, choose each format in turn, verify each downloaded file opens
and contains the user's current holdings data (PDF additionally shows charts + infobox)

### Implementation for User Story 1

- [ ] T023 [US1] Define Holdings `FeatureExportDefinition` (`featureId: 'holdings'`, `titleKey`, `infoboxKey`, `columns` covering every field in the Holdings table, `fetchData` via the existing `HoldingsService` API call, `getChartOptions` sourced from the distribution chart) in `libs/frontend/domain/holdings/src/lib/holdings-export.definition.ts`
- [ ] T024 [P] [US1] Add Holdings export i18n keys — `titleKey`, `infoboxKey` text reused from `docs/user-guide.md` §4, and column `labelKey`s — to `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`
- [ ] T025 [US1] Expose the current `EChartsOption` from `HoldingsDistributionComponent` as a small seam reusable by the off-screen capture (research.md §3) in `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts`
- [ ] T026 [US1] Register the Holdings definition in `apps/frontend/src/app/export/feature-export.registry.ts` (depends on T022, T023)
- [ ] T027 [US1] Add `<app-export-control featureId="holdings" severity="info" />` immediately left of the "Add holding" action in `libs/frontend/domain/holdings/src/lib/holdings.component.html` (and import in `holdings.component.ts`)
- [ ] T028 [P] [US1] Unit test asserting `holdings-export.definition`'s `columns` cover every field visible in the Holdings table/detail view (FR-007, SC-002) in `libs/frontend/domain/holdings/src/lib/holdings-export.definition.spec.ts`
- [ ] T029 [P] [US1] Component test: Holdings page renders the Export control in the correct position/severity, left of "Add holding" in `libs/frontend/domain/holdings/src/lib/holdings.component.spec.ts`
- [ ] T030 [US1] Verify via the `verify-ui` skill: quickstart.md US1 steps 1-8 (JSON/CSV/XLSX/PDF downloads, empty-account case, German language switch)

**Checkpoint**: User Story 1 fully functional and independently testable/shippable

---

## Phase 4: User Story 2 - Same export control on every data-holding feature (Priority: P2)

**Goal**: Account Overview, Retirement, Insurances, Haushaltsplaner, and Wealth Development each
present the same Export control, scoped to their own (possibly still-empty) data

**Independent Test**: Open each of the five features, confirm the Export control appears in the
same relative position with the same behavior, and confirm downloaded files carry that feature's
own data and infobox text

### Implementation for User Story 2

- [ ] T031 [US2] Define Account Overview `FeatureExportDefinition` (`featureId: 'account-overview'`, real `fetchData`, columns covering every on-screen field) in `libs/frontend/domain/account-overview/src/lib/account-overview-export.definition.ts`
- [ ] T032 [P] [US2] Add Account Overview export i18n keys (infobox text reused from `docs/user-guide.md` §5) to `en.ts`/`de.ts`
- [ ] T033 [US2] Register the Account Overview definition in `feature-export.registry.ts` and add `<app-export-control featureId="account-overview" severity="info" />` next to its "Add account" action in `libs/frontend/domain/account-overview/src/lib/account-overview-page/`
- [ ] T034 [P] [US2] Unit test for Account Overview export column coverage + component test for control position, in `account-overview-export.definition.spec.ts` and the account-overview page's `.spec.ts`
- [ ] T035 [P] [US2] Define Retirement `FeatureExportDefinition` (empty `fetchData`, no `getChartOptions`, per research.md §5) in `libs/frontend/domain/retirement/src/lib/retirement-export.definition.ts`
- [ ] T036 [P] [US2] Define Insurances `FeatureExportDefinition` (empty) in `libs/frontend/domain/insurances/src/lib/insurances-export.definition.ts`
- [ ] T037 [P] [US2] Define Haushaltsplaner `FeatureExportDefinition` (empty) in `libs/frontend/domain/haushaltsplaner/src/lib/haushaltsplaner-export.definition.ts`
- [ ] T038 [P] [US2] Define Historic Wealth Development `FeatureExportDefinition` (empty) in `libs/frontend/domain/historic-wealth-development/src/lib/historic-wealth-development-export.definition.ts`
- [ ] T039 [P] [US2] Add i18n keys (title + freshly-written infobox text, matching user-guide style) for the 4 placeholder domains to `en.ts`/`de.ts`
- [ ] T040 [US2] Register the 4 placeholder definitions in `feature-export.registry.ts` and add `<app-export-control severity="info" />` to each placeholder panel's top-right anchor (per research.md §5) in `libs/frontend/domain/{retirement,insurances,haushaltsplaner,historic-wealth-development}/src/lib/*-placeholder/` (depends T035-T038)
- [ ] T041 [P] [US2] Unit tests: each of the 4 placeholder export definitions produces a valid, empty-but-structured export (FR-014) via `exportFeature`, one spec per domain
- [ ] T042 [US2] Verify via the `verify-ui` skill: quickstart.md US2 steps (control position on all 5 pages, PDF infobox names the right feature, valid empty exports on the 4 placeholders)

**Checkpoint**: All 6 features present the Export control; Holdings and Account Overview export
real data, the 4 placeholders export valid-but-empty data

---

## Phase 5: User Story 3 - Export everything in one download (Priority: P3)

**Goal**: "Export my data (optional)" in Account Settings produces one ZIP with every feature's
exports in every format, extensible with no changes when a new feature registers

**Independent Test**: Click "Export my data (optional)", verify the downloaded archive contains one
subdirectory per feature with that feature's JSON/CSV/XLSX/PDF files, reflecting real data where it
exists

### Implementation for User Story 3

- [ ] T043 [US3] Implement `exportAll(registry, resolveChartImages)` full-export archive assembly per `contracts/export-lib.md` (iterates `registry.getAll()`, builds `<featureId>/<featureId>.<ext>` entries via `jszip`, catches a single format's failure per feature into `failures[]` without stopping the rest, per FR-015) in `libs/export/src/lib/full-export-archive.ts`
- [ ] T044 [P] [US3] Unit test: a registry with one throwing definition and several succeeding ones — assert the archive still contains every succeeding file and `failures` lists exactly the one that failed, in `libs/export/src/lib/full-export-archive.spec.ts`
- [ ] T045 [US3] Wire the "Export my data (optional)" button (`data-testid="profile-export-data"`) to call `exportAll` against the app-wide registry and trigger a `vaultfolio-data-export.zip` download, in `apps/frontend/src/app/settings/profile/profile.component.ts` and `.html` (depends on T022, T043)
- [ ] T046 [US3] Surface partial-failure messaging (which feature/format failed, hint to retry from that feature's own Export control, per FR-015/Edge Cases) in `apps/frontend/src/app/settings/profile/profile.component.html`
- [ ] T047 [P] [US3] Component test: clicking "Export my data" triggers `exportAll` and downloads the ZIP; a mocked failure surfaces the failure message, in `apps/frontend/src/app/settings/profile/profile.component.spec.ts`
- [ ] T048 [US3] Verify via the `verify-ui` skill: quickstart.md US3 steps (ZIP structure, one subdirectory per feature, placeholder folders valid-but-empty, real data in `holdings/` and `account-overview/`)

**Checkpoint**: All three user stories functional end-to-end; a newly-registered feature appears in
the full export automatically (FR-012, SC-004)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span all three stories

- [ ] T049 [P] Add `data-testid` attributes to the export split-button and its menu items per `docs/frontend/testid-conventions.md`, across `export-control.component.html` and the profile "Export my data" flow
- [ ] T050 [P] Confirm `libs/export` has zero Angular/DOM/`TranslateService` imports (Principle I framework-independence) via Nx module-boundary lint
- [ ] T051 Manual performance check: single-feature export completes under 5s for a few hundred records (SC-001); full "Export my data" completes under 30s for a typical account (SC-005)
- [ ] T052 [P] Run `speckit-docs-update` review to confirm `docs/user-guide.md` reflects the new Export control and functional "Export my data" action
- [ ] T053 Run full `quickstart.md` validation end-to-end (US1 + US2 + US3 together) via the `verify-ui` skill

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the shared `libs/export`
  library, registry, and export-control component are consumed by every story)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (Holdings) has no dependency on US2/US3
  - US2 (other 5 features) reuses the same export-control/registry as US1 but does not require US1's
    specific tasks to be done first — only Foundational
  - US3 (full export) reuses the registry populated by US1/US2's registrations to be meaningful, but
    `exportAll` itself only depends on Foundational; it is ordered last because an empty registry
    makes it untestable end-to-end until at least Holdings is registered
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories
- **User Story 2 (P2)**: Can start after Foundational — independently testable per feature; benefits
  from US1's registry/control existing but does not require US1's specific Holdings tasks
- **User Story 3 (P3)**: Can start after Foundational — functionally complete once any features are
  registered; fully meaningful once US1 and US2 have registered real/placeholder definitions

### Parallel Opportunities

- Setup tasks T002-T003 in parallel after T001
- Foundational exporters T006-T009 in parallel (different files); their tests T012-T015 in parallel
  once each exporter exists
- Once Foundational completes, US1, US2, and US3 implementation can proceed in parallel by different
  developers, since each touches a disjoint set of domain-library files
- Within US2, the 4 placeholder domain definitions (T035-T038) and their i18n/tests are fully
  parallel (different files, no shared state)

---

## Parallel Example: Foundational Phase

```bash
# Launch the four format exporters together (different files):
Task: "Implement JSON exporter in libs/export/src/lib/json-exporter.ts"
Task: "Implement RFC 4180 CSV exporter in libs/export/src/lib/csv-exporter.ts"
Task: "Implement XLSX exporter using exceljs in libs/export/src/lib/xlsx-exporter.ts"
Task: "Implement PDF exporter using pdfmake in libs/export/src/lib/pdf-exporter.ts"
```

## Parallel Example: User Story 2 placeholder domains

```bash
Task: "Define Retirement FeatureExportDefinition in libs/frontend/domain/retirement/src/lib/retirement-export.definition.ts"
Task: "Define Insurances FeatureExportDefinition in libs/frontend/domain/insurances/src/lib/insurances-export.definition.ts"
Task: "Define Haushaltsplaner FeatureExportDefinition in libs/frontend/domain/haushaltsplaner/src/lib/haushaltsplaner-export.definition.ts"
Task: "Define Historic Wealth Development FeatureExportDefinition in libs/frontend/domain/historic-wealth-development/src/lib/historic-wealth-development-export.definition.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Holdings export)
4. **STOP and VALIDATE**: Run quickstart.md US1 steps via `verify-ui`
5. Deploy/demo if ready — Holdings export alone already delivers the spec's explicitly-requested
   capability

### Incremental Delivery

1. Setup + Foundational → shared export capability ready
2. Add User Story 1 (Holdings) → validate independently → deploy/demo (MVP!)
3. Add User Story 2 (remaining 5 features) → validate each independently → deploy/demo
4. Add User Story 3 (full "Export my data") → validate → deploy/demo
5. Each story adds value without breaking the previous ones — the registry-based design means US2
   and US3 tasks never modify `libs/export`'s generation code itself (FR-008/FR-012)

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: User Story 1 (Holdings)
- Developer B: User Story 2 (Account Overview + 4 placeholders)
- Developer C: User Story 3 (full export + Settings wiring), stubbing against the registry contract
  until A/B's registrations land

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Per Principle III/IV (plan.md Constitution Check), every exporter test asserts exact decimal
  values by parsing the _real_ generated bytes back (CSV parsed, `.xlsx` read via `exceljs`, PDF
  checked for text/structure, ZIP read via `jszip`) — never just the in-memory row objects
- `libs/export` must stay framework-independent (Principle I) — no `TranslateService`/Angular import
  ever lands there; label resolution happens only in the export-control component (contracts/export-lib.md "Language resolution")
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
