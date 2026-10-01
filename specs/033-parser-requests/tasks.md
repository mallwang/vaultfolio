---
description: 'Task list for 033 Parser Requests'
---

# Tasks: Parser Requests

**Input**: Design documents from `/specs/033-parser-requests/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R16), data-model.md, contracts/ (`requests-api.md`, `layout-submission-v1.md`, `parser-request-lib.md`), quickstart.md, design.md + mockup.html

**Tests**: Included. plan.md (Constitution III/IV) and research R15 require exact-value unit tests, a backend e2e-spec, PDF.js parse-back of generated samples and a Playwright (`verify-ui`) drive. Test tasks come before the implementation they cover; write them first and see them fail.

**Organization**: Grouped by user story. US1 (P1) is the MVP: it delivers the whole submit path (browser wizard → `POST /requests` → stored anonymized sample). US2 (P1) is the admin side; US3–US5 (P2) add mails, rule hints and retention.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1–US5, only inside the story phases
- Commands use `npx nx …` (this repo uses npm, not pnpm). UI work follows the `verify-ui` skill; test credentials come from the dedicated test user, **never** read `.env` or `environment.local.ts`.

## Path Conventions

- Backend: `apps/backend/src/requests/`
- Pure logic (browser + server): `libs/earnings/src/lib/parser-request/` (framework-free: no Angular, Nest, `fs`, `window`; randomness and time injected)
- Generic registry (data only): `libs/requests/src/lib/`
- Frontend wizard: `libs/frontend/domain/earnings/src/lib/parser-request/`
- Frontend admin: `libs/frontend/admin/src/lib/requests/`
- Translations: `libs/frontend/shared-ui/src/lib/i18n/translations/requests.{en,de}.ts`

---

## Phase 1: Setup

**Purpose**: Constitution gate, spec alignment, new library.

- [x] T001 Constitution amendment 3.7.0 (anonymized-sample exception, FR-043) in `.specify/memory/constitution.md` — **already merged in commit baba420; nothing to do**
- [x] T002 [P] Amend `specs/032-earnings-domain/spec.md` FR-008 and FR-009 with a cross-reference to 033/FR-043: the opt-in, consented, user-reviewed parser-request flow may transmit a derived, anonymized, rebuilt sample; the original PDF, its raw text, personal identifiers and real figures still never leave the device
- [x] T003 Invoke the `nx-generate` skill, then create the library `libs/requests` (`@vaultfolio/requests`, tags `scope:shared`, `type:` as the other shared libs; Jest like `libs/earnings`) via the Nx generator; confirm it has no dependency on any feature lib and that `libs/frontend/admin` and `apps/backend` may import it (module-boundary lint)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Generic registry, shared types, DB tables, module skeleton, shared URL validation. No user story can start before this.

**⚠️ CRITICAL**: complete before Phase 3+.

- [x] T004 [P] Write tests for the registry in `libs/requests/src/lib/request-status.spec.ts` and `libs/requests/src/lib/request-types.spec.ts` (status list, `CLOSED_STATUSES`, `REQUEST_LIMITS` = 3/5/30, `findRequestType('earnings','new-parser')`, unknown → `undefined`, `requestTypeLabel` en/de)
- [x] T005 [P] Implement `libs/requests/src/lib/request-status.ts` (`REQUEST_STATUSES`, `RequestStatus`, `CLOSED_STATUSES`, `REQUEST_LIMITS`) per contracts/parser-request-lib.md
- [x] T006 Implement `libs/requests/src/lib/request-types.ts` (`RequestTypeDefinition`, `REQUEST_TYPES` with first entry `earnings/new-parser`: names en/de "New parser"/"Neuer Parser", feature names, `requiredDomain: 'earnings'`, attachment `application/pdf` max 512 kB; `findRequestType`, `requestTypeLabel`) and export all from `libs/requests/src/index.ts` (depends on T005)
- [x] T007 [P] Add DTO types to `libs/api-contract/src/lib/requests.ts` (submit body/response, list item + `openCount`, detail incl. `payload`/`attachment`/`sampleDeleted`, PATCH body, error codes from contracts/requests-api.md) and export from the lib index
- [x] T008 [P] Extract `requireAbsoluteUrl` into `apps/backend/src/mail/absolute-url.ts` with `absolute-url.spec.ts` (valid http/https, relative, empty, non-http scheme); replace the duplicated logic in `apps/backend/src/profile/email.service.ts`, `apps/backend/src/signups/email.service.ts` and `apps/backend/src/invitations/email.service.ts` and keep their existing specs green (FR-037)
- [x] T009 Add the tables `requests`, `request_attachments`, `request_download_audit` and the four indexes from data-model.md to `DatabaseService.initializeSchema()` in `apps/backend/src/database/database.service.ts` (`CREATE TABLE IF NOT EXISTS`, status `CHECK`), extend `database.service.spec.ts` to assert the schema
- [x] T010 [P] Raise the body limit only for the route: `app.use('/requests', json({ limit: '512kb' }))` ahead of the global parser in `apps/backend/src/app/body-parsers.ts` plus a spec in the same folder (511 kB accepted, 513 kB → `payload_too_large`, other routes keep 100 kB; non-JSON → 415)
- [x] T011 Write `apps/backend/src/requests/requests.repository.spec.ts` (temp SQLite): insert request + attachment in one transaction, find/list by status newest-first, `openCount`, count open per requester, count in last 24 h, find open duplicate by fingerprint, update status/note with `handled_by/handled_at/closed_at` rules, audit insert + count, purge by `closed_at`
- [x] T012 Implement `apps/backend/src/requests/requests.repository.ts` to satisfy T011 (depends on T009)
- [x] T013 Create the module skeleton `apps/backend/src/requests/requests.module.ts` (imports the mailer/users/database modules as needed, provides the repository and the `REQUEST_TYPE_HANDLERS` multi-provider token, declares `RequestTypeHandler` in `apps/backend/src/requests/request-type-handler.ts` per contracts/parser-request-lib.md) and register it in the app module (depends on T012)
- [x] T014 [P] Create `libs/frontend/shared-ui/src/lib/i18n/translations/requests.en.ts` and `requests.de.ts` with the shared keys (status names, request type/feature names, error-code messages for `UNKNOWN_REQUEST_TYPE`, `INVALID_LAYOUT`, `LAYOUT_UNKNOWN_FIELD`, `LIMIT_EXCEEDED`, `PERSONAL_DATA_DETECTED`, `INVALID_RULE_DRAFT`, `REQUEST_LIMIT_OPEN`, `REQUEST_LIMIT_DAILY`, `REQUEST_NOT_FOUND`, `SAMPLE_DELETED`, `INVALID_REQUEST_UPDATE`), merge them into `en.ts`/`de.ts` and add a completeness spec `requests-translations.spec.ts` modelled on `earnings-translations.spec.ts` (story tasks append their own keys to these files)

**Checkpoint**: registry, types, tables, repository and module skeleton exist; user stories can start.

---

## Phase 3: User Story 1 — Request a parser for a document that was not recognized (P1) 🎯 MVP

**Goal**: An entitled user whose file was rejected as "format not supported yet" completes the 4-step flow (rule marking step is a "Skip" stub until US4) and a validated, server-generated anonymized PDF is stored with an OPEN request.

**Independent Test**: Import a synthetic text PDF in an unsupported layout containing planted personal data; start the request, consent, decide marked words, send. A `requests` row (OPEN) and a `request_attachments` row exist; the only HTTP call is one `POST /requests` whose JSON body contains none of the planted strings or original amounts; the stored PDF contains no executable content (quickstart §2, §5).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [x] T015 [P] [US1] `libs/earnings/src/lib/parser-request/personal-data.spec.ts`: exact-value cases per kind — IBAN with valid check digits (`DE89 3704 0044 0532 0130 00`) and invalid check digits, tax ID with valid/invalid check digit (invented values computed in the spec), social-security number, e-mail, phone, postal code + city; each also **split across several words**; negatives (labels, plain amounts); `scanDocument` returns page/line/wordIndexes
- [x] T016 [P] [US1] `libs/earnings/src/lib/parser-request/label-vocabulary.spec.ts`: every label recognised by the existing parsers is kept (derived, not hand-listed), common German payroll terms kept, names/unknown words not kept; case/punctuation normalisation
- [x] T017 [P] [US1] `libs/earnings/src/lib/parser-request/anonymize.spec.ts` with a seeded `rng`: digits replaced by same-shape values (separators, decimals, date shape), numbers right-aligned to the original right edge, personal-data words `REMOVED` + `locked`, label words kept, unknown words `NEEDS_DECISION`, covered words preselected `MASK`, `pendingDecisions` counts, `toSubmission` output passes `validateLayoutSubmission` and `scanDocument` finds nothing, 0 original digit sequences survive (SC-003)
- [x] T018 [P] [US1] `libs/earnings/src/lib/parser-request/layout-submission.spec.ts`: exact keys at every level, unknown key → `LAYOUT_UNKNOWN_FIELD`, 4th page / 121 lines / 41 words / 3 001 words / 61-char word → `LIMIT_EXCEEDED`, control + bidi characters, whitespace inside a word, NaN/Infinity, coordinates outside the page box, wrong `schemaVersion` → `INVALID_LAYOUT`; error `path` never contains values
- [x] T019 [P] [US1] `libs/earnings/src/lib/parser-request/sheet.spec.ts`, `sample-pdf.spec.ts` and `layout-fingerprint.spec.ts`: `toSheet` mapping; `renderSamplePdf` deterministic bytes, **parsed back with PDF.js to the sheet text**, byte scan finds none of `/JavaScript /JS /Launch /URI /EmbeddedFile /AcroForm /OpenAction /AA /Annots`, parentheses/backslash escaping, WinAnsi mapping with `?` fallback, ≤ 512 kB for the maximum layout; fingerprint stable under value changes and 5 pt jitter, differs for a different layout
- [x] T020 [P] [US1] `apps/backend/src/requests/handlers/earnings-new-parser.handler.spec.ts`: validate → scan (PII hit → `PERSONAL_DATA_DETECTED` with kinds + page/line only) → `buildAttachment` returns PDF + page count → `fingerprint`
- [x] T021 [US1] `apps/backend/src/requests/requests.service.spec.ts` (submit path): unknown type, missing `requiredDomain` (admin passes), open limit 3 → `REQUEST_LIMIT_OPEN`, daily limit 5 → `REQUEST_LIMIT_DAILY`, transaction inserts request + attachment with sha256/size/page count, duplicate fingerprint of another open request sets `possibleDuplicate`, response echoes no content
- [x] T022 [US1] `apps/backend/src/requests/requests.e2e-spec.ts` (temp SQLite, real HTTP) — submit scenarios: 201 valid, extra key, 4th page, 61-char word, `415` non-JSON, `413` > 512 kB, valid IBAN/e-mail in a word → `PERSONAL_DATA_DETECTED`, not entitled → 403, anonymous → 401, 4th open request → 429, stored PDF contains no forbidden names (quickstart §5); nothing stored on every rejection
- [x] T023 [P] [US1] Frontend specs in `libs/frontend/domain/earnings/src/lib/parser-request/`: `layout-extractor.spec.ts` (synthetic PDFs built with pdfmake in `libs/frontend/domain/earnings/src/testing/` through the real PDF.js adapter: positions, text under a black rectangle flagged `covered`, image-only → refused, password → refused, > 3 pages → refused), `parser-request.store.spec.ts` (consent gate, `pendingDecisions`, `removedKinds`, `reset()`, state not kept after destroy), `sheet/sheet.component.spec.ts` (click cycles a decision, locked words ignore clicks, keyboard operable), `steps/*.spec.ts` (Continue disabled until consent / all decisions made; refused reasons; Send disabled while the final scan finds anything), `parser-request.service.spec.ts` (single `POST /requests`; asserts the body contains none of the planted original strings — SC-003), and the import-row spec that the button shows only for `UNSUPPORTED_FORMAT` of a text PDF

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement `libs/earnings/src/lib/parser-request/personal-data.ts` (`PersonalDataKind`, `scanLine`, `scanDocument`; IBAN mod-97, tax-ID check digit, SSN pattern, e-mail, phone, PLZ+city; detection across adjacent words)
- [x] T025 [P] [US1] Implement `libs/earnings/src/lib/parser-request/label-vocabulary.ts` (`LABEL_VOCABULARY` seeded from the labels exported by the existing parsers in `libs/earnings/src/lib/parsers/` plus common German payroll terms; `isKnownLabel`)
- [x] T026 [P] [US1] Implement `libs/earnings/src/lib/parser-request/layout-submission.ts` (types, `SUBMISSION_LIMITS`, `ValidationResult`, strict hand-written `validateLayoutSubmission` per contracts/layout-submission-v1.md incl. the optional `ruleDraft` structure, validated here so US4 only adds semantics)
- [x] T027 [US1] Implement `libs/earnings/src/lib/parser-request/anonymize.ts` (`AnalyzedWord/Layout`, `WordDecision`, `AnonWord`, `anonymizeLayout`, `pendingDecisions`, `toSubmission`, `replaceDigitsSameShape`) using T024/T025/T026
- [x] T028 [P] [US1] Implement `libs/earnings/src/lib/parser-request/sheet.ts` (`Sheet`, `toSheet`), `sample-pdf.ts` (hand-written text-only PDF writer, Courier, deterministic, no actions/links/files/forms; research R2) and `layout-fingerprint.ts` (`layoutFingerprintInput`)
- [x] T029 [US1] Export the new public API from `libs/earnings/src/index.ts` (and `testing.ts` for any test fixtures) and run `npx nx run-many -t lint typecheck test -p earnings requests` until T015–T019 pass (depends on T024–T028)
- [x] T030 [US1] Implement `apps/backend/src/requests/handlers/earnings-new-parser.handler.ts` (validate with `validateLayoutSubmission`, map codes to `BusinessException`, `scanDocument`, `renderSamplePdf(toSheet(...))` size check, fingerprint = SHA-256 of `layoutFingerprintInput`, `toStoredPayload` returning the rule-draft shape of data-model.md — `lines: []`/`period: null` until US4 fills it) and register it in `requests.module.ts`
- [x] T031 [US1] Implement `POST /requests` in `apps/backend/src/requests/requests.service.ts` and `requests.controller.ts`: registry lookup, `requiredDomain` check like `DomainGuard`, open/daily limits (R12), handler validate → build → single transaction insert, structured log line (ids/sizes/hashes/codes only, FR-023), response `{ id, submittedAt, possibleDuplicate }`; add `requests.exceptions.ts` with the error codes of contracts/requests-api.md
- [x] T032 [US1] OpenAPI + Bruno for `POST /requests`: add `@Api…` decorators and DTO classes in `apps/backend/src/openapi/dto/requests.ts`, run `npx nx run backend:openapi`, commit the regenerated `api/openapi.yml` (check with `npx nx run backend:openapi:check`); add Bruno requests (valid + rejected) in `api/bruno/requests/`
- [x] T033 [US1] Make T020–T022 pass: `npx nx test backend --testPathPatterns=requests` (incl. the e2e-spec)
- [x] T034 [P] [US1] Implement the browser layout extractor `libs/frontend/domain/earnings/src/lib/parser-request/layout-extractor.ts` (extends the existing PDF.js adapter in `libs/frontend/domain/earnings/src/lib/pdf/`: word text + x/y/width/height/size per line, `covered` for text under drawn shapes, refusal detection for image-only / password / unreadable / > 3 pages)
- [x] T035 [US1] Implement `parser-request.store.ts` (signals, in-memory only: `file`, `analysis`, `decisions`, `ruleDraft`, `step`, derived `pendingDecisions`, `removedKinds`, `preview`, `consent`; `reset()` on destroy, FR-009) and `parser-request.service.ts` (`submit(layout)` — the wizard's only network call)
- [x] T036 [P] [US1] Implement `sheet/sheet.component.ts` (absolutely positioned keyboard-operable buttons for words, marks: label / value-replaced / removed-locked / needs-decision / masked / kept; colour **and** icon; `data-testid="request-word-<page>-<line>-<index>"`)
- [x] T037 [US1] Implement the steps in `libs/frontend/domain/earnings/src/lib/parser-request/steps/`: `consent` (three-column facts, "Document checks" card listing readability, personal-data kinds, hidden text; consent checkbox `request-consent`), `review-words` (callout, sheet, "Marked words" card with progress and Keep/Mask per word `request-decision-<key>-keep|mask`, locked "Removed automatically" row), `mark-rules` (placeholder with **Skip markings** and Continue; real content added in US4), `preview-send` (summary card, **Send request** `request-send` disabled while `pendingDecisions>0` or the final `scanDocument` finds anything, **Discard** `request-discard`), `sent` (confirmation, possible-duplicate hint, kept-until), `refused` (specific reason, "Choose another file")
- [x] T038 [US1] Implement `parser-request.component.ts` (PrimeNG `p-stepper`, `request-step-<n>`) and the lazy route `earnings/import/request` in `apps/frontend/src/app/app.routes.ts` guarded like the import route plus a guard redirecting to the import page when the store is empty (FR-009); responsive: sheet/card columns stack at phone width, light/dark tokens
- [x] T039 [US1] Add the **Request a parser** button (`request-parser-button-<index>`, one-line "anonymized copy, never real figures" note) to the rejected-file row in `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.ts`, only for `UNSUPPORTED_FORMAT` of a text PDF and only for Earnings-entitled users; hand the `File` to the store (extend `import-session.store.ts` if needed)
- [x] T040 [US1] Append the US1 keys (consent text, three facts, document checks, personal-data kinds, step titles, legend, decisions, summary, sent, refusal reasons, button/notes) to `requests.en.ts` and `requests.de.ts`
- [x] T041 [US1] Drive the flow with the `verify-ui` skill (quickstart §2 steps 1–4, 6–7 and §7 for the wizard): EN + DE, light + dark, 390 px; capture the network traffic and assert exactly one `POST /requests` without PDF bytes or planted strings; button absent for failed-check / scan / password rows. Scripts stay in the scratchpad, not committed

**Checkpoint**: US1 works end to end and is the shippable MVP (requests are stored; admins can inspect via DB until US2).

---

## Phase 4: User Story 2 — Handle requests as an administrator (P1)

**Goal**: Administration → Requests tab with table, detail, status/note handling and an audited admin-only PDF download.

**Independent Test**: With one submitted request, as admin open Administration → Requests, see the row, open the detail (also via `?id=`), download the PDF, set status and note; as a member every read/download route answers 403 (quickstart §3 steps 2–4, §4).

### Tests for User Story 2 ⚠️

- [x] T042 [P] [US2] Extend `apps/backend/src/requests/requests.service.spec.ts`: list with status filter + `openCount` (counts OPEN+IN_PROGRESS regardless of filter), detail shape (`handledByEmail`, `sampleDeletesAt` = `closedAt + 30 d` while a sample exists, `attachment` meta with `downloadCount`/`lastDownloadedAt`), patch rules (at least one field, `note` ≤ 2 000, `handled_by/at` on every change, `closed_at` set on entering DONE/REJECTED and cleared on reopen, idempotent same-status), download writes one audit row, `REQUEST_NOT_FOUND`, `SAMPLE_DELETED` → 410
- [x] T043 [US2] Extend `apps/backend/src/requests/requests.e2e-spec.ts`: admin list/detail/patch/attachment; member → 403 and anonymous → 401 with identical bodies for existing and unknown ids (FR-032); download headers (`application/pdf`, `Content-Disposition: attachment; filename="request-<8 hex>-sample.pdf"`, `nosniff`, `no-store`); audit row count; a member can still submit but cannot read their own request
- [x] T044 [P] [US2] Frontend specs in `libs/frontend/admin/src/lib/requests/`: `requests.service.spec.ts` (list/get/update/download), `requests-table.component.spec.ts` (columns, newest first, status filter, duplicate tag, sample-deletes-at hint, phone scroll container), `request-detail.component.spec.ts` (download action, handling card, "sample has been deleted" state without an error page, generic payload fallback for unknown types), and the tab/route behaviour in `libs/frontend/admin/src/lib/admin.component.spec.ts` (tab between Invitations and General with open-count tag, `?id=` opens the detail)

### Implementation for User Story 2

- [x] T045 [US2] Implement `GET /requests`, `GET /requests/:id`, `PATCH /requests/:id` and `GET /requests/:id/attachment` in `requests.controller.ts` / `requests.service.ts` / `requests.repository.ts` with the admin-only guard (403 for members, 401 anonymous, no existence leak), status-transition side effects of data-model.md, audit insert on download, log lines per FR-023 (no content, no requester e-mail)
- [x] T046 [US2] OpenAPI + Bruno for the four admin routes: decorators/DTOs in `apps/backend/src/openapi/dto/requests.ts`, run `npx nx run backend:openapi`, commit `api/openapi.yml` (`npx nx run backend:openapi:check`); add Bruno requests in `api/bruno/requests/`
- [x] T047 [US2] Make T042/T043 pass: `npx nx test backend --testPathPatterns=requests`
- [x] T048 [P] [US2] Implement `libs/frontend/admin/src/lib/requests/requests.service.ts` (`list`, `get`, `update`, `downloadAttachment(id): Observable<Blob>` triggering a browser download)
- [x] T049 [US2] Implement `requests-table.component.ts` (PrimeNG Table: Feature · Request · From · Submitted · Status · Open, newest first, `requests-status-filter`, `requests-row-<id>`, possible-duplicate tag, "sample deleted on …" hint, left accent for open rows; type/feature labels from `requestTypeLabel` so a new registry row needs no table change — SC-010) and `request-detail.component.ts` (back link, requester + time, status tag, duplicate callout, anonymized-sample card with `request-detail-download`, size/pages/SHA-256/download audit, Handling card with `request-detail-status`, `request-detail-note`, `request-detail-save`, retention hint, a `payload-views` map keyed `feature/type` with a generic fallback)
- [x] T050 [US2] Add the `requests` tab (`admin-tab-requests`, warning tag with `openCount`) between Invitations and General in `libs/frontend/admin/src/lib/admin.component.ts`, the child route `/app/admin/requests` reading `?id=` in `apps/frontend/src/app/app.routes.ts`, admin-only like the other tabs
- [x] T051 [US2] Append the US2 keys (tab, table headers, filter, detail labels, handling card, retention hints, sample-deleted notice, empty state) to `requests.en.ts` / `requests.de.ts`
- [x] T052 [US2] Drive the admin flow with `verify-ui` (quickstart §3 steps 2–4 and §7): table, `?id=` deep link, download (not inline), status + note save, member cannot reach the tab; EN + DE, light + dark, 390 px

**Checkpoint**: US1 + US2 work independently; the full submit → handle loop is usable.

---

## Phase 5: User Story 3 — E-mail notifications with deep link, no attachment (P2)

**Goal**: One link-only mail per admin on submit, one "done" mail to the requester when the status enters DONE.

**Independent Test**: Submit → every admin gets exactly one mail in their language with the link and no attachment; set Done → requester gets the re-import mail once (quickstart §3 steps 1, 5).

### Tests for User Story 3 ⚠️

- [x] T053 [P] [US3] Extend `libs/notifications/src/lib/notification-renderer.spec.ts`: both new types render EN/DE subject/text/html; the admin alert contains the link, feature/type names and "no attachment/sample content" note and no figures; the done mail contains `importUrl`
- [x] T054 [P] [US3] `apps/backend/src/requests/requests-email.service.spec.ts`: one mail per active admin in `emailLanguage` (fallback EN), link `${APP_BASE_URL}/app/admin/requests?id=<id>`, **no attachments passed to `MailerService`**, `Promise.allSettled` — one failing recipient does not stop the rest, failure logged with metadata only, relative `APP_BASE_URL` rejected via `requireAbsoluteUrl`, no admin reachable → logged, no throw
- [x] T055 [US3] Extend `requests.service.spec.ts` / `requests.e2e-spec.ts`: admin mails sent only after commit and exactly once per request; mail failure does not fail submit or PATCH (FR-036); DONE mail only on a transition **into** DONE, not on repeat; REJECTED/OPEN/IN_PROGRESS send nothing

### Implementation for User Story 3

- [x] T056 [P] [US3] Add templates `libs/notifications/src/lib/templates/request-admin-alert/{en,de}.{subject,text,html}.hbs` (`featureName`, `typeName`, `requestUrl`; one "Open request" button, raw link, "no attachment, no sample content; login required" note) and `request-done/{en,de}.{subject,text,html}.hbs` (`featureName`, `typeName`, `importUrl`, "Go to Earnings import" button); register the types in `libs/notifications/src/lib/types.ts`
- [x] T057 [US3] Implement `apps/backend/src/requests/requests-email.service.ts` (admin alert to every active admin, done mail to the requester) using `requireAbsoluteUrl` from T008, wired into `requests.module.ts`
- [x] T058 [US3] Call the mail service **after commit** from `submit()` and from `PATCH` (transition into DONE only) in `requests.service.ts`; swallow and log failures
- [x] T059 [US3] Verify against a mail catcher or the stubbed `MailerService` (quickstart §3 steps 1 and 5, both languages) and confirm the deep link opens the right detail for an admin

**Checkpoint**: notifications work; US1/US2 behaviour unchanged.

---

## Phase 6: User Story 4 — Mark parsing rules in the preview as hints (P2)

**Goal**: Optional step 3: assign figure types to lines, pick column/format/period, see a live arithmetic check; the rule draft (no figures) is stored and shown to admins, never executed.

**Independent Test**: Mark the lines of a synthetic payslip; live check green when consistent and red with the failing check + involved figures when a marking is wrong; submit and see the hints in the admin detail; a request without markings or with a red check still submits (quickstart §2 step 5).

### Tests for User Story 4 ⚠️

- [x] T060 [P] [US4] `libs/earnings/src/lib/parser-request/live-check.spec.ts`: derived figures from markings on the original layout (formats `DE_DECIMAL`, `CENTS`, `TRAILING_MINUS`, deduction sign), NET and PAYOUT checks via the existing `checks.ts` pass/fail/`null` (not enough markings) with `involved` figures (SC-012); result never contains anything that is transmitted
- [x] T061 [P] [US4] `libs/earnings/src/lib/parser-request/rule-draft.spec.ts`: `deriveRuleLabels` adds the label from the referenced line's non-digit words and nothing else; references to missing lines → `INVALID_RULE_DRAFT`; > 60 lines; `x0 < x1` within the page width; unknown figure/format; no keys outside the schema; **architecture assertion** that nothing in `libs/earnings/src/lib/parsers/` or the registry imports `rule-draft.ts` (FR-014)
- [x] T062 [US4] Extend `earnings-new-parser.handler.spec.ts` and `requests.e2e-spec.ts`: rule draft stored as `{schemaVersion, pages, lines:[{page,line,label,figure,deduction,column,format}], period}` without any figure value; invalid draft rejected; admin detail returns it; a request with no draft or with failing checks is accepted
- [x] T063 [P] [US4] Frontend specs: `steps/mark-rules.step.spec.ts` (line click, figure select incl. IGNORE, sign, number pick records column + format, period marking, live-check card colour **and** icon, Skip markings, Continue) and the admin rule-hints table view in `libs/frontend/admin/src/lib/requests/payload-views/earnings-new-parser.view.spec.ts` ("not executed" label)

### Implementation for User Story 4

- [x] T064 [P] [US4] Implement `libs/earnings/src/lib/parser-request/rule-draft.ts` (`FIGURE_TYPES`, semantic validation of the already-typed `SubmittedRuleDraft`, `deriveRuleLabels` → `StoredRuleDraft`)
- [x] T065 [US4] Implement `libs/earnings/src/lib/parser-request/live-check.ts` (`liveCheck(original, draft)` reusing the checks from `libs/earnings/src/lib/checks.ts`; browser-only use) and export both from `libs/earnings/src/index.ts`
- [x] T066 [US4] Make `earnings-new-parser.handler.ts` validate the draft (`INVALID_RULE_DRAFT`) and store `deriveRuleLabels(...)` as `payload`; surface `payload` in the admin detail response (`requests.service.ts`); update OpenAPI DTOs in `apps/backend/src/openapi/dto/requests.ts` and re-run `npx nx run backend:openapi` (commit `api/openapi.yml`)
- [x] T067 [US4] Replace the step-3 stub in `libs/frontend/domain/earnings/src/lib/parser-request/steps/mark-rules` with the real UI (sheet in rules mode, "Selected line" card, "Live check" card with the lock note "calculated on this device, never sent", `request-rule-row-<page>-<line>`), extend the store with `ruleDraft`/live-check state (cleared on reset), and include the draft in `toSubmission`
- [x] T068 [P] [US4] Implement the admin payload view `libs/frontend/admin/src/lib/requests/payload-views/earnings-new-parser.view.ts` (rule-hints table: label, figure type, sign, column, format, period; "not executed" note) and register it under `earnings/new-parser` in the `payload-views` map
- [x] T069 [US4] Append the US4 keys (figure types, sign, column/format names, live-check texts, "optional / not executed" notes, admin hints table) to `requests.en.ts` / `requests.de.ts`
- [x] T070 [US4] Drive step 3 with `verify-ui` (quickstart §2 step 5): consistent payslip → green, one wrong marking → red with involved figure, Skip works; then check the hints in the admin detail; EN + DE, light + dark, 390 px

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 — Retention and cleanup of samples (P2)

**Goal**: Samples/rule drafts deleted 30 days after Done/Rejected, never for open requests; reopen cancels; account purge removes everything.

**Independent Test**: Backend spec with an injected clock across all statuses (quickstart §6).

### Tests for User Story 5 ⚠️

- [x] T071 [P] [US5] `apps/backend/src/requests/requests-retention.service.spec.ts`: injected clock — Open/In progress never purged; Done at T → present at T+29 d, purged at T+30 d (attachment row deleted, `payload = NULL`, `payload_purged_at` set, row and status history remain); reopen at T+10 d clears `closed_at` and nothing is deleted later; sweep is idempotent; one log line per sweep without content
- [x] T072 [P] [US5] Extend `apps/backend/src/auth/users.repository.spec.ts`: `deleteById` removes the user's requests, attachments and audit rows and sets `requests.handled_by` / `request_download_audit.admin_id` to NULL when the deleted user was an administrator (FR-042)
- [x] T073 [US5] Extend `requests.e2e-spec.ts`: after the sweep the detail shows `payload: null`, `attachment: null`, `sampleDeleted: true` and `GET …/attachment` → 410 `SAMPLE_DELETED`; admin UI case in `request-detail.component.spec.ts` already covers the no-error-page rendering (T044)

### Implementation for User Story 5

- [x] T074 [US5] Implement `apps/backend/src/requests/requests-retention.service.ts` mirroring the existing `RetentionSweepService` (hourly `setInterval` with `.unref()`, injectable clock and `retentionDays`, one transaction per sweep, repository method for `closed_at <= now − 30 d AND payload_purged_at IS NULL`) and register it in `requests.module.ts`
- [x] T075 [US5] Add the account-purge hook to `UsersRepository.deleteById` in `apps/backend/src/auth/users.repository.ts` (delete requests + attachments + audit rows of the user; null out admin references)
- [x] T076 [US5] Make T071–T073 pass: `npx nx test backend --testPathPatterns='requests|users.repository'`

**Checkpoint**: all five stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T077 [P] Docs (FR-044): describe the exception (when it applies, what is sent, who can see it, retention, operators/admins can see the anonymized sample, rule hints never executed) in `docs/user-guide.md`, `docs/user-guide.de.md`, `docs/development.md`, `docs/development.de.md` and in the Earnings privacy note component under `libs/frontend/domain/earnings/src/lib/privacy-note/` (+ translations in `earnings.{en,de}.ts` and its spec)
- [x] T078 [P] Confirm every interactive element listed under "Test identifiers" in contracts/parser-request-lib.md carries its `data-testid` per `docs/frontend/testid-conventions.md` (FR-046); add any that are missing
- [x] T079 Full automated run: `npx nx run-many -t lint typecheck test -p requests earnings api-contract notifications frontend-domain-earnings frontend-admin backend`, `npx nx test backend --testPathPatterns=requests.e2e`, coverage `npx nx run-many -t test --coverage --outputStyle=static -p earnings requests`, and `npx nx run backend:openapi:check` (quickstart §1)
- [x] T080 Run quickstart.md end to end (§2–§7) incl. the access-control curls (SC-006), server-side defence (SC-004), retention (SC-009) and i18n/theme/phone (SC-011); confirm 0 binary in traffic and 0 planted strings in the stored PDF (SC-002, SC-003, SC-005)
- [ ] T081 Quality gate: run the `speckit-sonar-validate` skill for the branch/PR and fix findings; run `speckit-format` over changed files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: T002, T003 can start immediately (T001 done).
- **Foundational (2)**: after T003 — blocks all stories.
- **US1 (3)** → needs Phase 2. **US2 (4)** needs Phase 2 and is testable with rows inserted by US1 (or by repository fixtures), but is normally done after US1 because its e2e reuses the submit path. **US3 (5)** hooks into the US1 submit and US2 patch code. **US4 (6)** extends the US1 step-3 stub, handler and the US2 detail view. **US5 (7)** needs the repository/patch logic from Phase 2/US2 (`closed_at`).
- **Polish (8)** last.

### Within Each Story

Tests first (must fail) → pure libs → backend handler/service/controller → OpenAPI/Bruno → frontend → translations → `verify-ui`.

### Key task-level dependencies

- T006 ← T005; T012 ← T009, T011; T013 ← T012.
- T027 ← T024, T025, T026; T029 ← T024–T028; T030 ← T029; T031 ← T030, T013; T033 ← T030–T032.
- T035 ← T034; T037/T038/T039 ← T035, T036; T041 ← T038–T040.
- T045 ← T012; T049/T050 ← T048; T052 ← T049–T051.
- T057 ← T056, T008; T058 ← T057, T031, T045.
- T066 ← T064, T030; T067 ← T065, T037; T068 ← T049.
- T074 ← T012; T075 independent of T074.

### Parallel Opportunities

- Phase 2: T004/T005, T007, T008, T010, T014 in parallel (different files).
- US1 tests T015–T020 and T023 in parallel; implementations T024, T025, T026, T028 in parallel; T034 and T036 in parallel with the backend work (T030–T033).
- US2: T042, T044 parallel; T048 parallel with backend T045.
- US3: T053, T054, T056 parallel.
- US4: T060, T061, T063, T064 parallel; T068 parallel with T067.
- US5: T071, T072 parallel; T074 and T075 parallel.
- With several developers: after Phase 2, one takes the pure libs + backend of US1, one the wizard UI of US1, one the admin side (US2) against repository fixtures.

### Parallel Example: User Story 1

```text
Task: "personal-data.spec.ts in libs/earnings/src/lib/parser-request/"
Task: "label-vocabulary.spec.ts in libs/earnings/src/lib/parser-request/"
Task: "anonymize.spec.ts in libs/earnings/src/lib/parser-request/"
Task: "layout-submission.spec.ts in libs/earnings/src/lib/parser-request/"
Task: "sheet/sample-pdf/layout-fingerprint specs in libs/earnings/src/lib/parser-request/"
# then, in parallel:
Task: "personal-data.ts"  Task: "label-vocabulary.ts"  Task: "layout-submission.ts"  Task: "sheet.ts + sample-pdf.ts + layout-fingerprint.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (T002, T003) → Phase 2 (T004–T014).
2. Phase 3 (US1). **Stop and validate** with T041 and quickstart §2 + §5: the submit path is complete, privacy guarantees (SC-002/3/4/5) are testable.
3. US2 next (also P1) so requests can actually be handled; the pair US1 + US2 is the first real release candidate.

### Incremental Delivery

1. Setup + Foundational → foundation.
2. US1 → MVP; US2 → handle loop; US3 → notifications; US4 → rule hints; US5 → retention (**retention is privacy-relevant: ship it with or before the first release that stores real samples**).
3. Each story adds value without breaking the previous ones; Polish closes docs, coverage, quickstart and the Sonar gate.

---

## Notes

- [P] = different files, no dependency on unfinished tasks. Backend tasks touching `requests.service.ts`/`requests.controller.ts`/`requests.e2e-spec.ts` are deliberately not [P] across stories (same files).
- `plan.md` named the amendment as T001; it is done (baba420), the leftover 032 cross-reference is T002.
- Never commit real payslips; test PDFs are generated synthetically. Logs, errors and diagnostics carry ids/sizes/hashes/codes only (FR-023).
- Any change to a controller route or DTO shape needs `npx nx run backend:openapi` and the regenerated `api/openapi.yml` committed (T032, T046, T066).
- Commit after each task or logical group; stop at any checkpoint to validate the story.
