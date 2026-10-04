---
description: 'Task list for Vermögensentwicklung (Net-Worth Tracking)'
---

# Tasks: Vermögensentwicklung (Net-Worth Tracking)

**Input**: Design documents from `/specs/038-networth-tracking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wealth-api.md, contracts/wealth-lib.md, design.md, mockup.html, quickstart.md

**Tests**: Included. The plan and constitution (Principles III and IV) require exact-decimal tests for money logic, backend e2e for persistence/isolation/fail-closed behavior, and ≥ 80 % coverage per project.

**Organization**: Grouped by user story. Retirement's structure is mirrored on purpose: when a task says "mirror Retirement", open the matching file under `apps/backend/src/retirement/` or `libs/retirement/` first and copy its pattern (guard, crypto service, repository, e2e helpers).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 from spec.md
- Run Nx tasks with `npx nx ...` (this repo uses npm, not pnpm). Never read `.env` or `environment.local.ts`.

## Path Conventions

- Domain lib (new): `libs/wealth/src/lib/`
- Backend module (new): `apps/backend/src/wealth/`, e2e in `apps/backend/src/tests/`
- Frontend domain lib (existing): `libs/frontend/domain/historic-wealth-development/src/lib/`
- Shared contract: `libs/api-contract/src/lib/wealth.ts`
- i18n: `libs/frontend/shared-ui/src/lib/i18n/translations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Governance amendment, new lib scaffold, configuration for the new key

- [x] T001 Amend `.specify/memory/constitution.md` to version 3.10.0 (MINOR): add a Product Scope bullet describing the Historic Wealth Development domain (manual snapshots of assets and liabilities, balance-sheet view, no bank/broker/Holdings import) and name its manual entry data under the Sensitive Personal Data rules; update the version line and amendment note, and the `.specify/memory/.constitution-template.json` only if it tracks the version
- [x] T002 Invoke the `nx-generate` skill, then scaffold the new framework-independent lib `libs/wealth` (import path `@vaultfolio/wealth`, tag `scope:shared`, Jest, no Angular/Nest deps) mirroring `libs/retirement` config files (`jest.config.cts`, `tsconfig*.json`, `package.json` declaring `decimal.js`); register the path alias in `tsconfig.base.json`
- [x] T003 [P] Add `WEALTH_ENCRYPTION_KEY` (base64 of 32 random bytes, with generation hint, like the other domain keys) to `.env.example`, `docker-compose.yml` and `docker-compose.portainer.yml`
- [x] T004 [P] Declare `echarts` in `libs/frontend/domain/historic-wealth-development/package.json` (as Earnings does) so the lib owns its runtime dependency

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure domain logic, shared DTO types and the backend persistence/crypto core that every story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### `@vaultfolio/wealth` library

- [x] T005 [P] Create `libs/wealth/src/lib/model.ts` with `Side`, `StandardClassId`, `ClassRef`, `BalanceGroup`, `Money`, `WealthEntry`, `WealthSnapshot`, `WealthSnapshotInput`, `ClassGroupAssignment`, `WealthSettings` exactly as in contracts/wealth-lib.md and data-model.md
- [x] T006 [P] Create `libs/wealth/src/lib/classes.ts`: `STANDARD_CLASSES`, `defaultGroupOf` (defaults per research R5), `groupsOf(side)`, `classKey(side, ref)` (standard id or custom label trimmed/NFC/case-folded; same text on both sides = two classes), `matchStandardByLabel(side, label, translate)`, `suggestionsOf(side, snapshots)`
- [x] T007 Create `libs/wealth/src/lib/validation.ts`: `validateSnapshotInput(input, today)`, `validateClassGroup`, `normalizeMoney` — strict whitelist (unknown fields rejected), date 1900-01-01…today+1 day, 1..200 entries, name ≤ 100, custom class ≤ 50, note ≤ 500, amount `0.00…999999999999.99` two decimals, standard id/group only on own side; errors carry field + code, never the value (depends on T005, T006)
- [x] T008 Create `libs/wealth/src/lib/summary.ts` with `decimal.js`: `totalsOf`, `filterPeriod` (`1y`/`3y`/`all` measured back from the latest snapshot date), `seriesOf` (missing class = `0.00`), `changesOf` (`delta` for all but first, `pct` only when previous net > 0 else `null`), `latestOf`, `copyTemplateOf` (amounts `''`) (depends on T005, T006)
- [x] T009 Create `libs/wealth/src/lib/balance-sheet.ts`: `effectiveGroup` (assignment → standard default → side's "other"), `balanceSheetOf` (groups with sub-totals and entries, `equity = net`, `sumAssets`, `sumPassiva = liabilities + equity`) (depends on T006, T008)
- [x] T010 [P] Create `libs/wealth/src/lib/testing/builders.ts` (`buildSnapshot`, `buildEntry`) and export it from a test-only entry point; create `libs/wealth/src/index.ts` exporting everything in the contract
- [x] T011 [P] Write `libs/wealth/src/lib/validation.spec.ts`: valid input; each rejection (unknown field, negative/non-numeric amount, missing name/class/side/date, future date vs. +1 day tolerance, no entries, 201 entries, standard id on wrong side, group on wrong side); errors name the field and never echo values
- [x] T012 [P] Write `libs/wealth/src/lib/summary.spec.ts` with fixed exact-decimal expectations: totals incl. negative net worth and `0.1 + 0.2` style decimals, large values, duplicate name+class both summed, period filters, series zero-fill, change `pct` `null` for previous net `0` and negative, first snapshot has no change, chronological order independent of input order
- [x] T013 [P] Write `libs/wealth/src/lib/classes.spec.ts` and `balance-sheet.spec.ts`: class identity normalization, same label on both sides separate, `matchStandardByLabel`, suggestions include used custom labels; balance sheet grouping, override of a standard class's group, class without group under "other", negative equity, invariant `sumAssets == sumPassiva` over several fixtures
- [x] T014 Run `npx nx test wealth --coverage` and `npx nx lint wealth`; fix until green and ≥ 80 %

### Shared contract and backend core

- [x] T015 [P] Create `libs/api-contract/src/lib/wealth.ts` with the DTO types from contracts/wealth-api.md (`WealthSnapshot`, `WealthSnapshotInput`, `WealthEntry`, `ClassRef`, `ClassGroupAssignment`, `WealthSettings`, error code constants) and export from `libs/api-contract/src/index.ts`
- [x] T016 Create `apps/backend/src/wealth/wealth-crypto.service.ts` and `wealth-available.guard.ts` mirroring Retirement: AES-256-GCM via `apps/backend/src/shared/field-crypto.ts`, `WEALTH_ENCRYPTION_KEY`, AAD `<table>|<row id>|<owner_id>`, format `v1:<iv>:<tag>:<ct>`, `available === false` when key missing/invalid, boot-time decrypt check of one stored row, runtime auth failure flips to unavailable; guard answers `503 WEALTH_UNAVAILABLE`
- [x] T017 [P] Create `apps/backend/src/wealth/wealth.exceptions.ts` for `WEALTH_VALIDATION`, `WEALTH_UNKNOWN_FIELD`, `WEALTH_LIMIT_EXCEEDED`, `WEALTH_SNAPSHOT_NOT_FOUND`, `WEALTH_SNAPSHOT_DATE_EXISTS` (carries `existingId`), `WEALTH_UNAVAILABLE`, using the `ErrorResponseDto` shape with `details: [{ field, message: CODE }]`
- [x] T018 Add idempotent `CREATE TABLE IF NOT EXISTS` for `wealth_snapshots` (with `GLOB` date check and unique index `wealth_snapshots_owner_date_uidx (owner_id, snapshot_date)`) and `wealth_settings` in `apps/backend/src/database/database.service.ts` per data-model.md
- [x] T019 Create `apps/backend/src/wealth/wealth.repository.ts`: owner-scoped list (ascending by date)/get/insert/update/delete for snapshots, settings get/upsert, `deleteAllForOwner`, count per owner; every query filters by `owner_id`; payload encrypted/decrypted through the crypto service; logs carry ids only (depends on T016, T018)
- [x] T020 Create `apps/backend/src/wealth/wealth.service.ts`: validate with `@vaultfolio/wealth`, enforce 600-snapshot limit, map unique-date collision (create and date-changing update) to `409` with `existingId`, upsert class-group assignment (replace-by-`(side, classKey)`), delete-all; logs contain snapshot id, entry count and outcome only (depends on T017, T019)

**Checkpoint**: Pure logic tested; persistence and crypto core in place

---

## Phase 3: User Story 1 - Record a wealth snapshot for a date (Priority: P1) 🎯 MVP

**Goal**: Create, view, edit and delete snapshots with per-class sub-totals, assets, liabilities and net worth, via a working API and form.

**Independent Test**: Create a snapshot for today with entries in five asset classes (one custom "Whiskey"); reload and verify persistence and total; edit a value, delete an entry, delete the snapshot; same date twice offers the existing snapshot.

### Tests for User Story 1

- [x] T021 [P] [US1] Write backend e2e helpers `apps/backend/src/tests/wealth-e2e.helpers.ts` (app bootstrap with test key, user with the domain scope; mirror the retirement helpers) and `apps/backend/src/tests/wealth.e2e-spec.ts` covering: create/get/list/update/delete, duplicate date → `409` with `existingId`, date-change collision → `409`, validation `400` with field names, unknown field → `400 WEALTH_UNKNOWN_FIELD`, limits, owner isolation (other owner's id → `404`, list excludes it), domain not entitled → `403`, `503` without key and with a changed key, ciphertext at rest (stored `payload_enc` contains no entry name/amount), logs contain no names/amounts
- [ ] T022 [P] [US1] Write `snapshot-form` component spec and `wealth.service.spec.ts` in the frontend lib: validation messages name the offending field, class free text accepted and offered as suggestion later, amount parsing of `12.000,50` in the form, duplicate-date note with "open existing", removing/adding entries updates the sum box

### Implementation for User Story 1

- [x] T023 [US1] Create `apps/backend/src/wealth/wealth.controller.ts` with `@RequiresDomain('historic-wealth-development')` and `WealthAvailableGuard`: `GET /wealth/snapshots`, `GET /wealth/snapshots/:id`, `POST /wealth/snapshots` (201), `PUT /wealth/snapshots/:id`, `DELETE /wealth/snapshots/:id` (204) per contracts/wealth-api.md (depends on T020)
- [x] T024 [US1] Create `apps/backend/src/wealth/wealth.module.ts`, register it in `apps/backend/src/app/app.module.ts`, and add `WealthModule`-related deletion of the user's wealth rows (snapshots + settings) to `apps/backend/src/auth/users.repository.ts` account deletion path (FR-021; add an assertion to the e2e spec from T021)
- [x] T025 [US1] OpenAPI: add `@Api...` decorators on the new controller routes and decorated DTO classes in `apps/backend/src/openapi/dto/wealth.ts` for every route and shape in contracts/wealth-api.md (snapshots; settings/class-groups and `DELETE /wealth` are completed in US5/Polish), then run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [ ] T026 [P] [US1] Create frontend `libs/frontend/domain/historic-wealth-development/src/lib/wealth.service.ts` (HTTP client: list, get, create, update, delete snapshots; typed with `@vaultfolio/api-contract`; maps `409` `existingId` and `503` to typed errors)
- [ ] T027 [P] [US1] Create i18n files `libs/frontend/shared-ui/src/lib/i18n/translations/wealth.de.ts` and `wealth.en.ts` (nav label "Vermögen"/"Wealth", form labels, suggested class names per side, validation messages, empty/unavailable texts; add keys for later stories as you go) and register them in the translation index; add `wealth-translations.spec.ts` asserting DE/EN key parity
- [ ] T028 [US1] Create `snapshot-form/` (`snapshot-form.component.ts/html/scss`) per design.md: date, note, asset panel and liability panel with Name / Klasse (free text + suggestion list from `suggestionsOf`, standard id stored when label matches via `matchStandardByLabel`) / Betrag rows, add/remove buttons, sticky sum box using `totalsOf`, save/cancel, inline field errors from the API, "date already taken" note with "Bestehenden Stichtag öffnen"; add `data-testid`s per `docs/frontend/testid-conventions.md`
- [ ] T029 [US1] Add routes `/historic-wealth-development/new` and `/historic-wealth-development/:id/edit` in `apps/frontend/src/app/app.routes.ts` loading the form (replace the placeholder route usage) and a minimal list entry point (snapshot table with edit/delete and delete confirmation, per-class sub-totals shown in the edit view) in `wealth-area/` so US1 is usable before the full overview
- [ ] T030 [US1] Implement `wealth-area/` shell: available check (503 → `wealth-unavailable` page), loading/error states, and replace usage of `historic-wealth-development-placeholder` in `apps/frontend/src/app/core/layout/application-areas.ts` (label via translations "Vermögen"/"Wealth"); delete `historic-wealth-development-placeholder/` once nothing references it
- [ ] T031 [US1] Run `npx nx test backend`, `npx nx e2e` for wealth, `npx nx test frontend-domain-historic-wealth-development`; then invoke the `verify-ui` skill and drive the create → reload → edit → delete flow and the duplicate-date note with Playwright (use the dedicated test user, never `.env`)

**Checkpoint**: Snapshots can be recorded, edited and deleted end to end (MVP)

---

## Phase 4: User Story 2 - Backfill earlier snapshots quickly (Priority: P1)

**Goal**: Create past snapshots by copying an existing one; always chronologically ordered.

**Independent Test**: With one snapshot create three past ones via "copy from existing", adjust values; all four are listed chronologically regardless of creation order.

- [ ] T032 [P] [US2] Add specs for the copy flow in the snapshot-form spec: choosing a source prefills names/sides/classes with blank amounts (`copyTemplateOf`), removing a copied entry excludes it from the snapshot and totals, a blank amount blocks saving with a field message
- [ ] T033 [US2] Implement "Aus bestehendem Stichtag kopieren" select in `snapshot-form/` using `copyTemplateOf` from `@vaultfolio/wealth` (prefill rows, focus first amount), plus a row action "als Vorlage kopieren" in the snapshot table that opens `/new` with the source preselected (query param); add i18n keys and `data-testid`s
- [ ] T034 [US2] Ensure the table and all lists sort by `snapshotDate` using the lib regardless of creation order; add a unit test with out-of-order input
- [ ] T035 [US2] `verify-ui`: create one snapshot, then three past snapshots by copying, out of order; confirm ordering, prefilled fields and removal of an entry

**Checkpoint**: Backfill workflow works (SC-002)

---

## Phase 5: User Story 3 - See the wealth development over time (Priority: P1)

**Goal**: Overview with KPIs, stacked-class chart with net-worth line, snapshot table with changes, period filter, class toggles, empty and single-snapshot states.

**Independent Test**: With four snapshots across classes verify the total series, per-class breakdown, changes versus previous snapshot, period filter and class toggles; zero and one snapshot show their states.

- [ ] T036 [P] [US3] Write `charts/wealth-charts.spec.ts`: option builder produces stacked asset series per class, one liability series with decal pattern and distinct color below zero, net-worth line, zero for absent classes, legend selection state, and an accessible text summary
- [ ] T037 [P] [US3] Write `development/` component specs: KPIs (net worth, change with "n/a" percent when previous ≤ 0, assets, liabilities), table newest-first with oldest row showing "–" and newest highlighted, period filter narrows chart/table/changes, single-snapshot state with hint and composition bar, empty state with call to action, 120-snapshot fixture renders
- [ ] T038 [US3] Create `charts/wealth-charts.ts`: single ECharts option builder (stacked bars by class upward, liabilities as hatched negative-stack series with distinct color, net-worth line with markers), light/dark theme aware, exposing `getChartOptions`-compatible output reused for the PDF (wide ≈ 1000×330 capture) (depends on T008)
- [ ] T039 [US3] Create `development/` components: KPI tiles, chart panel (native ECharts legend toggles; text summary for assistive tech), snapshot table (Stichtag, assets, liabilities, net, change, percent, row actions edit/copy/delete), single-snapshot view, empty state; period filter (`1y`/`3y`/`all`) shared state in `wealth-area/` via signals; liabilities visibly distinct in table (FR-022); `data-testid`s for repeated rows and toolbar controls
- [ ] T040 [US3] Create `wealth-area/` tabs (Entwicklung, Bilanz placeholder route for US5), toolbar with period filter, "Daten exportieren" link to the existing export dialog and "+ Stichtag erfassen"; wire `/historic-wealth-development` in `apps/frontend/src/app/app.routes.ts`; add all DE/EN strings
- [ ] T041 [US3] `verify-ui`: check four-snapshot overview, toggles, period filter, one-snapshot and empty states, mobile width (table scrolls in its container), light and dark theme; seed 120 snapshots in the throw-away script to confirm readability and < 2 s render

**Checkpoint**: Core value delivered (P1 stories complete)

---

## Phase 6: User Story 4 - Dashboard tile with the current wealth (Priority: P2)

**Goal**: Dashboard tile with latest net worth, change and trend that follows the existing ordering/visibility settings.

**Independent Test**: With two snapshots the tile shows latest total and change; hide/reorder persists; no data shows the empty state.

- [ ] T042 [P] [US4] Write `wealth-dashboard-widget` spec: two snapshots (hero, change with percent and date, sparkline polyline, assets and liabilities rows), one snapshot (hint + "Stichtag erfassen"), no data (empty state linking to the page), negative net worth and "n/a" percent
- [ ] T043 [US4] Create `wealth-dashboard-widget/` (whole tile is a link; sparkline as inline SVG polyline, no ECharts import; uses `latestOf`/`seriesOf` from `@vaultfolio/wealth`) and register a `DashboardWidgetContribution` for domain `historic-wealth-development` in `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`; add i18n strings and `data-testid`
- [ ] T044 [US4] `verify-ui`: dashboard shows the tile, hide and reorder via tile settings, reload keeps the choice, empty-state variant, tile not rendered for users without the domain

**Checkpoint**: Dashboard integration complete

---

## Phase 7: User Story 5 - Personal balance sheet for a reference date (Priority: P2)

**Goal**: Bilanz tab with Aktiva/Passiva by balance group, equity as balancing figure, and remembered class-to-group assignments.

**Independent Test**: Snapshot with assets in several classes and a mortgage: grouping, group sub-totals, `Aktiva == Passiva + equity`, and changing a class's group moves its entries in every snapshot.

### Tests for User Story 5

- [x] T045 [P] [US5] Extend `apps/backend/src/tests/wealth.e2e-spec.ts` for settings: `GET /wealth/settings` empty owner → `{ classGroups: [] }`, `PUT /wealth/settings/class-groups` upsert and replace by `(side, classKey)`, group on wrong side → `400 WEALTH_UNKNOWN_FIELD`, owner isolation of settings, ciphertext at rest, settings survive snapshot deletion, `DELETE /wealth` removes snapshots and settings and returns `204`
- [ ] T046 [P] [US5] Write `balance/` component specs: grouped Aktiva/Passiva with sub-totals, equity row first in Passiva, negative equity, "Keine Positionen" for empty groups, identical "Summe" on both sides, reference-date select, group selector applies to all snapshots, group prompt appears once for a new custom class, no ratios displayed

### Implementation for User Story 5

- [x] T047 [US5] Add `GET /wealth/settings`, `PUT /wealth/settings/class-groups`, `DELETE /wealth` to `apps/backend/src/wealth/wealth.controller.ts` (validate with `validateClassGroup`; `DELETE /wealth` deletes snapshots + settings of the caller) (depends on T020)
- [x] T048 [US5] OpenAPI: add `@Api...` decorators and DTO classes for the settings and delete-all routes in `apps/backend/src/openapi/dto/wealth.ts`, run `npx nx run backend:openapi`, commit the regenerated `api/openapi.yml`, and run `npx nx run backend:openapi:check`
- [ ] T049 [P] [US5] Extend `wealth.service.ts` (frontend) with `getSettings`, `upsertClassGroup`, `deleteAll`; keep the settings in a signal store shared by the form and the balance view
- [ ] T050 [US5] Create `balance/` (`balance-sheet.component`, group selector): reference-date select defaulting to latest snapshot, two columns (stack on mobile, Aktiva first), rows with name/class/amount, group sub-totals and "Summe", info note with group selector ("Übernehmen") and the no-ratios warning (FR-027); liabilities visibly distinct; empty state; wire it into the Bilanz tab from T040
- [ ] T051 [US5] Add the one-time group prompt to `snapshot-form/` ("Neue Klasse „X" – in welche Bilanzgruppe?") when a new custom class (per side) has no assignment, offering only groups of its side, saved through `upsertClassGroup`; add strings and `data-testid`s
- [ ] T052 [US5] Add the danger-zone "Alle Vermögensdaten löschen" (confirmation dialog, calls `deleteAll`, returns page/tile to empty state) in `wealth-area/`
- [ ] T053 [US5] `verify-ui`: quickstart steps 5–6 and 10 — mortgage below zero line, balance sheet totals equal, change "Whisky" group and confirm it moves in other snapshots' balance sheets, delete-all returns to empty

**Checkpoint**: Balance sheet complete

---

## Phase 8: User Story 6 - Export the wealth development as PDF (Priority: P2)

**Goal**: PDF report (and CSV/Excel/JSON) from the existing export dialog, same style as income and retirement reports.

**Independent Test**: With several snapshots export the PDF: KPIs, development chart, class table, snapshot table, balance sheet of the latest snapshot in the chosen period, nothing cut off; no snapshots → unavailable with explanation.

- [ ] T054 [P] [US6] Write `wealth-export.definition.spec.ts` and `wealth-pdf-sections.spec.ts`: sections `kpis` → chart → class `table` → snapshot `table` → balance `table` on a new page (columns Aktiva, amount, Passiva, amount; group header rows `emphasis: 'total'`; last row sums equal), period filter respected, interface language used, `getTables()` returns the flat entry table (date, side, class, name, amount, balance group) and the totals table, unavailable with explanation when there are no snapshots, 403/503 yields empty output for the data-export bundle
- [ ] T055 [US6] Create `wealth-pdf-sections.ts` (landscape sections as above, reusing `totalsOf`, `changesOf`, `balanceSheetOf` so figures match the screen — SC-005) and `wealth-export.definition.ts` (real provider with `getPdfSections`, `getChartOptions` from `charts/wealth-charts.ts`, `getTables`); remove `historic-wealth-development-export.definition.ts` (+ spec), the disabled placeholder
- [ ] T056 [US6] Register the new definition in `apps/frontend/src/app/export/feature-export.registry.ts` (replace the placeholder registration) and add DE/EN export strings
- [ ] T057 [US6] Add an export integration test (in the frontend lib or `libs/export` consumer tests, whichever the retirement export test uses) generating the wealth PDF sections for a fixed fixture and asserting section order and figures
- [ ] T058 [US6] `verify-ui`: dashboard → export dialog → wealth PDF with period filter active, inspect the PDF pages for cut-off content and liabilities distinguishable without color; CSV/Excel/JSON contain entry and totals tables; empty state shows unavailable explanation

**Checkpoint**: All user stories complete

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T059 [P] Update `README.md` and `README.de.md` (feature list, `WEALTH_ENCRYPTION_KEY` in the environment-variable tables) and `docs/user-guide.md` / `docs/user-guide.de.md` (snapshots, copy as template, balance sheet, tile, PDF, danger zone)
- [ ] T060 [P] Add the new `data-testid`s to `docs/frontend/testid-conventions.md` where the conventions require a listing
- [ ] T061 Accessibility pass (FR-020): keyboard reachability of form, table actions, legend toggles and balance selectors; accessible names for icon buttons and chart text summary; fix findings
- [ ] T062 Security/privacy pass (FR-019, SC-007): grep backend logs and error messages of `apps/backend/src/wealth/` for names/classes/amounts, confirm `payload_enc` never leaves the repository, confirm nothing wealth-related in `docs/` fixtures is real personal data
- [ ] T063 Run `npx nx run-many -t lint,test --projects=wealth,frontend-domain-historic-wealth-development,frontend,backend,api-contract,shared-ui`, the backend wealth e2e, `npx nx run backend:openapi:check`, then the coverage audit (`/speckit-coverage`) and fix projects below 80 %
- [ ] T064 Walk through `specs/038-networth-tracking/quickstart.md` end to end (including operations: no `WEALTH_ENCRYPTION_KEY` → unavailable page and `503`, rest of app unaffected)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 first by plan decision, T002 before everything in `libs/wealth`
- **Foundational (Phase 2)**: depends on Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational — MVP
- **US2 (Phase 4)**: after US1 (extends form and table)
- **US3 (Phase 5)**: after US1 (needs snapshots, area shell); independent of US2
- **US4 (Phase 6)**: after Foundational + US1 service/i18n (T026, T027); needs data from US1 to demo
- **US5 (Phase 7)**: after US1; Bilanz tab hooks into the shell from US3 (T040)
- **US6 (Phase 8)**: after US3 (chart builder T038) and US5 (balance sheet logic is in the lib, already available after T009)
- **Polish (Phase 9)**: after the desired stories

### Within Phase 2

T005, T006 → T007, T008 → T009; T010–T013 [P] alongside; T014 gates the lib. T015, T016, T017, T018 in parallel with the lib work; T019 → T020.

### Within Each Story

Tests first (they should fail), then backend, then frontend, then `verify-ui`. Same-file tasks (e.g. `wealth.controller.ts` T023/T047, `openapi/dto/wealth.ts` T025/T048, `snapshot-form` T028/T033/T051) are sequential across stories.

## Parallel Examples

```bash
# Phase 2, after T005/T006:
Task: "validation.ts" (T007)   Task: "summary.ts" (T008)   Task: "api-contract wealth.ts" (T015)
Task: "wealth-crypto.service.ts + guard" (T016)   Task: "schema in database.service.ts" (T018)

# US1 tests together:
Task: "backend e2e (T021)"   Task: "frontend form/service specs (T022)"

# US3 specs together:
Task: "wealth-charts.spec.ts (T036)"   Task: "development component specs (T037)"
```

## Implementation Strategy

### MVP First (US1 only)

1. Phases 1–2, then Phase 3; stop at T031 and validate: snapshots persist, are encrypted, isolated per owner and fail closed.
2. Add US2 (backfill) and US3 (overview) — together they are the P1 value ("see development").
3. Add P2 stories in any order: US4 tile (small), US5 balance sheet, US6 PDF (needs US3's chart).

### Notes

- [P] = different files, no incomplete dependencies; commit after each task or logical group
- `speckit-implement` should invoke `verify-ui` at each `verify-ui` task; scripts stay in the scratchpad and are not committed
- OpenAPI regeneration is part of T025 and T048; the CI check `backend:openapi:check` is the backstop
