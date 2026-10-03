---
description: 'Task list for Altersvorsorge (Retirement Planning)'
---

# Tasks: Altersvorsorge (Retirement Planning)

**Input**: Design documents from `/specs/037-altersvorsorge-retirement-planning/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (retirement-api.md, retirement-lib.md, document-reader.md), design.md, quickstart.md

**Tests**: Included. The spec does not ask for TDD, but the constitution (Principles III/IV) requires exact-decimal tests for money logic, backend e2e for owner isolation / read-only imports / fail-closed key, and parser tests on **synthetic** documents (never real personal PDFs). Tests are listed before the implementation they cover; write them first and see them fail where practical.

**Organization**: Grouped by user story. US1 (record + import) and US2 (overview) are both P1; US2 reads what US1 stores, so US1 comes first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 (user-story phases only)
- Commands use `npm exec nx -- …` / `npx nx …` (this repo uses npm, not pnpm). Never read `.env` or `environment.local.ts`.

## Path Conventions

Nx monorepo: `libs/<lib>/src/lib/`, `apps/backend/src/`, `libs/frontend/domain/retirement/src/lib/`, `libs/frontend/shared-ui/src/lib/i18n/translations/`. New `data-testid`s follow `docs/frontend/testid-conventions.md` and are added in the same task that creates the element.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the three new Nx libs and operator config.

- [x] T001 Invoke the `nx-generate` skill, then generate the pure TS lib `@vaultfolio/document-text` at `libs/document-text` (tag `scope:shared`, Jest, same lint/ts config as `libs/earnings`) and register its path alias in `tsconfig.base.json`
- [x] T002 Generate the pure TS lib `@vaultfolio/retirement` at `libs/retirement` (tag `scope:shared`, Jest, mirror `libs/earnings` config) and register its path alias in `tsconfig.base.json`
- [x] T003 Generate the Angular lib `@vaultfolio/frontend-document-reader` at `libs/frontend/document-reader` (tag `scope:shared`, same test runner as `libs/frontend/domain/earnings`) and register its path alias in `tsconfig.base.json`
- [x] T004 [P] Document `RETIREMENT_ENCRYPTION_KEY` (Base64 of 32 bytes; "missing → 503 for Retirement only") in `.env.example`, `docker-compose.yml` and `docker-compose.portainer.yml`
- [x] T005 [P] Confirm Nx module-boundary rules in `eslint.config.mjs` allow `scope:frontend-domain` → the two new `scope:shared` libs and `scope:shared` → `scope:shared`; adjust only if lint fails

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Behaviour-neutral Earnings refactor, shared contract types, validation/checks, encrypted storage, availability guard, frontend shell. **No user story starts before this phase is complete.**

**⚠️ CRITICAL**: Do the refactor tasks T006–T014 first, with all existing Earnings specs passing unchanged after each step.

### Shared PDF stack refactor (contracts/document-reader.md)

- [x] T006 Move `PdfDocumentText`, `PdfPageText`, `PdfLine`, `PdfWord` (incl. `origin: 'EXTRACTED' | 'RECOGNISED'`) from `libs/earnings/src/lib/parsers/pdf-text.ts` to `libs/document-text/src/lib/pdf-text.ts`; leave `libs/earnings/src/lib/parsers/pdf-text.ts` as a re-export; export from `libs/document-text/src/index.ts`
- [x] T007 Move the OCR digit normalisation from `libs/earnings/src/lib/parsers/ocr-normalise.ts` (+ its spec) to `libs/document-text/src/lib/ocr-normalise.ts`; leave a re-export in Earnings
- [x] T008 Extract the German amount/date token helpers (`parseGermanAmount`, date token parsing, Money-string helpers not tied to Earnings types) used by Earnings parsers into `libs/document-text/src/lib/amount-tokens.ts` with a unit spec (fixed expected decimals, e.g. `1.234,56` → `1234.56`); Earnings parsers import them from `@vaultfolio/document-text`
- [x] T009 Run `npm exec nx -- run-many -t lint test -p document-text earnings` and fix until green (no Earnings spec edited)
- [x] T010 Move `pdf-text-extractor.ts`, `read-blob.ts`, `text-recogniser.ts`, `tesseract-recogniser.ts`, `ocr-layout.ts`, `text-recogniser.token.ts`, `text-recogniser.testing.ts` (+ their specs and the optional real-engine OCR integration spec) from `libs/frontend/domain/earnings/src/lib/pdf/` to `libs/frontend/document-reader/src/lib/`; export from `src/index.ts`; move `pdfjs-dist`/`tesseract.js` declarations to the lib's `package.json` while keeping them in the app `package.json`
- [x] T011 Move the OCR consent component (`ocr-consent/`) from the Earnings frontend lib to `libs/frontend/document-reader/src/lib/ocr-consent/` as `<vf-ocr-consent>` (inputs `fileName`, `pageCount`; outputs `allow`, `cancel`; plus progress view) using a shared i18n key group; keep existing `data-testid`s
- [x] T012 Switch all imports in `libs/frontend/domain/earnings/src/lib/**` (import flow, provider wiring) to `@vaultfolio/frontend-document-reader`; verify `apps/frontend/project.json` still copies `assets/tesseract/` unchanged
- [x] T013 Move the shared OCR-consent/progress i18n keys to a shared translation group in `libs/frontend/shared-ui/src/lib/i18n/translations/` and update the Earnings translation parity spec accordingly
- [x] T014 Run `npm exec nx -- run-many -t lint test build -p frontend-document-reader frontend-domain-earnings frontend` and fix until green; Earnings behaviour must be unchanged

### Contract types and pure retirement logic

- [x] T015 [P] Declare record/figures/supplement/summary DTO types (per data-model.md and contracts/retirement-api.md) in `libs/api-contract/src/lib/retirement.ts` and export from `libs/api-contract/src/index.ts`
- [x] T016 [P] Implement the model in `libs/retirement/src/lib/model.ts` (`Pillar`, `ContractType`, `Origin`, `Status`, `pillarOf`, pillar↔type pairing, Money helper on `decimal.js`) and re-export api-contract types; export from `libs/retirement/src/index.ts`
- [x] T017 [P] Write `libs/retirement/src/lib/validation.spec.ts`: whitelist per type (unknown/inapplicable field → `UNKNOWN_FIELD`, e.g. `guaranteedMonthly` on `ALTERSVORSORGEDEPOT`), amount ranges/decimals, dates (`statement_date` not future, `payout_start` window), `GUARANTEE_ABOVE_EXPECTED`, identifier charset/length, required fields per type incl. `providerLabel`
- [x] T018 Implement `validateRecordInput` and `validateSupplement` in `libs/retirement/src/lib/validation.ts` (never throws on user input, canonicalised decimals, issue codes per contracts/retirement-lib.md)
- [x] T019 [P] Write `libs/retirement/src/lib/checks.spec.ts` with fixed expected values for every check id (`STATUTORY_POINTS_VALUE`, `STATUTORY_ORDER`, `STATUTORY_DATES`, `SCENARIOS_MONOTONIC`, `GUARANTEE_BELOW_ZERO_CASE`, `CONTRIBUTION_SUM`, `ACCOUNT_ROLL_FORWARD`, `ACCOUNT_INTEREST`), passing and failing cases
- [x] T020 Implement `runChecks(type, figures, dates)` returning `{ id, ok }[]` only (no figures) in `libs/retirement/src/lib/checks.ts`
- [x] T021 [P] Add `libs/retirement/src/lib/testing/builders.ts` (`buildRecord(overrides)`) with invented, internally consistent values for every contract type

### Backend storage, crypto, availability

- [x] T022 Extract the AES-256-GCM primitive from the Earnings crypto service into `apps/backend/src/shared/field-crypto.ts` (+ spec); make `earnings-crypto` use it with zero behaviour change; run `npm exec nx -- run backend:test` for Earnings specs
- [x] T023 [P] Write `apps/backend/src/retirement/retirement-crypto.service.spec.ts`: round trip, AAD `retirement_records|<id>|<owner_id>` mismatch fails, missing/invalid key → unavailable, boot self-check against one stored row with a different key → unavailable
- [x] T024 Implement `apps/backend/src/retirement/retirement-crypto.service.ts` (`RETIREMENT_ENCRYPTION_KEY`, format `v1:iv:tag:ciphertext`, runtime auth failure flips to unavailable) mirroring `EarningsCryptoService`
- [x] T025 Add idempotent `CREATE TABLE IF NOT EXISTS retirement_records` with the CHECKs, the partial unique index `(owner_id) WHERE pillar='STATUTORY'` and index `(owner_id, pillar)` from data-model.md in `apps/backend/src/database/database.service.ts`
- [x] T026 Implement `apps/backend/src/retirement/retirement.repository.ts`: owner-scoped insert/update/get/list(pillar)/delete/deleteAll, transactional `replace(oldId, newRow)`; every SQL filters by `owner_id`
- [x] T027 [P] Implement `apps/backend/src/retirement/retirement.exceptions.ts` (error codes/bodies from contracts/retirement-api.md) and `retirement-available.guard.ts` (503 `RETIREMENT_UNAVAILABLE` on every route while the crypto service is unavailable)
- [x] T028 Register the module skeleton `apps/backend/src/retirement/retirement.module.ts` (controller/service stubs, `@RequiresDomain('retirement')`) in `apps/backend/src/app/app.module.ts`; add the purge of `retirement_records` to the owner purge list in `apps/backend/src/auth/users.repository.ts` and cover it in its existing spec
- [x] T029 [P] Write `apps/backend/src/tests/retirement-e2e.helpers.ts` (test app bootstrap with key, user/admin/member sessions, record payload builders)

### Frontend shell

- [x] T030 [P] Create `libs/frontend/shared-ui/src/lib/i18n/translations/retirement.de.ts` and `retirement.en.ts` (initial groups: area/tabs, pillars, status/origin badges, guaranteed/Prognose labels, errors) plus `retirement-translations.spec.ts` key-parity spec modelled on Earnings'; register in the translation index
- [x] T031 Implement `libs/frontend/domain/retirement/src/lib/retirement.service.ts` (HTTP for `/retirement/records`, `/summary`, `PATCH …/supplement`, `DELETE /retirement`, typed with api-contract) with `retirement.service.spec.ts`
- [x] T032 Replace `libs/frontend/domain/retirement/src/lib/retirement-placeholder/` with `retirement-area/` (`RetirementAreaComponent` with toolbar + tab routes `''`, `statutory`, `occupational`, `private`, `info`, available guard, "unavailable" state like Earnings) and update `libs/frontend/domain/retirement/src/index.ts` and the route in `apps/frontend/src/app/app.routes.ts`; add `data-testid`s for tabs and toolbar actions

**Checkpoint**: Earnings unchanged and green, validation/checks/crypto/repository/guard exist, empty Retirement area renders. User stories can start.

---

## Phase 3: User Story 1 - Record all pension entitlements across the three pillars (Priority: P1) 🎯 MVP

**Goal**: Create, import (upload), review, edit (manual only), supplement (imported) and delete records for all pillars with owner-only encrypted storage.

**Independent Test**: Create one statutory record, two occupational contracts and one Riester contract (manually and via upload); reload; verify persistence, edit/delete of manual records, read-only imported records with supplement editing, rejection of unrecognised/inconsistent documents, and owner isolation.

### Tests for User Story 1

- [x] T033 [P] [US1] Add synthetic document builders `syntheticDrvRenteninformation()`, `syntheticPrivateStatement()`, `syntheticCapitalAccountStatement()` (+ variants: misread figure, missing label, scanned/`RECOGNISED` rendition) in `libs/retirement/src/lib/testing/` reproducing the real layouts with invented consistent values (no real data)
- [x] T034 [P] [US1] Write `libs/retirement/src/lib/parsers/drv-renteninformation.spec.ts` (exact figures per FR-002, identifier, OCR variant, misread → `INCONSISTENT`, missing label → `INCOMPLETE`)
- [x] T035 [P] [US1] Write `libs/retirement/src/lib/parsers/private-statement.spec.ts` (guaranteed pension/capital, 0/3/6/9 % scenarios, surrender/death benefit, contributions, guarantee period, `missingSupplement` incl. `contributionMonthly`, default scenario `3`)
- [x] T036 [P] [US1] Write `libs/retirement/src/lib/parsers/capital-account-statement.spec.ts` (opening/closing balance, rate, credit, contribution, final bonus; imports as `CAPITAL_ACCOUNT` capital, no monthly pension)
- [x] T037 [P] [US1] Write `libs/retirement/src/lib/parsers/registry.spec.ts` (first match wins, unrelated text → `UNRECOGNISED`, output contains no name/address/tax-id/bank data)
- [x] T038 [P] [US1] Write `apps/backend/src/tests/retirement.e2e-spec.ts` covering: create/list/get/PUT/DELETE manual records; unknown field → 400 `RETIREMENT_UNKNOWN_FIELD`; validation error names the field; `PUT` on imported → 409 `RETIREMENT_IMPORTED_READONLY`; `PATCH …/supplement` on manual → 409 `RETIREMENT_NOT_IMPORTED`; second statutory without `replaces` → 409 `RETIREMENT_STATUTORY_EXISTS`; `replaces` swaps in one transaction; imported record failing a check → 400 `RETIREMENT_CHECK_FAILED` (ids only); owner isolation (foreign id → 404, admin sees nothing foreign); no key → 503 on all routes while Holdings still works; `DELETE /retirement` purges only caller's rows; ciphertext in DB contains no figures/identifier
- [x] T039 [P] [US1] Write `libs/frontend/domain/retirement/src/lib/import/import-store.spec.ts` (state machine: pick → text extraction → consent for scans → parse → review → confirm; rejection states; only whitelisted fields + `parserId`/`parserVersion`/`ocrRead` are sent) using the scriptable fake recogniser from `@vaultfolio/frontend-document-reader`

### Implementation for User Story 1

- [x] T040 [P] [US1] Implement `libs/retirement/src/lib/parsers/drv-renteninformation.ts` (label-based, column-aware over `PdfLine.words`, applies OCR number normalisation for `RECOGNISED` text, runs `runChecks`, returns `ParseOutcome`)
- [x] T041 [P] [US1] Implement `libs/retirement/src/lib/parsers/private-statement.ts` (Riester/private pension annual statement; scenario table; `missingSupplement`; checks)
- [x] T042 [P] [US1] Implement `libs/retirement/src/lib/parsers/capital-account-statement.ts` (roll-forward and interest checks; `CAPITAL_ACCOUNT`)
- [x] T043 [US1] Implement `libs/retirement/src/lib/parsers/registry.ts` (`PARSERS` with `{id, version, detects, parse}`, `parseStatement(text)`) and export from `libs/retirement/src/index.ts`
- [x] T044 [US1] Implement `apps/backend/src/retirement/retirement.service.ts`: validate via `@vaultfolio/retirement`, re-run `runChecks` for `IMPORTED`, encrypt payload `{identifier, figures, supplement}`, enforce origin rules (create/PUT/PATCH/replace/delete/deleteAll), log only record id, pillar, type, parser id/version, outcome (no figures/identifiers)
- [x] T045 [US1] Implement `apps/backend/src/retirement/retirement.controller.ts`: `GET /retirement/records[?pillar]`, `GET /retirement/records/:id`, `POST /retirement/records`, `PUT /retirement/records/:id`, `PATCH /retirement/records/:id/supplement`, `DELETE /retirement/records/:id`, `DELETE /retirement`; guarded by `@RequiresDomain('retirement')` + `RetirementAvailableGuard`
- [x] T046 [US1] Add OpenAPI documentation: `@Api...` decorators on the controller routes and decorated DTO classes in `apps/backend/src/openapi/dto/retirement.ts` (new tag `retirement`); run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [x] T047 [US1] Run `npm exec nx -- run backend:e2e` (incl. OpenAPI completeness spec) and `npx nx run backend:openapi:check`; fix until green
- [x] T048 [P] [US1] Implement the record form `libs/frontend/domain/retirement/src/lib/record-form/` (type chips, sections Vertrag/Leistungen/Beiträge & Wert, fields adapt per type via the lib's per-type field map, guaranteed vs Prognose labelling, inline `GUARANTEE_ABOVE_EXPECTED` error, create/edit routes `new/:type` and `:id/edit`, supplement-only mode for imported records) with `data-testid`s and a component spec
- [x] T049 [P] [US1] Implement the contract card `libs/frontend/domain/retirement/src/lib/contract-card/` (origin/outdated/incomplete badges, copyable identifier, key-figure grid, scenario tiles for Riester, capital box for capital accounts, "keine Garantie" for depot; imported → only "Durch neues Dokument ersetzen" + "Löschen"; manual → "Bearbeiten" + "Löschen"; guaranteed bold/tag vs italic "≈ … Prognose") with `data-testid`s and spec
- [x] T050 [US1] Implement the pillar views `libs/frontend/domain/retirement/src/lib/pillar/` (statutory single card + 1 %/2 % tiles, occupational and private lists, add buttons, empty states, delete confirmation) wired to `RetirementService`, with spec
- [x] T051 [US1] Implement the import flow `libs/frontend/domain/retirement/src/lib/import/` (store + steps: upload dropzone with privacy note, `<vf-ocr-consent>` for scans, review table with "Plausibilitätsprüfung bestanden" badge and inputs for `missingSupplement` / expected-scenario picker defaulting to 3 %, not-recognised screen with "Manuell eingeben", replace-confirmation when a manual record exists or via card action); sends only whitelisted fields; document/text never leave the device; with `data-testid`s
- [x] T052 [US1] Add `RetirementTranslations` keys for form, cards, import steps and validation messages in `retirement.de.ts`/`retirement.en.ts`; keep the parity spec green
- [x] T053 [US1] Run the `verify-ui` skill: drive manual creation of all four sample records, an upload of a synthetic text PDF, the unrecognised-document path, read-only imported card and delete; confirm in the browser network log that only `POST /retirement/records` carries data (no file/text)

**Checkpoint**: Story 1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Clear overview of the retirement picture (Priority: P1)

**Goal**: Consolidated overview with per-pillar sub-totals, guaranteed vs expected, pension start, monthly savings, empty states and outdated/incomplete flags.

**Independent Test**: With Story 1 data, totals equal the sums of entered figures (guaranteed, expected, savings); removing a pillar's data shows the empty-state hint and excludes it; a statement older than 12 months is flagged.

### Tests for User Story 2

- [ ] T054 [P] [US2] Write `libs/retirement/src/lib/summary.spec.ts` with fixed exact-decimal expectations from research R8 (guaranteed = Σ occupational+private guarantees; expected = statutory projected + Σ max(expected, guaranteed); savings = Σ (own+employer) of ACTIVE contracts; difference; pension start from statutory else earliest + `EARLIEST_CONTRACT`; `startRelation` EARLIER/SAME/LATER; capital separate; outdated via injected `now` (12-month boundary); incomplete; mockup values 403 / 2 860 / 335 reproduced)
- [ ] T055 [P] [US2] Extend `apps/backend/src/tests/retirement.e2e-spec.ts` with `GET /retirement/summary` (empty owner → zeros and `pensionStart: null`; totals equal sums; another owner's records excluded; 503 without key)

### Implementation for User Story 2

- [ ] T056 [US2] Implement `summarize(records, now)` in `libs/retirement/src/lib/summary.ts` (pure, exact decimals, capital never added to monthly sums) and export it
- [ ] T057 [US2] Add `GET /retirement/summary` to `apps/backend/src/retirement/retirement.controller.ts` + service method (decrypt owner rows, `summarize(rows, new Date())`)
- [ ] T058 [US2] Add the `RetirementSummary` response DTO to `apps/backend/src/openapi/dto/retirement.ts` and the route decorators; run `npx nx run backend:openapi` and commit `api/openapi.yml`; run `npx nx run backend:openapi:check`
- [ ] T059 [US2] Implement `libs/frontend/domain/retirement/src/lib/overview/` (four KPI tiles, guaranteed-vs-expected stacked bar with difference badge, three pillar cards with sub-totals and entry rows, empty states per pillar, outdated warn note, capital/gross info note, guaranteed vs Prognose styling, responsive layout per design.md) with `data-testid`s and spec
- [ ] T060 [US2] Add overview translation keys (de/en) and keep parity spec green
- [ ] T061 [US2] Run `verify-ui`: overview totals match cards, empty-state hints, outdated/incomplete badges, mobile width layout

**Checkpoint**: Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Dashboard tile with the key retirement figures (Priority: P2)

**Goal**: Dashboard tile with pension start, guaranteed sum, savings, expected pension and difference; empty state; link to the area.

**Independent Test**: With data, the tile's figures equal the overview; with none, the empty state's call to action opens the Retirement page; an unavailable domain degrades gracefully.

- [ ] T062 [P] [US3] Write `libs/frontend/domain/retirement/src/lib/retirement-dashboard-widget/retirement-dashboard-widget.component.spec.ts` (figures equal service summary, empty variant + link, "n veraltet" badge, 503 → graceful degraded state)
- [ ] T063 [US3] Implement `libs/frontend/domain/retirement/src/lib/retirement-dashboard-widget/` (hero expected pension with Prognose tag, mini guaranteed/expected bar with difference, rows Rentenbeginn / Garantierte Rente / Sparbetrag, whole tile is a link "Zur Altersvorsorge", empty variant "Altersvorsorge erfassen") with `data-testid`s
- [ ] T064 [US3] Register the widget in `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` (`domainId: 'retirement'`, `titleKey: 'dashboard.retirement'`) and add translation keys (de/en)
- [ ] T065 [US3] Run `verify-ui`: tile with data, empty state, click navigates to the overview

**Checkpoint**: Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Further information and external tools (Priority: P3)

**Goal**: Static "Weiterführende Informationen" tab with three cards and a privacy note.

**Independent Test**: Tab shows three cards (DRV, Finanzfluss, Finanztip), each link opens in a new tab with `rel="noopener noreferrer"`; privacy note present.

- [x] T066 [P] [US4] Write `libs/retirement/src/lib/resources.spec.ts` (exactly three entries, `https` only, exact hosts for DRV / Finanzfluss / Finanztip)
- [x] T067 [US4] Implement `RETIREMENT_RESOURCES` in `libs/retirement/src/lib/resources.ts` and export it
- [x] T068 [US4] Implement `libs/frontend/domain/retirement/src/lib/info/` (three cards: category badge, description, source, external link `target="_blank"` with `rel`) and `privacy-note/` (what is stored, amounts/numbers encrypted, operator holds key, links send no data — FR-016; toolbar "So werden deine Daten geschützt" jumps here) with `data-testid`s and spec
- [x] T069 [US4] Add info/privacy translation keys (de/en)
- [x] T070 [US4] Run `verify-ui`: three cards, links open a new tab, Vaultfolio stays open

**Checkpoint**: Stories 1–4 independently functional.

---

## Phase 7: User Story 5 - Altersvorsorgedepot as a private provision type (Priority: P3)

**Goal**: Altersvorsorgedepot recordable as a private contract: contributes to savings, current value and expected pension, never to guaranteed.

**Independent Test**: Add a private Altersvorsorgedepot; it appears under the private pillar, adds to monthly savings and expected pension, adds zero to guaranteed; submitting `guaranteedMonthly` is rejected.

- [ ] T071 [P] [US5] Add depot cases to `libs/retirement/src/lib/validation.spec.ts` and `summary.spec.ts` (no guaranteed contribution; depot with only `currentValue` flagged incomplete if expected missing) and to `apps/backend/src/tests/retirement.e2e-spec.ts` (`guaranteedMonthly` on depot → 400)
- [ ] T072 [US5] Ensure the depot field map in `libs/retirement/src/lib/validation.ts` and `libs/retirement/src/lib/summary.ts` matches the spec (only `currentValue`, optional `expectedMonthly`; counts to savings/expected, zero guaranteed) and fix any gap found by T071
- [ ] T073 [US5] Verify the record form (`record-form/`) offers the depot chip labelled "ab 2027" with only its relevant fields and the card shows "keine Garantie"; add/adjust component spec and translations
- [ ] T074 [US5] Run `verify-ui`: add a depot, check pillar placement and totals

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T075 [P] Replace the empty `RETIREMENT_EXPORT_DEFINITION` in `libs/frontend/domain/retirement/src/lib/retirement-export.definition.ts` with a factory definition (injects `RetirementService`; table columns pillar, type, provider, number, guaranteed, expected, contribution, payout start, statement date, origin) for PDF/Excel/CSV/JSON (FR-019), update `retirement-export.definition.spec.ts`, and register it lazily in `apps/frontend/src/app/export/feature-export.registry.ts` like Earnings
- [ ] T076 [P] Add a "delete all my retirement data" action (FR-015) with confirmation in the retirement area/privacy note, wired to `DELETE /retirement`, with `data-testid` and spec; extend e2e if not covered
- [ ] T077 [P] Document the feature: `RETIREMENT_ENCRYPTION_KEY` and 503 behaviour in `README.md` and `README.de.md`; add upload vs manual entry, read-only imports and supported statement types to `docs/user-guide.md` and `docs/user-guide.de.md`; update `docs/frontend/testid-conventions.md` if new patterns appear
- [ ] T078 [P] Verify no secrets/personal data in the diff: no real PDFs under `libs/**` or `specs/**` (only `tmp/` locally), no amounts/identifiers in log statements (grep `Logger` calls in `apps/backend/src/retirement/`)
- [ ] T079 Run the quickstart.md walkthrough (sections 1–4: libs/backend tests, the ten UI flows via `verify-ui`, key handling incl. missing/different key, privacy checks)
- [ ] T080 Run gates: `npm exec nx -- run-many -t lint test build`, `npm run format:check`, `npx nx run backend:openapi:check`; then `/speckit-coverage` (≥ 80 % per project) and the Sonar steps

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → **Foundational (P2)** → user stories. Within Foundational: T006–T014 (refactor) first; T015–T021 (types/logic) and T022–T029 (backend) can overlap with the frontend-shell tasks after T016/T015 exist; T030–T032 need T015.
- **US1 (P1)** needs all of Foundational. **US2** needs US1's backend records (T044–T045) for e2e and UI; its lib work (T054, T056) only needs T016 and can start earlier. **US3** needs US2 (summary endpoint + service). **US4** needs only Foundational (T032 shell) and is otherwise independent of US1–US3. **US5** builds on US1's form/validation and US2's summary.
- **Polish** after the stories it exports/documents (T075 needs US1 service; T076 needs T045).

### Within stories

Tests first → lib logic → backend → OpenAPI task → frontend → `verify-ui`. OpenAPI regeneration (T046, T058) follows the controller change it covers.

### Story completion order

Foundational → US1 → US2 → US3; US4 may run in parallel to US2/US3; US5 after US2.

## Parallel Examples

**Foundational lib work**: T015, T016, T017, T019, T021 together (different files); then T018, T020.

**US1 parsers**: T033–T037 (tests) together, then T040, T041, T042 together, then T043. In parallel: T038 (e2e) and T039 (store spec), then backend T044→T045 while T048/T049 (form, card) proceed.

**US4**: T066 in parallel with any US2/US3 frontend task.

## Implementation Strategy

### MVP first

Phases 1–3 deliver US1: a user can record all three pillars (manually or via on-device-parsed upload) with encrypted, owner-only storage. Stop and validate with the Story 1 independent test before continuing.

### Incremental delivery

1. Setup + Foundational (refactor first, Earnings stays green).
2. US1 → validate (MVP).
3. US2 overview → validate; US3 tile; US4 info tab; US5 depot polish.
4. Polish: export, delete-all, docs, quickstart, gates.

### Notes

- Parsers never "heal" misread figures; any failed check rejects the document as a whole.
- Logs and error responses carry ids/codes only — never figures or identifiers.
- Commit after each task or logical group; imports from the refactor (T006–T014) should be a separate, behaviour-neutral commit.
