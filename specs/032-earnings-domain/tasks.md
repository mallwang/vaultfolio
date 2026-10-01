---
description: 'Task list for the Earnings domain (032-earnings-domain)'
---

# Tasks: Earnings Domain

**Input**: Design documents from `/specs/032-earnings-domain/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md),
[design.md](design.md) + [mockup.html](mockup.html)

**Tests**: INCLUDED. Constitution Principle III (every money path gets exact-value tests) and
Principle IV (real serialization boundaries: synthetic PDFs through PDF.js, real JSON exports, HTTP
e2e against SQLite) make tests mandatory for this feature. All money assertions use exact decimal
strings (`"1234.56"`), never floats. **Never** commit real payslips, certificates or amounts —
fixtures use invented figures only.

**Organization**: Tasks are grouped by user story. Priority order: US1, US2, US6 (all P1) → US3,
US4, US5 (P2) → US7 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story the task belongs to (US1…US7)

## Path Conventions

- Shared, framework-free logic: `libs/earnings/src/lib/` (`@vaultfolio/earnings`, `scope:shared`)
- API types: `libs/api-contract/src/lib/earnings.ts`
- Frontend domain: `libs/frontend/domain/earnings/src/lib/` (`@vaultfolio/frontend-domain-earnings`,
  `scope:frontend-domain`)
- Backend module: `apps/backend/src/earnings/`; e2e: `apps/backend/src/tests/earnings.e2e-spec.ts`
- Run everything through Nx with npm: `npx nx test @vaultfolio/earnings`, `npx nx test backend`,
  `npx nx test @vaultfolio/frontend-domain-earnings`, `npx nx run-many -t lint typecheck`

## Cross-cutting rules for every task

- Money: canonical decimal strings in every interface, `decimal.js` for arithmetic (research R4).
- Logs/errors: never an amount, document text or personal identifier; `BusinessException` messages
  are fixed sentences, `details` contain only codes, ids, periods, check names (research R14).
- Every repository query filters by `owner_id` (FR-003); admins see only their own rows.
- Every user-visible string goes into `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts`
  **and** `de.ts` under `earnings.*`; use the FR-047 glossary.
- New interactive elements get `data-testid`s per
  [docs/frontend/testid-conventions.md](../../docs/frontend/testid-conventions.md) in the same task.
- Icons via `vf-icon` (Material Symbols); charts via `EchartComponent` from
  `@vaultfolio/frontend-shared-ui`; PrimeNG components per the `primeng:*` skills.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New libraries, the one new dependency, and operator configuration.

- [x] T001 Generate the framework-free library `libs/earnings` (`@vaultfolio/earnings`, Jest, tag `scope:shared`) with the `nx-generate` skill, mirroring `libs/export` (package.json `nx.tags`, `jest.config.cts`, `.spec.swcrc`, `tsconfig.*.json`); add `decimal.js` to its `dependencies`; empty `libs/earnings/src/index.ts`
- [x] T002 Generate the Angular library `libs/frontend/domain/earnings` (`@vaultfolio/frontend-domain-earnings`, tag `scope:frontend-domain`) with the `nx-generate` skill, mirroring `libs/frontend/domain/holdings` (`project.json` test target `@angular/build:unit-test`, package.json with `echarts` dependency); empty `libs/frontend/domain/earnings/src/index.ts`
- [x] T003 Add `pdfjs-dist` at an exact pinned version (no `^`) to the root `package.json` and to `libs/frontend/domain/earnings/package.json` `dependencies`; run `npm install`
- [x] T004 Serve the PDF.js worker from the frontend's own assets (no CDN): add an asset glob copying `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `assets/pdfjs/` in `apps/frontend/project.json` (research R2)
- [x] T005 [P] Document `EARNINGS_ENCRYPTION_KEY` (base64, exactly 32 bytes; generation one-liner; losing it makes amounts unrecoverable) in `.env.example`, and pass it through in `docker-compose.yml` and `docker-compose.portainer.yml`
- [x] T006 [P] Verify `libs/earnings` and `libs/frontend/domain/earnings` are picked up by the root `package.json` workspaces and by `eslint.config.mjs` module-boundary rules (`scope:frontend-domain` → `scope:shared` allowed); adjust `workspaces` only if the generator did not

**Checkpoint**: `npx nx run-many -t lint typecheck -p @vaultfolio/earnings @vaultfolio/frontend-domain-earnings` is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model, checks, validation, API types, storage, encryption, access and the
domain shell. Every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared library core (`libs/earnings`)

- [x] T007 [P] Write exact-value tests for money helpers (parse/format canonical strings, `add`/`sub`/`sum`, cents→decimal `123456`→`"1234.56"`, `-2207`→`"-22.07"`, ratio to 4 dp `"0.6160"`, rejects `1.5`/`"1,00"`/floats) in `libs/earnings/src/lib/model.spec.ts`
- [x] T008 Implement `libs/earnings/src/lib/model.ts`: `Money`, `RecordKind`, `PayRecordAmounts`, `OneOffAmounts`, `EmployerSubsidy`, `YtdAmounts`, `CertificateAmounts`, `PayRecordInput`, `CertificateInput`, `CheckResult`, `ParseError`/`ParseOutcome`, `StoredRecord`/`StoredCertificate`/`EmployerRef`, and `decimal.js` money helpers (per [contracts/earnings-lib.md](contracts/earnings-lib.md), [data-model.md](data-model.md))
- [x] T009 [P] Write tests for `runRecordChecks` (NET pass at exactly ±0.01, fail at 0.02 with signed `difference`, negative correction amounts, voluntary KV/PV own share) and `runPayoutCheck` (Σ(net + other) = payout across a regular + correction section; `payout: null` sections) in `libs/earnings/src/lib/checks.spec.ts`
- [x] T010 Implement `runRecordChecks` and `runPayoutCheck` (research R4) in `libs/earnings/src/lib/checks.ts`
- [x] T011 [P] Write tests for `validateImportFile` in `libs/earnings/src/lib/validation.spec.ts`: unknown key at any depth → `EARNINGS_UNKNOWN_FIELD` with `params.path`; period/issued regex; `REGULAR ⇒ issued = period`, `CORRECTION ⇒ issued > period`; amount regex `^-?\d{1,9}\.\d{2}$`; sha256 regex; fileName ≤ 255 without path separators; ≤ 2,000 records; certificates shape; failing NET/PAYOUT → `CHECK_FAILED` with `check`, `period`, `difference`
- [x] T012 Implement strict whitelist validation `validateImportFile` (records + certificates, all rules in data-model.md "Validation rules", runs the checks from T010) in `libs/earnings/src/lib/validation.ts`
- [x] T013 [P] Implement `PdfDocumentText`/`PdfPageText`/`PdfLine` types and line helpers (find line by label, amount-at-column, German number `1.234,56`→`"1234.56"`, trailing-minus negatives) with tests in `libs/earnings/src/lib/parsers/pdf-text.ts` and `libs/earnings/src/lib/parsers/pdf-text.spec.ts`
- [x] T014 Implement `PARSER_REGISTRY` (initially empty, ordered) and `parseDocument()` (first `detect` wins, none → `UNSUPPORTED_FORMAT`; runs `runRecordChecks` per record and `runPayoutCheck` per payslip; any failure → `CHECK_FAILED`; attaches `parserId`/`parserVersion`) with tests using a stub parser in `libs/earnings/src/lib/parsers/registry.ts` and `libs/earnings/src/lib/parsers/registry.spec.ts`
- [x] T015 Export the public API (model, checks, validation, pdf-text, registry) from `libs/earnings/src/index.ts`

### API contract types

- [x] T016 [P] Declare all request/response/read-model types from [contracts/earnings-api.md](contracts/earnings-api.md) (`EarningsImportBatch`, `EarningsImportFile`, `EarningsImportPreview`, `EarningsImportResult`, `EarningsImportSummary`, `EarningsEmployer`, `EarningsOverview`, `CareerEntry`, `LatestYear`, `YearlyPoint`, `MonthlyPoint`, `EarningsRecordDetail`, `EarningsTables`, `MonthGrid`, `TaxYearRow`, `CertificateRow`, `DataCheckRow`, rejection codes, `EARNINGS_*` error codes) in `libs/api-contract/src/lib/earnings.ts` and export them from `libs/api-contract/src/index.ts`

### Storage, encryption, access (backend)

- [x] T017 Add a `transaction<T>(fn: () => T): T` helper using `better-sqlite3`'s `db.transaction` plus a unit test (commit on success, rollback on throw) in `apps/backend/src/database/database.service.ts` and its spec (research R13)
- [x] T018 Create the four tables `earnings_imports`, `earnings_records`, `earnings_certificates`, `earnings_employers` with CHECK constraints, `UNIQUE` identities and indexes exactly as in [data-model.md](data-model.md) (`CREATE TABLE IF NOT EXISTS` in `initializeSchema()`) in `apps/backend/src/database/database.service.ts`
- [x] T019 [P] Write tests for `EarningsCryptoService` in `apps/backend/src/earnings/earnings-crypto.service.spec.ts`: round-trip of a JSON payload; format `v1:<iv>:<tag>:<ct>`; fresh IV per call (two encryptions differ); AAD binding (decrypting with another row id or owner id fails); tampered tag fails; missing/short/non-base64 key → `available === false`; decrypt/encrypt while unavailable throws the 503 exception
- [x] T020 Implement `EarningsCryptoService` (AES-256-GCM via `node:crypto`, key from `EARNINGS_ENCRYPTION_KEY` validated at boot without crashing the app, `available` flag, `encrypt(table, id, ownerId, payload)`, `decrypt(...)`, auth failure → `BusinessException(503, 'EARNINGS_UNAVAILABLE')`, never logs payloads) in `apps/backend/src/earnings/earnings-crypto.service.ts` (research R5)
- [x] T021 Implement an `EarningsAvailableGuard` (or interceptor) that returns `503 EARNINGS_UNAVAILABLE` for every earnings route when the crypto service is unavailable, with a spec, in `apps/backend/src/earnings/earnings-available.guard.ts` and `apps/backend/src/earnings/earnings-available.guard.spec.ts`
- [x] T022 Implement the base of `EarningsRepository` (owner-scoped): `findOrCreateEmployer(ownerId, detectedName)` (normalized: trim + collapse whitespace), `listEmployers(ownerId)`, `loadRecords(ownerId, employerId?)` and `loadCertificates(ownerId, employerId?)` returning decrypted `StoredRecord`/`StoredCertificate`, `deleteAllForOwner(ownerId)` in a transaction; spec against a temp SQLite file in `apps/backend/src/earnings/earnings.repository.ts` and `apps/backend/src/earnings/earnings.repository.spec.ts`
- [x] T023 Create `EarningsModule`, an empty `EarningsController` (`@Controller('earnings')`, `@RequiresDomain('earnings')`, `EarningsAvailableGuard`) and `EarningsService`; register the module in `apps/backend/src/app/app.module.ts` (files `apps/backend/src/earnings/earnings.module.ts`, `earnings.controller.ts`, `earnings.service.ts`)
- [x] T024 Add `'earnings'` to `KNOWN_DOMAIN_IDS` (not to the `domain_scopes` default) in `apps/backend/src/accounts/accounts.service.ts`, with a spec case that `['earnings']` is an accepted scope
- [x] T025 Purge all four earnings tables for the user in `deleteById` in `apps/backend/src/auth/users.repository.ts`, with a spec case (FR-039)
- [x] T026 Replace Nest's default body parser with explicit parsers in `apps/backend/src/main.ts`: `json({ limit: '5mb' })` for `/earnings/imports*` (respecting the global prefix) before the global `json({ limit: '100kb' })` and `urlencoded`; bootstrap with `bodyParser: false` (research R7)
- [x] T027 [P] Create the Bruno folder `api/bruno/earnings/` with `folder.bru` following `api/bruno/holdings/`

### Frontend shell

- [x] T028 [P] Add the `earnings` entry (label key `nav.earnings`, icon `payments`) to `libs/frontend/domain-access/src/lib/domain-registry.ts`
- [x] T029 [P] Add the base `earnings.*` namespace to `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`: nav/page titles ("Earnings" / "Einkommensentwicklung"), tab names, the FR-047 glossary terms, all API/parser/check error codes (`UNSUPPORTED_FORMAT`, `IMAGE_ONLY`, `PASSWORD_PROTECTED`, `UNREADABLE`, `MISSING_FIELD`, `UNKNOWN_LINE`, `CHECK_FAILED`, `EARNINGS_UNKNOWN_FIELD`, `INVALID_VALUE`, `LIMIT_EXCEEDED`, `EXPORT_UNSUPPORTED_VERSION`, `EXPORT_UNKNOWN_FIELD`, `EARNINGS_UNAVAILABLE`), unavailable-state and empty-state texts
- [x] T030 [P] Add five named earnings series roles (net blue, taxes orange, social teal, regular = primary indigo, bonus red) with light/dark variants, contrast-checked against Aura tokens, plus a spec case in `libs/frontend/shared-ui/src/lib/chart/chart-palette.ts` and `chart-palette.spec.ts`
- [x] T031 Implement `EarningsService` (HTTP client for every `/earnings/*` route, `employer` query param support, maps `503 EARNINGS_UNAVAILABLE` to an `unavailable` signal) with spec in `libs/frontend/domain/earnings/src/lib/earnings.service.ts` and `earnings.service.spec.ts`
- [x] T032 Implement `EarningsAreaComponent` (toolbar slot, sub-tabs Overview / Tables / Data check / Imports via `router-outlet`, key-unavailable state with no toolbar/tabs/figures, empty-state slot) with spec in `libs/frontend/domain/earnings/src/lib/earnings-area/` (follow `holdings-area`)
- [x] T033 Add the `/app/earnings` route with `domainGuard('earnings')`, lazy `EarningsAreaComponent`, child routes `overview` (default), `tables`, `check`, `imports`, and a sibling lazy `import` route (page titles `pageTitle.earnings*`) in `apps/frontend/src/app/app.routes.ts`, plus cases in `app.routes.spec.ts`

**Checkpoint**: Backend boots with and without a key (503 on earnings routes when missing, other domains unaffected); the nav entry shows for entitled users and the empty area renders.

---

## Phase 3: User Story 1 — Import payslips from PDF and see them checked (Priority: P1) 🎯 MVP

**Goal**: Drop SAP "Entgeltnachweis" PDFs, parse them in the browser, preview per file
(new / replaces / duplicate / rejected with reason), confirm, and see the saved imports in the
history — with no document bytes or text leaving the device.

**Independent Test**: Import synthetic payslips (one with a correction section, one duplicate, one
with net off by 12.40, one image-only PDF); the preview shows the right per-file outcome; confirm
saves only the ready files; `GET /earnings/imports` lists exactly those; the network tab shows only
JSON figures.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [x] T034 [P] [US1] Create synthetic SAP Entgeltnachweis text fixtures with invented figures and hand-computed expected records (regular month, payslip with a correction section for an earlier month, payout-only payslip, voluntary KV/PV with employer subsidy, one-off/bonus month, `Y551`/`/552` lines, page break GRUNDDATEN → next header, JAHRESSUMMEN year-to-date, net-off-by-12.40 variant, unknown statutory deduction line) in `libs/earnings/src/lib/testing/sap-entgeltnachweis.fixtures.ts` and document them in `libs/earnings/src/lib/testing/README.md`
- [x] T035 [P] [US1] Write parser tests asserting every field of every expected record exactly (period vs. issued for corrections, kind, seq, oneOff split, own-share KV/PV, `employerSubsidy`, `ytd` only on the regular record, `other` = payout − net, `payout: null` on correction sections, `UNKNOWN_LINE`/`MISSING_FIELD` codes, `detect` false for a certificate/unrelated text) in `libs/earnings/src/lib/parsers/sap-entgeltnachweis.spec.ts`
- [x] T036 [P] [US1] Write `parseDocument` integration tests on the SAP fixtures (net-off file → `CHECK_FAILED` with `check: 'NET'`, period and `"12.40"`; unrelated text → `UNSUPPORTED_FORMAT`) in `libs/earnings/src/lib/parsers/registry.sap.spec.ts`
- [x] T037 [P] [US1] Write backend e2e tests in `apps/backend/src/tests/earnings.e2e-spec.ts` (temp SQLite, test key): preview classifies NEW / REPLACES (with previous `importedAt`, `fileName`) / DUPLICATE (same sha256) / REJECTED (tampered amounts → `CHECK_FAILED`; unknown key → `EARNINGS_UNKNOWN_FIELD` with path); intra-batch identity conflict → later `issued` wins, other flagged via `conflictsWith`; preview writes nothing; commit re-validates and saves NEW/REPLACES per file, skips DUPLICATE/REJECTED; replaced identity leaves one row; `GET /earnings/imports` newest first with derived counts/periods; 5 MB body accepted on `/earnings/imports*` while a >100 kB body is rejected on another route; member without scope → 403
- [x] T038 [P] [US1] Write repository tests for `saveImportFile` (one transaction per file; identity replace; employer created on first mention; `amounts_enc` contains no plain amount; rollback on failure) and `listImports` (derived `recordCount`, `firstPeriod`/`lastPeriod`, employers; fully replaced import shows 0 records) in `apps/backend/src/earnings/earnings.repository.spec.ts`

### Implementation for User Story 1

- [x] T039 [US1] Implement the SAP parser (`id: 'sap-entgeltnachweis'`, `version: '1.0.0'`, `documentType: 'PAYSLIP'`; port of earnings-evolution `extractor/parsers/evosoft.py`: header employer, sections per month, corrections, payout-only, `Y551`/`/552`, voluntary KV/PV own-share rule, JAHRESSUMMEN → `ytd`; identifiers such as tax ID, SV number, IBAN, name, address, personnel number are never read into the output) in `libs/earnings/src/lib/parsers/sap-entgeltnachweis.ts` and register it in `libs/earnings/src/lib/parsers/registry.ts`
- [x] T040 [US1] Add a `toImportFile()` helper that maps a `ParseOutcome` + file metadata (`clientFileId`, `fileName`, `sourceType`, `fileSha256`) to the whitelisted `EarningsImportFile` body, with a test proving no extra keys are emitted, in `libs/earnings/src/lib/import-file.ts` and export it from `libs/earnings/src/index.ts`
- [x] T041 [US1] Implement `EarningsRepository.saveImportFile(ownerId, file)` (inside `DatabaseService.transaction`: insert import row, resolve employers, delete-then-insert records by identity, encrypt each `amounts_enc` with AAD `earnings_records|<id>|<owner_id>`), `findImportBySha(ownerId, sha)`, `findRecordIdentities(ownerId, identities)` and `listImports(ownerId)` in `apps/backend/src/earnings/earnings.repository.ts`
- [x] T042 [US1] Implement `EarningsService.preview(ownerId, batch)` and `commit(ownerId, batch)`: envelope check (`INVALID_BATCH`, ≤ 400 files → `LIMIT_EXCEEDED`), `validateImportFile` per file (FR-013), duplicate/replace/intra-batch-conflict classification, commit re-validates and saves per file, one metadata log line per file `{ event: 'EarningsImport', importId, fileSha256, parserId, parserVersion, records, outcome }` — never amounts, in `apps/backend/src/earnings/earnings.service.ts`
- [x] T043 [US1] Add `POST /earnings/imports/preview`, `POST /earnings/imports` (201) and `GET /earnings/imports` to `apps/backend/src/earnings/earnings.controller.ts` with a controller spec in `apps/backend/src/earnings/earnings.controller.spec.ts`
- [x] T044 [US1] OpenAPI: add `@Api...` decorators to the three routes and decorated DTO classes for `EarningsImportBatch`, `EarningsImportFile`, `EarningsImportPreview`, `EarningsImportResult`, `EarningsImportSummary` in `apps/backend/src/openapi/dto/earnings.ts` (export from `apps/backend/src/openapi/dto/index.ts`); run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [x] T045 [P] [US1] Add Bruno requests `Preview Import.bru`, `Commit Import.bru`, `List Imports.bru` (synthetic body) in `api/bruno/earnings/`
- [x] T046 [US1] Implement the PDF.js adapter `extractPdfText(file: File): Promise<{ text: PdfDocumentText } | { error: 'IMAGE_ONLY' | 'PASSWORD_PROTECTED' | 'UNREADABLE' }>` plus `sha256Hex(file)` via `crypto.subtle` (line reconstruction by baseline y ±2pt, sort by x, keep word x/width; worker from `assets/pdfjs/`) in `libs/frontend/domain/earnings/src/lib/pdf/pdf-text-extractor.ts`
- [x] T047 [US1] Create a test-time synthetic PDF generator with `pdfmake` reproducing the SAP layout from the T034 fixtures (plus an image-only PDF and a password-protected/corrupt byte sample) in `libs/frontend/domain/earnings/src/testing/synthetic-pdfs.ts`, and an adapter integration spec running generated PDFs through the real `pdfjs-dist` → `parseDocument` and asserting exact records, `IMAGE_ONLY`, `PASSWORD_PROTECTED`/`UNREADABLE` in `libs/frontend/domain/earnings/src/lib/pdf/pdf-text-extractor.spec.ts`
- [x] T048 [US1] Implement an `ImportSessionStore` (signal-based: per-file state local-rejected / reading / candidate / previewed; sequential parsing with yield between files so the page stays responsive; progress "Read n of m"; builds the batch from candidates only; calls preview then commit; merges local and server outcomes) with spec in `libs/frontend/domain/earnings/src/lib/import/import-session.store.ts`
- [x] T049 [US1] Implement `EarningsImportComponent` per design.md "Import screen": back link, dropzone + "Choose files" (multi, `.pdf`), device banner, progress bar, file rows (status icon, file name + format · employer, periods with "includes correction" tag, checks result, status tag New / Replaces / Duplicate / Rejected / conflict note, replace/duplicate/rejection sub-lines with translated reason naming check, month and difference, image-only hint pointing to the companion-tool export), expandable "Figures that will be sent" grid, footer summary chips + Cancel + primary "Import n files"; clears the preview after success; `data-testid`s on dropzone, file rows, status tags, confirm; spec in `libs/frontend/domain/earnings/src/lib/import/`
- [x] T050 [US1] Implement a minimal `EarningsImportsComponent` (Imports tab) with the import history table (file, type, periods, records, "Read with" parser@version, imported date) with spec in `libs/frontend/domain/earnings/src/lib/imports/`; add the "Import documents" primary toolbar button in `EarningsAreaComponent`
- [x] T051 [US1] Add all import-screen and history texts (formats, statuses, rejection reasons with `{check}`, `{period}`, `{difference}` params, progress, summary chips) to `en.ts` and `de.ts`
- [x] T052 [US1] Export `EarningsAreaComponent`, `EarningsImportComponent`, `EarningsImportsComponent` from `libs/frontend/domain/earnings/src/index.ts`
- [x] T053 [US1] Verify US1 with the `verify-ui` skill (quickstart §4 table rows for SAP files, duplicate, net-off, image-only), EN/DE; confirm in the network log that only JSON figures are sent (SC-004)

**Checkpoint**: US1 is fully functional — payslips can be imported and appear in the history.

---

## Phase 4: User Story 2 — See how my earnings developed over the years (Priority: P1)

**Goal**: Career accordion, latest-year KPIs, three charts, month detail statement, year × month
grid, taxes per year, employer filter, empty state.

**Independent Test**: Seed a known record set (two employers, several years, bonus months, a
correction) and verify every total, ratio and chart value against hand-computed expectations in EN
and DE.

### Tests for User Story 2 ⚠️

- [x] T054 [P] [US2] Create an aggregation fixture set with invented figures (two employers 2012–2026, employer change, bonus months, a negative correction, a payout-only month, incomplete latest year of 9 months) and hand-computed expected results in `libs/earnings/src/lib/testing/aggregation.fixtures.ts` (add expected values to `libs/earnings/src/lib/testing/README.md`)
- [x] T055 [P] [US2] Write exact-value tests for `monthlySeries` (sums regular + corrections + payout-only per period; regular/bonus split; `hasCorrection`), `yearlySeries` (months employed excludes payout-only; ratios 4 dp) in `libs/earnings/src/lib/aggregations/series.spec.ts`
- [x] T056 [P] [US2] Write exact-value tests for `careerSummary` (ALL entry only with > 1 employer; per-month averages over months employed; net ratio) and `latestYearComparison` (months 1..n vs. same months of previous year; `null` without data; `comparedMonths`) in `libs/earnings/src/lib/aggregations/career.spec.ts`
- [x] T057 [P] [US2] Write exact-value tests for `monthGrid` (every metric, `bonusPeriods`, `missingPeriods` only inside an employment year) and `taxesPerYear` (per year per employer, all columns, ratios) in `libs/earnings/src/lib/aggregations/tables.spec.ts`
- [x] T058 [P] [US2] Extend `apps/backend/src/tests/earnings.e2e-spec.ts`: after importing synthetic files, `GET /earnings/overview`, `/earnings/records?period=`, `/earnings/records` (all), `/earnings/tables` return exact expected values; `?employer=` filters each read model; `hasData: false` for a new user; invalid `period` → 400

### Implementation for User Story 2

- [x] T059 [P] [US2] Implement `monthlySeries` and `yearlySeries` in `libs/earnings/src/lib/aggregations/series.ts`
- [x] T060 [P] [US2] Implement `careerSummary` and `latestYearComparison` in `libs/earnings/src/lib/aggregations/career.ts`
- [x] T061 [P] [US2] Implement `monthGrid` and `taxesPerYear` in `libs/earnings/src/lib/aggregations/tables.ts`
- [x] T062 [US2] Export aggregations (`libs/earnings/src/lib/aggregations/index.ts`) from `libs/earnings/src/index.ts`
- [x] T063 [US2] Implement `EarningsService.overview(ownerId, employerId?)` (incl. `employerChanges`; `dataCheckIssues: 0` until US3), `records(ownerId, period?)` (ordered by `seq`, with `employerLabel`, `import: { id, fileName }`, `amounts` incl. checks), `tables(ownerId, employerId?)` (certificates `[]` until US3) in `apps/backend/src/earnings/earnings.service.ts`, repository helpers as needed in `earnings.repository.ts`
- [x] T064 [US2] Add `GET /earnings/overview`, `GET /earnings/records`, `GET /earnings/tables` (query validation for `employer`, `period`) to `apps/backend/src/earnings/earnings.controller.ts` and its spec
- [x] T065 [US2] OpenAPI: decorators for the three read routes and DTOs `EarningsOverview`, `CareerEntry`, `LatestYear`, `YearlyPoint`, `MonthlyPoint`, `EarningsRecordDetail`, `EarningsTables`, `MonthGrid`, `TaxYearRow` in `apps/backend/src/openapi/dto/earnings.ts`; run `npx nx run backend:openapi` and commit `api/openapi.yml`
- [x] T066 [P] [US2] Add Bruno requests `Overview.bru`, `Records.bru`, `Tables.bru` in `api/bruno/earnings/`
- [x] T067 [US2] Implement the employer filter (All / one; `data-testid="earnings-employer-filter"`) in the `EarningsAreaComponent` toolbar, shared via a signal in `libs/frontend/domain/earnings/src/lib/earnings-area/earnings-filter.store.ts` and passed to every read call
- [x] T068 [P] [US2] Implement `CareerSummaryComponent` (accordion: "Whole career" open by default only with > 1 employer, one row per employer, six mini tiles with Ø per month) with spec in `libs/frontend/domain/earnings/src/lib/overview/career-summary/`
- [x] T069 [P] [US2] Implement `LatestYearKpisComponent` ("2026 (9 months)" heading, "compared with the same months of 2025 (Jan–Sep)", six tiles with delta arrow, good/bad coloring per design.md, net ratio delta in percentage points) with spec in `libs/frontend/domain/earnings/src/lib/overview/latest-year-kpis/`
- [x] T070 [P] [US2] Implement chart option builders (pure functions, spec'd) for gross per year (stacked regular + bonus, Total / Per month employed toggle), month-by-month (net + taxes + social stacked, bonus dot, dashed employer-change markers, 1Y/3Y/All with default 3Y, selected month outlined), deduction ratios (taxes % and social % lines, last value labeled) using the T030 palette roles in `libs/frontend/domain/earnings/src/lib/overview/charts/`
- [x] T071 [P] [US2] Implement `MonthDetailComponent` (heading month, "N payslip sections · Gross · Net", per section: employer, kind tag, "issued <month>" for corrections, source file name, check status, statement Regular pay/Back pay → Gross → Taxes (expandable) → Social insurance (expandable) → Statutory net → Other (correction: "Paid out with the <month> payslip") → Payout, residual line for any non-itemized difference, deductions negative) with spec in `libs/frontend/domain/earnings/src/lib/overview/month-detail/`
- [x] T072 [US2] Implement `EarningsOverviewComponent` composing T068–T071 (charts via `EchartComponent`, click on a month bar selects the month and loads `/earnings/records?period=`, `?month=YYYY-MM` query param selects the month, two-column row stacking on mobile) and the empty state (icon, "No earnings yet", no-typing explanation, "Import documents", format chips) with spec in `libs/frontend/domain/earnings/src/lib/overview/`
- [x] T073 [US2] Implement `EarningsTablesComponent` with the month grid (metric select, red dot for bonus months, red "!" for missing months, "–" outside employment, row Sum, cells navigate to `overview?month=`) and the taxes-per-year table (horizontal scroll inside its own container) with spec in `libs/frontend/domain/earnings/src/lib/tables/`
- [x] T074 [US2] Add all overview, chart (legends, tooltips, axis), month-detail, grid and taxes-table texts to `en.ts` and `de.ts`; locale formatting of amounts/percentages/months via the existing i18n formatting helpers (FR-048)
- [x] T075 [US2] Wire `EarningsOverviewComponent` and `EarningsTablesComponent` into the child routes in `apps/frontend/src/app/app.routes.ts` and export them from `libs/frontend/domain/earnings/src/index.ts`
- [x] T076 [US2] Verify US2 with the `verify-ui` skill: seeded synthetic data, values match the fixture README, employer filter, month click → detail, grid cell → detail, EN/DE, light/dark, 400 px viewport (no page scroll; tables/statement scroll in their containers)

**Checkpoint**: US1 + US2 deliver the core product: import and insight.

---

## Phase 5: User Story 6 — Earnings stays private, even from administrators (Priority: P1)

**Goal**: Prove and surface owner-only access, encryption at rest, log hygiene, fail-closed
behavior and the privacy note.

**Independent Test**: As user A import data; user B and an admin retrieve none of it through any
route; the DB file shows no readable amount; import logs contain only metadata; without a key the
domain shows "temporarily unavailable".

### Tests for User Story 6 ⚠️

- [x] T077 [P] [US6] Extend `apps/backend/src/tests/earnings.e2e-spec.ts` with isolation cases: member A imports; member B (entitled) and an admin call every `GET /earnings/*` → only their own (empty) data; B's `DELETE /earnings/imports/<A's id>` and `PUT /earnings/employers/<A's id>` → 404 (run once US5 routes exist; mark pending until then); member without scope → 403 on every route (SC-005)
- [x] T078 [P] [US6] Add an e2e case that reads the raw SQLite file bytes after an import and asserts none of the imported amounts (in `1234.56`, `1.234,56` and cents forms) appears anywhere (SC-006)
- [x] T079 [P] [US6] Add an e2e case capturing backend log output during preview, commit (success and `CHECK_FAILED`) and read calls, asserting it contains no amount, no `difference` value, no employer-document text, and exactly one `EarningsImport` metadata line per saved file (FR-043)
- [x] T080 [P] [US6] Add an e2e case booting without `EARNINGS_ENCRYPTION_KEY` and with a different key over existing data: every earnings route → `503 EARNINGS_UNAVAILABLE` (no partial data), `/holdings` still works (FR-044)

### Implementation for User Story 6

- [x] T081 [US6] Fix any finding from T077–T080 in `apps/backend/src/earnings/` (owner filter, 503 mapping, log fields); ensure `GlobalExceptionFilter` 5xx logging of earnings errors carries no payload
- [x] T082 [P] [US6] Implement `PrivacyNoteComponent` (three cards: "Documents stay on your device", "Only figures, no identifiers" incl. encryption at rest, "Only you can see it" incl. administrators, operator runs the server and holds the key, how to delete) with spec in `libs/frontend/domain/earnings/src/lib/privacy-note/`; add its EN/DE texts (FR-042)
- [x] T083 [US6] Place the privacy note on the Imports tab (anchor `#privacy`) and in the empty state; add the toolbar link "How your data is protected" jumping to it, in `earnings-area/`, `imports/`, `overview/`
- [x] T084 [US6] Ensure the frontend key-unavailable state (from T032) also hides the "Import documents" button and blocks the `import` route; add a spec case and verify with `verify-ui` (quickstart §2)

**Checkpoint**: All P1 stories done — the MVP can ship.

---

## Phase 6: User Story 3 — Verify yearly totals against the wage-tax certificate (Priority: P2)

**Goal**: Import wage-tax certificates of any employer; show a certificates table and a per-year
data check (YTD, certificate, completeness, late corrections).

**Independent Test**: Import a year of synthetic payslips plus that year's certificate → all
checks match; delete one month's import → completeness reports the gap.

### Tests for User Story 3 ⚠️

- [x] T085 [P] [US3] Create synthetic Lohnsteuerbescheinigung text fixtures (official form line numbers 3–6, 10–13, 22a, 23a, 24a, 24c, 25–27; two different employer layouts of the same form; missing lines → `"0.00"`) with expected `CertificateAmounts` in `libs/earnings/src/lib/testing/lohnsteuerbescheinigung.fixtures.ts`
- [x] T086 [P] [US3] Write parser tests (exact amounts, year, employer, `detect` true only for the certificate, registry order: certificate before SAP) in `libs/earnings/src/lib/parsers/lohnsteuerbescheinigung.spec.ts`
- [x] T087 [P] [US3] Write exact-value tests for `dataCheck` (YTD vs. last regular record by highest `issued`/`period`/`seq`; certificate comparison adding lines 10–13; `NOT_AVAILABLE`; completeness with mid-year join/leave; correction for a not-yet-imported month → MISSING; late corrections excluded from both comparisons and listed; `differing` holds field names only) in `libs/earnings/src/lib/aggregations/data-check.spec.ts`
- [x] T088 [P] [US3] Extend `apps/backend/src/tests/earnings.e2e-spec.ts`: certificate import (preview `years`, commit, re-import same employer+year replaces), `GET /earnings/tables` certificates, `GET /earnings/data-check`, `overview.dataCheckIssues`, deleting a payslip import turns the check into MISSING without touching the certificate

### Implementation for User Story 3

- [x] T089 [US3] Implement the certificate parser (`id: 'lohnsteuerbescheinigung'`, `version: '1.0.0'`, `documentType: 'CERTIFICATE'`, line-number based, any employer) in `libs/earnings/src/lib/parsers/lohnsteuerbescheinigung.ts`; register it first in `PARSER_REGISTRY`
- [x] T090 [US3] Implement `dataCheck` in `libs/earnings/src/lib/aggregations/data-check.ts` and export it
- [x] T091 [US3] Extend `EarningsRepository.saveImportFile` for certificates (identity `(owner_id, employer_id, year)` replace, AAD `earnings_certificates|<id>|<owner_id>`) and `listImports` for `certificateCount`/`years` in `apps/backend/src/earnings/earnings.repository.ts` (+ spec cases)
- [x] T092 [US3] Implement `EarningsService.dataCheck(ownerId, employerId?)`, fill `overview.dataCheckIssues` and `tables.certificates` in `apps/backend/src/earnings/earnings.service.ts`; add `GET /earnings/data-check` to `earnings.controller.ts` (+ spec)
- [x] T093 [US3] OpenAPI: decorator for `GET /earnings/data-check` and DTOs `DataCheckRow`, `CertificateRow`, `CertificateAmounts` in `apps/backend/src/openapi/dto/earnings.ts`; run `npx nx run backend:openapi` and commit `api/openapi.yml`
- [x] T094 [P] [US3] Add Bruno request `Data Check.bru` in `api/bruno/earnings/`
- [x] T095 [P] [US3] Extend the synthetic PDF generator and adapter spec with a certificate PDF through real `pdfjs-dist` → `parseDocument` in `libs/frontend/domain/earnings/src/testing/synthetic-pdfs.ts` and `pdf/pdf-text-extractor.spec.ts`
- [x] T096 [US3] Show certificate files in the import screen (format label "Wage-tax certificate (Lohnsteuerbescheinigung)", year instead of periods) in `libs/frontend/domain/earnings/src/lib/import/`
- [x] T097 [US3] Implement `EarningsDataCheckComponent` (warning strip with actionable hint, table per employer and year: YTD ✓/✗ with counts, certificate ✓/✗/"– not available", months complete ✓/✗ with missing months, late-correction exclusion note) with spec in `libs/frontend/domain/earnings/src/lib/data-check/`; wire the `check` child route
- [x] T098 [US3] Add the wage-tax certificates table with sum row to `EarningsTablesComponent`, the data-check warning strip ("Open data check") to `EarningsOverviewComponent`, and the warning count badge on the Data check tab in `EarningsAreaComponent`
- [x] T099 [US3] Add all data-check and certificate texts to `en.ts` and `de.ts`
- [x] T100 [US3] Verify US3 with the `verify-ui` skill (import year + certificate → all ✓; delete one month → gap, badge, strip), EN/DE

**Checkpoint**: Data is verifiable against YTD totals and certificates.

---

## Phase 7: User Story 4 — Historic and scanned payslips via the companion export (Priority: P2)

**Goal**: Import `earnings-export` v1 JSON files through the same pipeline.

**Independent Test**: Import a synthetic v1 export → records appear with exact amounts; unknown
version, unknown field, or failing check → rejected.

### Tests for User Story 4 ⚠️

- [x] T101 [P] [US4] Create synthetic export fixtures (valid v1 with regular/correction/payout-only records, one_off, employer_share, ytd, certificates; version 2; extra `notes`/`source`/`items` keys at top, record and amounts level; a record failing NET; non-integer cents) in `libs/earnings/src/lib/testing/export-v1.fixtures.ts`
- [x] T102 [P] [US4] Write tests for `readEarningsExport` (exact cents → decimal mapping incl. negatives, snake_case → camelCase, kinds, missing key = `"0.00"`, `payout: null`, payout check per `(employer, issued)` group, `EXPORT_UNSUPPORTED_VERSION`, `EXPORT_UNKNOWN_FIELD` with path, `INVALID_VALUE`, `CHECK_FAILED`) in `libs/earnings/src/lib/export-v1.spec.ts`
- [x] T103 [P] [US4] Extend `apps/backend/src/tests/earnings.e2e-spec.ts` with an `EXPORT_JSON` file (`parserId: 'earnings-export'`, `parserVersion: '1'`) importing ≈ 170 records (> 100 kB body) successfully

### Implementation for User Story 4

- [x] T104 [US4] Implement `readEarningsExport(json)` per [contracts/earnings-export-v1.md](contracts/earnings-export-v1.md) in `libs/earnings/src/lib/export-v1.ts` and export it
- [x] T105 [US4] Accept `.json` in the dropzone and route JSON files through `readEarningsExport` (UTF-8 read, `JSON.parse` failure → `UNREADABLE`, sha256 of the bytes) in `libs/frontend/domain/earnings/src/lib/import/import-session.store.ts` and the import component (format chip "Companion-tool export", periods range, supported-version message)
- [x] T106 [US4] Add export-reader texts (`EXPORT_UNSUPPORTED_VERSION` naming version 1, `EXPORT_UNKNOWN_FIELD` with path) to `en.ts` and `de.ts`
- [x] T107 [US4] Verify US4 with the `verify-ui` skill using the synthetic export and the version-2 / extra-field fixtures

**Checkpoint**: Full career history (incl. scan-era years) can be brought in.

---

## Phase 8: User Story 5 — Manage and delete my earnings data (Priority: P2)

**Goal**: Delete a single import, delete everything, rename employers, export the domain's data.

**Independent Test**: Several imports; delete one → only its records disappear everywhere; delete
all → empty state; rename employer → all views use the new name, no figure changes.

### Tests for User Story 5 ⚠️

- [x] T108 [P] [US5] Write repository tests for `deleteImport` (removes exactly its remaining records/certificates, removes orphaned employers, keeps other imports' records; other owner's id → not found) and `renameEmployer` (trim, 1–120 chars, empty → `null`) in `apps/backend/src/earnings/earnings.repository.spec.ts`
- [x] T109 [P] [US5] Extend `apps/backend/src/tests/earnings.e2e-spec.ts`: `DELETE /earnings/imports/:id` 204/404, `DELETE /earnings` 204 → `hasData: false`, `GET /earnings/employers`, `PUT /earnings/employers/:id` (rename reflected in overview labels; unknown body keys rejected; 404 for another user's id); un-pend the T077 cross-user delete/rename cases

### Implementation for User Story 5

- [x] T110 [US5] Implement `deleteImport`, `renameEmployer` (and reuse `deleteAllForOwner`) in `apps/backend/src/earnings/earnings.repository.ts`, the matching service methods in `earnings.service.ts`, and `DELETE /earnings/imports/:id`, `DELETE /earnings`, `GET /earnings/employers`, `PUT /earnings/employers/:id` in `earnings.controller.ts` (+ spec)
- [x] T111 [US5] OpenAPI: decorators for the four routes and DTOs `EarningsEmployer`, `RenameEarningsEmployer` in `apps/backend/src/openapi/dto/earnings.ts`; run `npx nx run backend:openapi` and commit `api/openapi.yml`
- [x] T112 [P] [US5] Add Bruno requests `Delete Import.bru`, `Delete All.bru`, `List Employers.bru`, `Rename Employer.bru` in `api/bruno/earnings/`
- [x] T113 [US5] Complete `EarningsImportsComponent`: delete icon per history row with the app's confirm-dialog pattern, "Employer names" section ("Detected as …", display-name input, Save, figures-not-editable copy), danger zone "Delete all earnings data" with confirm, refresh all views afterwards; `data-testid`s on delete buttons, rename inputs, danger action; spec in `libs/frontend/domain/earnings/src/lib/imports/`
- [x] T114 [US5] Implement `earnings-export.definition.ts` (029 `FeatureExportDefinition`; `fetchData()` → `GET /earnings/records` all periods; columns per FR-017 incl. employer label, kind, period, issued) with spec in `libs/frontend/domain/earnings/src/lib/`; register it in `apps/frontend/src/app/export/feature-export.registry.ts` (+ spec); add the "Export" info-severity button left of "Import documents" in the toolbar
- [x] T115 [US5] Add history-delete, employer-rename, danger-zone and export texts to `en.ts` and `de.ts`
- [x] T116 [US5] Verify US5 with the `verify-ui` skill (delete one import, rename, delete all → empty state in < 1 min, export archive contains `earnings/`)

**Checkpoint**: Users are in full control of their data.

---

## Phase 9: User Story 7 — Latest-year summary on the dashboard (Priority: P3)

**Goal**: Optional dashboard widget with latest-year gross, net and net ratio vs. same months of the
previous year.

**Independent Test**: Entitled user with data sees the same values as the overview KPI tiles;
non-entitled user is offered no widget.

- [x] T117 [P] [US7] Implement `EarningsDashboardWidgetComponent` (card "Earnings <year>", "Open ›" link to `/app/earnings`, gross, net with delta, net ratio with "Jan–Sep" caption; empty and unavailable states render compactly) using `GET /earnings/overview` `latestYear`, with spec in `libs/frontend/domain/earnings/src/lib/earnings-dashboard-widget/`; export it from `libs/frontend/domain/earnings/src/index.ts`
- [x] T118 [US7] Register the widget (`domainId: 'earnings'`, `titleKey: 'dashboard.earnings'`) in `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` (+ spec case: absent for non-entitled users); add EN/DE texts
- [x] T119 [US7] Verify US7 with the `verify-ui` skill (values equal the KPI tiles; member without scope sees no widget)

**Checkpoint**: All user stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T120 [P] Implement the local-only parity script `tools/earnings/parity-check.mjs` (reads `EARNINGS_PARITY_PDF_DIR` and `EARNINGS_PARITY_JSON`, runs the TS parsers via the PDF.js adapter logic in Node, compares every record with earnings-evolution's `earnings.json`, prints only counts and field names — never amounts); not part of CI (research R9, quickstart §6)
- [x] T121 [P] Document the Earnings domain (what it does, supported formats, privacy/threat model, key management and loss, entitlement) in `README.md`/`README.de.md` and a user-facing section in `docs/user-guide.md`/`docs/user-guide.de.md`
- [x] T122 [P] Add a translation completeness spec asserting every `earnings.*` key exists in both `en.ts` and `de.ts` (or extend the existing parity spec) in `libs/frontend/shared-ui/src/lib/i18n/` (SC-008)
- [x] T123 Performance check: parse a synthetic payslip PDF in < 300 ms in the browser; 260 synthetic files keep the page responsive with visible progress; read models for ≈ 200 months respond in < 300 ms — record results in `specs/032-earnings-domain/quickstart.md` notes if tuning was needed
- [x] T124 Confirm the PDF.js chunk is lazy (not in the main bundle) via `npx nx build frontend` output stats; confirm the worker loads from `assets/pdfjs/`
- [x] T125 Run `npx nx run-many -t lint typecheck test` and `npx nx run backend:openapi:check`; fix all findings
- [x] T126 Run the full [quickstart.md](quickstart.md) validation (§1–§5, §7, §8) end to end, including the `verify-ui` pass across EN/DE, light/dark and 400 px

---

## Phase 11: Additional payslip format — Deutsche Bundesbank (Priority: P2)

**Purpose**: Second employer format for the payslip parser registry, ported from earnings-evolution
`extractor/parsers/bundesbank.py`. The "Verdienstabrechnung" text layer prints every character as its
own text run (`L o h n s t e u e r`) and the Betrag/year-to-date columns as cents without decimal
separator (`1375-` = 13,75), so the parser regroups the spaced characters into words and classifies
numbers by the right edge of their column (Lohnart, rate, Betrag, formatted EBV/EBR, year-to-date).

- [x] T127 [P] [US1] Create synthetic Bundesbank "Verdienstabrechnung" fixtures with invented figures and hand-computed expected records (regular month with Arbg. shares and year-to-date column, bonus month with one-off lines `441`/`643`/`644` and `EGA` table row, correction statement `MM.YY/N MM.YY` with `period` ≠ `issued`, net-off-by-12.40 variant, personal data in the letterhead that must never reach the output) as positioned, character-spaced words in `libs/earnings/src/lib/testing/bundesbank-verdienstabrechnung.fixtures.ts` and document them in `libs/earnings/src/lib/testing/README.md`
- [x] T128 [P] [US1] Write parser tests asserting every field of every expected record exactly (`gross` = Gesamtbrutto EBV/EBR, `net` = Netto EBV/EBR, `other` derived from Zahlnetto, Übertrag and deductions so the PAYOUT check is meaningful, `ytd` only on the regular record, correction → `payout: null`, `other` = −net, `CHECK_FAILED` for the net-off file, `detect` false for SAP/certificate/unrelated text, no personal identifier in the serialized outcome) in `libs/earnings/src/lib/parsers/bundesbank-verdienstabrechnung.spec.ts`
- [x] T129 [US1] Implement the Bundesbank parser (`id: 'bundesbank-verdienstabrechnung'`, `version: '1.0.0'`, `documentType: 'PAYSLIP'`) in `libs/earnings/src/lib/parsers/bundesbank-verdienstabrechnung.ts`, register it after the SAP parser in `libs/earnings/src/lib/parsers/registry.ts` and add an end-to-end `parseDocument` case to `libs/earnings/src/lib/parsers/registry.sap.spec.ts`'s sibling `registry.bundesbank.spec.ts`
- [x] T130 [US1] Run the local parity check (`tools/earnings/parity-check.mjs`, counts only) against earnings-evolution's `payslips/bundesbank` and `data/earnings.json`; expected differences only: `ytd` of correction files (Vaultfolio keeps year-to-date on regular records only) and the five 2011 scans that earnings-evolution corrects with manual OCR overrides (rejected or read with a wrong Steuer-Brutto; the companion export covers them) (research R9, quickstart §6)

---

## Phase 12: Additional payslip format — Bundeswehr (Priority: P2)

**Purpose**: Third employer format for the payslip parser registry, ported from earnings-evolution
`extractor/parsers/bundeswehr.py`. The "Wehrsoldabrechnungsbeleg" is tax- and contribution-free
(`gross = net`); every table line carries its own entitlement month, so lines of earlier months become
`CORRECTION` records. The scans' OCR text layer sets label, amounts and header year a few points apart,
so lines within 5.5 points are merged into one row before parsing.

- [x] T131 [P] [US1] Create synthetic Bundeswehr fixtures with invented figures and hand-computed expected records (regular month with corrections and an attached travel-expense page, two statements of one month, superseded statement, one-off pay, payout-only month, derived payout, wrong payout, OCR-damaged header) in `libs/earnings/src/lib/testing/bundeswehr-wehrsoldabrechnung.fixtures.ts` and document them in `libs/earnings/src/lib/testing/README.md`
- [x] T132 [P] [US1] Write parser tests in `libs/earnings/src/lib/parsers/bundeswehr-wehrsoldabrechnung.spec.ts` (every field exactly, merged statements, zero tax/social fields, no personal identifier in the outcome, `detect`, skewed-scan layout, header month taken from the file) and the end-to-end `registry.bundeswehr.spec.ts`
- [x] T133 [US1] Implement the Bundeswehr parser (`id: 'bundeswehr-wehrsoldabrechnung'`, `version: '1.0.0'`, `documentType: 'PAYSLIP'`) in `libs/earnings/src/lib/parsers/bundeswehr-wehrsoldabrechnung.ts` and register it last in `libs/earnings/src/lib/parsers/registry.ts`
- [x] T134 [US1] Run the local parity check against earnings-evolution's `payslips/bundeswehr` and `data/earnings.json`: all 10 monthly PDFs parse and every regular record matches; expected differences only: corrections carry `seq = 1 + months between period and issued` (earnings-evolution: 1), statements of one issue month are merged into one record (earnings-evolution keeps an extra `payout_only` record for 2011-01), and the `_scans` collection PDFs are image-only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — BLOCKS all user stories
- **US1 (Phase 3)**, **US2 (Phase 4)**: after Foundational; independent of each other (US2 tests seed data via the repository/e2e import route, US2 UI can use seeded data)
- **US6 (Phase 5)**: after US1 (needs an import route to create data); its delete/rename isolation cases complete with US5
- **US3 (Phase 6)**: after US1 (import pipeline) — data-check UI builds on US2's tables/overview components
- **US4 (Phase 7)**: after US1 (import pipeline); independent of US2/US3
- **US5 (Phase 8)**: after US1 (imports tab and history)
- **US7 (Phase 9)**: after US2 (overview `latestYear`)
- **Polish (Phase 10)**: after all desired stories

### Within Each User Story

- Fixtures and tests first (they must fail), then shared-lib logic → repository → service →
  controller → OpenAPI/Bruno → frontend → translations → `verify-ui`
- Tasks editing the same file (`earnings.service.ts`, `earnings.controller.ts`, `en.ts`/`de.ts`,
  `earnings.e2e-spec.ts`) are sequential across stories

### Parallel Opportunities

- Setup: T005, T006
- Foundational: T007/T009/T011/T013 (lib tests), T016, T019, T027, T028–T030 in parallel; T017 → T018 → T022 sequential (same file / dependency)
- US1: T034–T038 all in parallel; T045 alongside T046–T047
- US2: T054–T058 in parallel; T059–T061 in parallel; T068–T071 in parallel
- US6: T077–T080 in parallel; T082 alongside
- US3/US4/US5 can proceed in parallel after US1 if staffed (watch shared files noted above)

---

## Parallel Example: User Story 1

```bash
# Fixtures and failing tests together:
Task: "T034 Synthetic SAP fixtures in libs/earnings/src/lib/testing/sap-entgeltnachweis.fixtures.ts"
Task: "T035 SAP parser tests in libs/earnings/src/lib/parsers/sap-entgeltnachweis.spec.ts"
Task: "T037 Import e2e tests in apps/backend/src/tests/earnings.e2e-spec.ts"
Task: "T038 Repository saveImportFile/listImports tests in apps/backend/src/earnings/earnings.repository.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T059 monthlySeries/yearlySeries in libs/earnings/src/lib/aggregations/series.ts"
Task: "T060 careerSummary/latestYearComparison in libs/earnings/src/lib/aggregations/career.ts"
Task: "T061 monthGrid/taxesPerYear in libs/earnings/src/lib/aggregations/tables.ts"
# then UI building blocks:
Task: "T068 CareerSummaryComponent"  Task: "T069 LatestYearKpisComponent"
Task: "T070 chart option builders"   Task: "T071 MonthDetailComponent"
```

---

## Implementation Strategy

### MVP (P1 stories)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (import) → validate independently
3. Phase 4 US2 (overview) → validate independently
4. Phase 5 US6 (privacy guarantees) → **ship gate**: nothing is released without US6 passing,
   because the domain stores highly sensitive data

### Incremental Delivery

5. US3 (certificates + data check) → US4 (companion export) → US5 (manage/delete/export) → US7
   (dashboard widget), each validated independently with `verify-ui`
6. Polish, including the local parity run against real payslips (SC-002) before release

---

## Notes

- [P] = different files, no dependency on an incomplete task
- Commit after each task or logical group; the `speckit-git-commit` hooks handle phase commits
- Stop at each checkpoint to validate the story independently
- Never commit real documents, real amounts, or a real `EARNINGS_ENCRYPTION_KEY`

---

## Phase 13: Convergence

- [x] T135 Document the Bundesbank and Bundeswehr payslip formats in the supported-formats sections of `README.md`, `README.de.md`, `docs/user-guide.md` and `docs/user-guide.de.md` (currently only the SAP payslip and the wage-tax certificate are named) per T121 (partial)
- [x] T136 Reconcile the spec's "Iteration scope" assumption (SAP + wage-tax certificate only) with the shipped Bundesbank and Bundeswehr parsers of Phases 11–12 — update `spec.md` Assumptions and the parser mentions in `plan.md`/`design.md` (unrequested)
- [x] T137 Record the imports-history behaviour (grouped by data year, all years collapsed on load, "Expand all"/"Collapse all" toggle) in `design.md` "Imports tab" and `spec.md` (FR-021 history), then verify it with the `verify-ui` skill (EN/DE, light/dark) per FR-021 (unrequested)

---

## Phase 14: Correct misread figures in the import preview (issue #63, Priority: P2)

**Story**: extends US1 (import with checks) — spec FR-004, FR-012, FR-012a, FR-013, FR-021;
decisions in [research.md](research.md) R15–R16; contracts in
[earnings-lib.md](contracts/earnings-lib.md) and [earnings-api.md](contracts/earnings-api.md);
storage in [data-model.md](data-model.md); UI in [design.md](design.md) ("Import screen addendum")
and `mockup.html` (screen "Import: correct a figure").

**Goal**: A file rejected by an arithmetic check opens the same "figures that will be sent" grid as
a valid file; the user corrects the misread figure inline, checks re-run live on the device, and the
server re-validates on import. Corrected figures stay marked in the preview, the import history and
the month detail.

**Independent Test**: Quickstart §9 — the synthetic "net off" payslip (and a Bundesbank-style
misread digit) is rejected, shows its grid with the involved figures highlighted, becomes importable
after a correct edit, imports with `correctedCount = 1`; the same file with a failing figure, an
unknown name in `corrected`, or `corrected` on a certificate is rejected by the server.

**Order**: tests (T138–T141, T147–T148, T154–T156) first and failing → lib (T142–T146) → backend
(T149–T153) → frontend (T157–T161) → verification and docs. Backend work needs the lib and contract
tasks; frontend work needs the contract tasks T145–T146 and a backend that accepts `corrected`
(T150–T151) only for the final `verify-ui` run.

### Tests first ⚠️

- [x] T138 [P] [US1] Extend `libs/earnings/src/lib/checks.spec.ts` for `collectCheckFailures` (research R15): a net-off record returns one `NET` failure with signed difference `-18.00`, `recordIndexes` and the nine involved keys (`gross`, `wageTax`, `soli`, `churchTax`, `health`, `care`, `pension`, `unemployment`, `net`); a payout mismatch returns a `PAYOUT` failure whose `involved` lists `net` and `payout` of every section carrying them; two failing records return two failures; a passing file returns `[]`; assert exact decimal strings and that `evaluateChecks` behaviour is unchanged
- [x] T139 [P] [US1] Create `libs/earnings/src/lib/corrections.spec.ts` for `parseMoneyInput` (`"1234.56"`, `"1.234,56"`, `"-45,00"`, `"1,234.56"`, `" 520 "` → canonical; `"52x"`, `""`, `"1.5"`, three decimals, `"12.345,6"`, values beyond 9 integer digits → `null`; never `-0.00`), `editableKeys` (equals the `involved` set; empty for a passing file) and `applyCorrection` (replaces exactly one figure, appends the key to `corrected` once, never mutates the input, returns `null` for a key outside the editable set, restoring the read value removes the key again)
- [x] T140 [P] [US1] Extend `libs/earnings/src/lib/parsers/registry.bundesbank.spec.ts` and `registry.spec.ts`: `parseDocument` on the net-off fixture returns `{ ok: false, error: CHECK_FAILED, partial }` with the parsed `employer`, `records` and `certificates`; other errors (`UNSUPPORTED_FORMAT`, `MISSING_FIELD`, `UNKNOWN_LINE`) carry no `partial`; a corrected `partial` run through `evaluateChecks` passes
- [x] T141 [P] [US1] Extend `libs/earnings/src/lib/validation.spec.ts` and `import-file.spec.ts`: `corrected` accepted on `PAYSLIP_PDF` records with distinct editable keys; rejected with `INVALID_VALUE` (`params.path`) for unknown names, duplicates, non-array, a key outside the editable set (e.g. `taxGross`, `other`), `corrected` on `CERTIFICATE_PDF` / `EXPORT_JSON`, and any other unknown field still `EARNINGS_UNKNOWN_FIELD`; a corrected record that still fails a check is `CHECK_FAILED`; `toImportFile` carries `corrected` through and nothing else new

### Library and contract

- [x] T142 [US1] Add `collectCheckFailures`, `CheckFailure`, `EDITABLE_KEYS` and `editableKeys` to `libs/earnings/src/lib/checks.ts` per [earnings-lib.md](contracts/earnings-lib.md); keep `evaluateChecks` and `runRecordChecks` / `runPayoutCheck` untouched so server and registry behaviour does not change
- [x] T143 [US1] Create `libs/earnings/src/lib/corrections.ts` with `parseMoneyInput` and `applyCorrection` (pure, exact decimals via `decimal.js`, canonical output via the existing money helpers) and export them with the T142 additions from `libs/earnings/src/index.ts`
- [x] T144 [US1] Make `parseDocument` in `libs/earnings/src/lib/parsers/registry.ts` return `partial: ParsedFigures` on `CHECK_FAILED` only (type `ParseOutcome` in `libs/earnings/src/lib/model.ts` gains the optional `partial`); update `libs/earnings/src/lib/parsers/registry.bundesbank.spec.ts` expectations that assumed a figure-less rejection
- [x] T145 [P] [US1] Add `corrected?: EarningsPayAmountKey[]` to `EarningsPayRecordInput`, `corrected?` to `EarningsStoredPayRecordAmounts`, `correctedCount: number` to the import-summary type and the `EarningsCheckFailure` / partial-outcome types the browser needs in `libs/api-contract/src/lib/earnings.ts`
- [x] T146 [US1] Accept `corrected` in `libs/earnings/src/lib/validation.ts` (`RECORD_KEYS`, per-record validation: only on `PAYSLIP_PDF`, distinct, editable keys only, `INVALID_VALUE` with `path`) and carry it in `recordBody` of `libs/earnings/src/lib/import-file.ts`; re-export the new types in `libs/earnings/src/lib/model.ts`

### Backend

- [x] T147 [P] [US1] Extend `apps/backend/src/earnings/earnings.repository.spec.ts` and `earnings-crypto.service.spec.ts`: `corrected` round-trips inside the encrypted payload (old rows without it read as `[]`), `corrected_count` is stored per import and returned by the history, the guarded `ALTER TABLE` adds the column to a database created without it and is idempotent
- [x] T148 [P] [US1] Extend `apps/backend/src/tests/earnings.e2e-spec.ts` and `earnings-e2e.helpers.ts`: (a) a corrected payslip (net-off fixture with the misread figure fixed and `corrected: ['wageTax']`) previews as `NEW`, commits `SAVED`, history shows `correctedCount: 1`, month detail shows `amounts.corrected`; (b) tampered requests are rejected — figure still failing → `CHECK_FAILED`, unknown name / duplicate / key outside the editable set → `INVALID_VALUE`, `corrected` on a certificate or export file → `INVALID_VALUE`, extra field → `EARNINGS_UNKNOWN_FIELD`; (c) a spied logger never receives an amount or the `corrected` list; exact decimal strings throughout
- [x] T149 [US1] Add `corrected_count INTEGER NOT NULL DEFAULT 0` to `earnings_imports` in `apps/backend/src/database/database.service.ts`: in the `CREATE TABLE` and as a guarded `ALTER TABLE ... ADD COLUMN` (`pragma_table_info` check, same pattern as `accounts.card_number`)
- [x] T150 [US1] Persist `corrected` inside the encrypted record payload and `corrected_count` on the import, and return `correctedCount` in the history and `corrected` in the record detail in `apps/backend/src/earnings/earnings.repository.ts` (count = sum of `corrected.length` over the file's records)
- [x] T151 [US1] Validate and forward `corrected` in `apps/backend/src/earnings/earnings.service.ts` (uses `validateImportFile`; preview and commit stay consistent); make sure no log line, exception `details` or rejection param contains `corrected` or an amount beyond the existing `difference` response field (FR-012a, FR-043)
- [x] T152 [US1] OpenAPI: add `corrected` to the record DTO and `correctedCount` to `EarningsImportSummary` (and the record-detail DTO) in `apps/backend/src/openapi/dto/earnings.ts`; run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`
- [x] T153 [P] [US1] Update the Bruno requests `Preview Import.bru` and `Commit Import.bru` in `api/bruno/earnings/` with a corrected record (`corrected: ["wageTax"]`) and note the tampered cases in their docs block

### Frontend

- [x] T154 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/import/import-session.store.spec.ts` (exact decimal strings): a `CHECK_FAILED` PDF becomes a `needs-correction` row with `draft`, `failures` and `editable`, no server preview call yet; `editFigure` with an invalid text keeps the row rejected and records an input error; a wrong amount keeps it `needs-correction` with the new difference; a right amount turns it into a `candidate` with `body.records[i].corrected`, triggers the preview and `commit()` sends the corrected body; `restoreFigure` brings the failure back and removes the key; editing a non-editable key is ignored; re-adding the same file discards edits; edits never reach logs (no `console` calls)
- [x] T155 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.spec.ts`: a rejected file shows the grid with highlighted involved figures (icon + `aria-invalid`/label, not colour alone), disabled confirm and the translated message with check, month, difference and involved figures; typing a correct amount flips the status to "Corrected by you", enables confirm and shows the "corrected by you" marker with the read value and a restore button; invalid input shows the inline error linked via `aria-describedby`; non-involved figures are disabled
- [x] T156 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/imports/earnings-imports.component.spec.ts` (history tag "N figure corrected by you") and the month-detail spec in `libs/frontend/domain/earnings/src/lib/overview/` (corrected figures marked in the statement)
- [x] T157 [US1] Implement the correction state in `libs/frontend/domain/earnings/src/lib/import/import-session.store.ts`: new `ImportRowState` `'needs-correction'`; row fields `draft`, `originalRecords`, `failures`, `editable`, `inputErrors`; `toCandidate` keeps `partial` figures for `CHECK_FAILED`; `editFigure(clientFileId, recordIndex, key, text)` (uses `parseMoneyInput`, `applyCorrection`, `collectCheckFailures`) and `restoreFigure`; the rejected counter and `ready` computed treat `needs-correction` as rejected until corrected; `commit()` unchanged apart from sending `corrected`
- [x] T158 [US1] Implement the editable figures grid: a new `libs/frontend/domain/earnings/src/lib/import/correction-grid/` component (inputs per [design.md](design.md): `inputmode="decimal"`, label per figure, `aria-describedby` to the check message, `aria-invalid` + inline error, "In failing check" label with warning icon, "corrected by you" tag, read value, "Restore read value") used by `earnings-import.component.ts` for `needs-correction` rows and for corrected candidates; add the check message block (check name, month, signed difference, involved figures) and the `data-testid`s from [docs/frontend/testid-conventions.md](../../docs/frontend/testid-conventions.md) (`earnings-import-figure-<key>`, `earnings-import-figure-restore`, `earnings-import-check-message`, `earnings-import-corrected-count`); use PrimeNG inputs per the `primeng-component-implementation` skill
- [x] T159 [P] [US1] Show the corrected marker in the imports history (`libs/frontend/domain/earnings/src/lib/imports/earnings-imports.component.ts`, tag with `data-testid="earnings-history-corrected"`) and next to corrected figures in the month-detail statement (`libs/frontend/domain/earnings/src/lib/overview/`)
- [x] T160 [P] [US1] Add EN and DE texts for the correction flow (check failed title/body, all-checks-pass title/body, "In failing check", "corrected by you", restore label and aria label, invalid-input hint, "only involved figures can be edited", history tag `N figure(s) corrected by you`, import-button label) to `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.en.ts` and the German counterpart; the existing completeness spec (T122) must stay green; the German terms follow the glossary (FR-048)

### Verification, export and docs

- [x] T161 [US1] Check that the 029 export (`libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts`) and the companion `export-v1` reader behave correctly with the new optional `corrected` field (export includes the key names, the reader neither requires nor accepts `corrected`), with a spec case in `earnings-export.definition.spec.ts` and `libs/earnings/src/lib/export-v1.spec.ts`
- [x] T162 [US1] Verify with the `verify-ui` skill (quickstart §9): net-off synthetic PDF and a Bundesbank-style misread digit → grid with highlighted figures, wrong then right edit, restore, confirm, history tag, month-detail marker; EN/DE, light/dark, 400 px (no page scroll), keyboard-only flow and input labels; confirm in the network log that only JSON figures are sent
- [x] T163 [P] [US1] Document the correction in `README.md`, `README.de.md`, `docs/user-guide.md` and `docs/user-guide.de.md` (when a payslip is rejected, which figures can be corrected, that corrections are re-checked and stay marked) and add the correction flow to the Imports section of `design.md` if the verified UI differs from the mockup
- [x] T164 Run `npx nx run-many -t lint typecheck test` and `npx nx run backend:openapi:check`; fix all findings; then run the full [quickstart.md](quickstart.md) (§1–§5, §7–§9) end to end
- [x] T165 Run the `speckit-sonar-validate` skill for the branch and fix any new quality-gate findings introduced by Phase 14

### Phase 14 dependencies

- T138–T141 can be written in parallel; T142 → T143 → T144 and T145 → T146 follow their tests.
- T147–T148 need T145–T146 for types; T149 → T150 → T151 → T152; T153 after T152.
- T154–T156 need T145 for types; T157 → T158; T159 and T160 are independent of T158.
- T161–T165 come last; T162 needs the backend tasks T149–T151 and the frontend tasks T157–T160.
- **Ship gate**: US6's privacy checks (log hygiene, whitelist) must still pass — T148 (c) and T164 cover this.
