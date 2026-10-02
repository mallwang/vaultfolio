---
description: 'Task list for OCR Fallback for PDFs Without a Text Layer'
---

# Tasks: OCR Fallback for PDFs Without a Text Layer

**Input**: Design documents from `/specs/034-ocr-fallback-pdf/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ocr-lib.md, design.md (+ mockup.html), quickstart.md

**Tests**: Included — plan.md/Constitution III–IV require unit tests for new logic (conversion, normalisation, lenient scan with injected misreads, stores), a backend e2e extension, an optional real-engine integration spec, and Playwright verification via `verify-ui`.

**Organization**: Grouped by user story. Use `npm`/`npx` (see the `vaultfolio-uses-npm` memory); run tasks through `npx nx …`. Never read `.env` / `environment.local.ts`; use the test login from the `vaultfolio-test-login` memory for UI verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 (see spec.md)
- All `data-testid`s follow [docs/frontend/testid-conventions.md](../../docs/frontend/testid-conventions.md) and are added in the same task as the element: `ocr-offer`, `ocr-accept`, `ocr-decline`, `ocr-progress`, `ocr-cancel`, `ocr-notice`, `ocr-badge`, `image-only-message`, `request-ocr-notice` (design.md).

## Path Conventions

- Earnings pure lib: `libs/earnings/src/lib/`
- Earnings frontend lib: `libs/frontend/domain/earnings/src/lib/`
- API contract: `libs/api-contract/src/lib/earnings.ts`
- Backend: `apps/backend/src/{database,earnings,openapi}/`, e2e in `apps/backend/src/tests/earnings.e2e-spec.ts`
- Translations: `libs/frontend/shared-ui/src/lib/i18n/translations/`

---

## Phase 1: Setup (Governance & Dependencies)

**Purpose**: Governance amendments MUST land before implementation (spec FR-016); dependencies and asset plumbing.

- [x] T001 Amend `.specify/memory/constitution.md`: Earnings domain bullet → "PDFs (text-based, or read by on-device text recognition after the user's consent)…"; add to Sensitive Personal Data that recognition runs on-device and recognised text is raw text under the same rules; MINOR bump 3.7.0 → 3.8.0 (version line, sync-impact note, and `.specify/memory/.constitution-template.json` if it tracks the version)
- [x] T002 [P] Amend `specs/032-earnings-domain/spec.md` FR-014: image-only message now leads to the recognition offer; the message remains for the declined / no-text case (add an "Amended by 034" note)
- [x] T003 [P] Amend `specs/033-parser-requests/spec.md` FR-004 and its "Text-based PDFs only" / "Out of scope: OCR" statements (add an "Amended by 034" note)
- [x] T004 Add `tesseract.js` (^7), `tesseract.js-core` and `@tesseract.js-data/deu` to root `package.json` AND `apps/frontend/package.json` (project convention: runtime deps declared in the app's own package.json too); run `npm install`; verify package contents and the Apache-2.0 license files (research R3 "first task")
- [x] T005 Add Nx asset globs to `apps/frontend/project.json` (next to the `pdf.worker.min.mjs` entry) copying the tesseract worker, core WASM variants (`tesseract-core-*-lstm*`), `deu.traineddata` (fast, uncompressed) and the license files into `assets/tesseract/`; run `npx nx build frontend` and confirm the assets are emitted and the initial bundle budget (1 MB warning) is unaffected

**Checkpoint**: Governance amended, dependencies and assets available.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Recognition engine, port and pure conversion code that US1, US3 (and US2) all depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 [P] Add optional `origin?: 'EXTRACTED' | 'RECOGNISED'` (default `EXTRACTED`) to `PdfDocumentText` in `libs/earnings/src/lib/parsers/pdf-text.ts`; extend `libs/earnings/src/lib/parsers/pdf-text.spec.ts` to confirm helpers (`allLines`, `documentText`) ignore it and parsers are unaffected
- [x] T007 [P] Create `libs/earnings/src/lib/ocr-normalise.ts` (+ `ocr-normalise.spec.ts`): map `O/o→0`, `l/I→1`, `S→5` **only inside tokens that otherwise match a number/amount pattern**; never merge whitespace inside amounts; no numeric "healing" (research R5). Export from the `@vaultfolio/earnings` index
- [x] T008 [P] Create `libs/frontend/domain/earnings/src/lib/pdf/text-recogniser.ts`: `TextRecogniser` port (injectable token), `RecognitionProgress` (`phase`, `page`, `pageCount`, `fraction`), `RecognitionResult` (`{ text } | { error: 'NO_TEXT' | 'TOO_MANY_PAGES' | 'ENGINE_UNAVAILABLE' | 'CANCELLED' }`), `MAX_RECOGNITION_PAGES = 5`, per contracts/ocr-lib.md
- [x] T009 [P] Create `libs/frontend/domain/earnings/src/lib/pdf/ocr-layout.ts` (+ `ocr-layout.spec.ts`): convert tesseract words (bbox px, confidence) into `PdfPageText`: x = x0/scale, width = (x1−x0)/scale, y in PDF points growing upward; drop empty words and confidence < 30; flatten all words per page and regroup rows by vertical centre with tolerance ≈ half the median word height (do NOT use tesseract's own lines, research R4); sort rows top→bottom, words left→right; apply `ocr-normalise` (T007); set `origin: 'RECOGNISED'`. Tests: table-row regrouping, sorting, coordinate flip, confidence floor
- [x] T010 Create `libs/frontend/domain/earnings/src/lib/pdf/tesseract-recogniser.ts` implementing `TextRecogniser` (depends on T008, T009): lazy `import('tesseract.js')` mirroring `loadPdfJs()`; render pages with PDF.js at scale 3 reducing scale to keep ≤ ~25 MP per page; one worker reused across pages and terminated afterwards, `deu` + LSTM only; `workerPath`/`corePath`/`langPath` → same-origin `assets/tesseract/…`, `gzip: false`, `cacheMethod: 'none'`; enforce `TOO_MANY_PAGES` before rendering; emit progress at least per page; `AbortSignal` ⇒ terminate worker, release canvases, resolve `CANCELLED`; map load failures to `ENGINE_UNAVAILABLE`; empty result ⇒ `NO_TEXT`; never reject, never log document content
- [x] T011 Create `libs/frontend/domain/earnings/src/lib/pdf/tesseract-recogniser.spec.ts` with `tesseract.js` and PDF.js mocked: asserts same-origin asset config, page limit, cancellation cleanup, error mapping, progress, `origin: 'RECOGNISED'`, no document content logged
- [x] T012 [P] Add a scriptable fake recogniser (`libs/frontend/domain/earnings/src/lib/pdf/text-recogniser.testing.ts`) for store/component tests: scripted text, progress ticks, errors, delay + abort support
- [x] T013 Provide the real `TextRecogniser` in the earnings area providers and export the port/types from the `frontend/domain/earnings` lib index

**Checkpoint**: Recogniser port, adapter and conversion are ready and tested; stories can begin.

---

## Phase 3: User Story 1 - Import a scanned or "text-as-shapes" payslip (Priority: P1) 🎯 MVP

**Goal**: A PDF without a text layer yields a consent offer; after consent, progress is shown; a matching parser produces preview rows marked "read via text recognition" with a double-check prompt; the marker persists with the saved record and appears in the imports list.

**Independent Test**: Select an image-only PDF in a supported layout, accept recognition, confirm the preview row carries the recognition marker/notice, that a failing plausibility check blocks saving as before, and that the saved row shows the badge.

### Tests for User Story 1

> Write these first and make sure they fail before implementing.

- [x] T014 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/import/import-session.store.spec.ts`: `IMAGE_ONLY` ⇒ `awaitingRecognitionConsent` (recogniser NOT called); `acceptRecognition` ⇒ `recognising(progress)` ⇒ normal parse pipeline; rows get `recognisedText = true`; arithmetic-check failure flags the row exactly as for text PDFs; consent resets when the file is removed/replaced; text-based PDFs never trigger the offer (SC-006)
- [x] T015 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.spec.ts`: offer (`ocr-offer`/`ocr-accept`/`ocr-decline`), progress (`ocr-progress`, `role="status"`, "Page n of N"), `ocr-notice` in preview, `ocr-badge` on the file row
- [x] T016 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/imports/earnings-imports.component.spec.ts`: `ocr-badge` shown in the Source column for `recognisedText: true` only
- [x] T017 [P] [US1] Extend `apps/backend/src/earnings/earnings.repository.spec.ts` and `apps/backend/src/earnings/earnings.controller.spec.ts` (and `apps/backend/src/database/database.service.spec.ts` for the migration): `recognisedText` persisted, defaults to `false`, always returned; migration is idempotent
- [x] T018 [P] [US1] Extend `apps/backend/src/tests/earnings.e2e-spec.ts`: import with `recognisedText: true` is persisted and returned by the imports list; omitted ⇒ `false`; arithmetic checks, fingerprint and amount encryption unaffected
- [ ] T019 [P] [US1] Add opt-in real-engine spec `libs/frontend/domain/earnings/src/lib/pdf/ocr.integration.spec.ts` (skipped when `assets/tesseract` files are absent): render a synthetic image-only payslip fixture of a supported layout via PDF.js (`@napi-rs/canvas`), run real tesseract.js, assert word geometry and that a supported parser accepts the result. Fixtures are synthetic — never commit `tmp/` samples with real personal data

### Implementation for User Story 1

- [x] T020 [P] [US1] Add optional `recognisedText?: boolean` to `EarningsImportFile` (and the import commit/preview payload types) in `libs/api-contract/src/lib/earnings.ts`, `libs/earnings/src/lib/import-file.ts` and validation in `libs/earnings/src/lib/validation.ts` if import payloads are validated there (boolean only, default `false`; no effect on checks or fingerprint)
- [x] T021 [US1] Add idempotent guarded `ALTER TABLE … ADD COLUMN ocr_read INTEGER NOT NULL DEFAULT 0` on the earnings import-files table in `apps/backend/src/database/database.service.ts` (same pattern as existing additive migrations; not part of encrypted data)
- [x] T022 [US1] Persist and return `recognisedText` ⇄ `ocr_read` in `apps/backend/src/earnings/earnings.repository.ts`, `earnings.service.ts` and `earnings.controller.ts` (depends on T020, T021); no behaviour depends on the flag
- [x] T023 [US1] OpenAPI: add the matching `@Api…` decorator/property for `recognisedText` in `apps/backend/src/openapi/dto/earnings.ts`, run `npx nx run backend:openapi` and commit the regenerated `api/openapi.yml`; confirm `npx nx run backend:openapi:check` passes
- [x] T024 [US1] Extend `libs/frontend/domain/earnings/src/lib/import/import-session.store.ts` (depends on T012, T013): per-file state `awaitingRecognitionConsent | recognising(progress) | …`; actions `acceptRecognition(fileId)`, `declineRecognition(fileId)`, `cancelRecognition(fileId)` (own `AbortController`); on success run the normal parse pipeline and set `recognisedText = true` on the file's rows; include the flag in the saved payload; reset on file removal/replacement and on destroy
- [x] T025 [US1] Update `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.ts` (+ template): replace the `IMAGE_ONLY` rejection row with the undecided row (scan icon, "Needs your decision" tag, info box, primary "Read text on this device", outline "Not now", lock note), the reading row (progress bar "Page n of N", Cancel, live region), the warning callout "Read via text recognition" above the preview, and the "Text recognition" tag on the file row; add the `data-testid`s listed above
- [x] T026 [US1] Show the "Text recognition" tag (`ocr-badge`) in the Source column in `libs/frontend/domain/earnings/src/lib/imports/earnings-imports.component.ts`
- [x] T027 [US1] Add DE + EN strings for offer, consent info box, progress, preview notice, badge in `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.de.ts` / `earnings.en.ts` (kept in sync; `earnings-translations.spec.ts` must pass)
- [ ] T028 [US1] Verify via the `verify-ui` skill: image-only supported payslip → offer appears and nothing starts before the click → accept → progress → preview marker/notice → failing figures editable and Save disabled until the check passes → save → badge in the imports list (throw-away script in the scratchpad, not committed)

**Checkpoint**: US1 is fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Decline or fail recognition (Priority: P1)

**Goal**: Declining, cancelling, failing or empty recognition always ends in the existing "no automatically readable text" message with nothing created; corrupt/protected PDFs never get the offer.

**Independent Test**: Decline → refusal message; run recognition on a blank page → same message; cancel mid-run → stops, nothing retained.

### Tests for User Story 2

- [x] T029 [P] [US2] Extend `libs/frontend/domain/earnings/src/lib/import/import-session.store.spec.ts`: decline ⇒ `IMAGE_ONLY` message and recogniser never called; `NO_TEXT` ⇒ same message, no rows; `CANCELLED` (cancel action and store destroy) ⇒ same message, worker released, nothing retained; `TOO_MANY_PAGES` / `ENGINE_UNAVAILABLE` ⇒ same message plus a specific hint; password-protected/corrupt PDFs ⇒ no offer (FR-013)
- [x] T030 [P] [US2] Extend `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.spec.ts`: refusal text (`image-only-message`) with the "Read text on this device instead" link after decline; hint lines for page limit and engine failure

### Implementation for User Story 2

- [x] T031 [US2] Implement the decline/cancel/failure outcomes in `libs/frontend/domain/earnings/src/lib/import/import-session.store.ts` and `earnings-import.component.ts`: map `RecognitionResult` errors per contracts/ocr-lib.md "Error message mapping", re-offer via the "instead" link (new consent), stop recognition on file removal/selecting another file/route leave, and discard intermediate data
- [x] T032 [P] [US2] Add DE + EN strings for the page-limit hint (names the limit 5), the engine-unavailable hint and the "instead" link in `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.de.ts` / `earnings.en.ts`
- [ ] T033 [US2] Verify via `verify-ui`: decline path, blank-page path, cancel mid-run, and a >5-page PDF; confirm identical refusal text to today (SC-007)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Request a parser for a recognised document (Priority: P2)

**Goal**: When recognition succeeds but no parser matches, the request flow opens with the recognised content (no second consent), shows the "recognised automatically, may contain errors" notice, and the personal-data scan removes look-alike identifiers even when digits are misread; send stays blocked until the rescan is clean; the server scan stays strict and unchanged.

**Independent Test**: Recognise an unsupported-layout document, start a request, verify the notice and removal of misread IBAN/tax ID/SV numbers, and that sending only works after the existing safeguards pass.

### Tests for User Story 3

- [ ] T034 [P] [US3] Extend `libs/earnings/src/lib/parser-request/personal-data.spec.ts`: lenient mode matches shape-only IBAN (`DE` + digit-like characters incl. `O/o/l/I/S`, whitespace-tolerant, DE length 22), tax ID (11 digit-like, first ≠ 0, no decimal separators), SV number (`\d{2} \d{6} [A-Z] \d{3}` shape); strict remains the default and unchanged; email/phone/postcode+city unchanged
- [ ] T035 [P] [US3] Add a property-style misread-digit test (new `libs/earnings/src/lib/parser-request/personal-data.lenient.spec.ts`): inject 1–2 substitutions from the OCR confusion set into valid IBANs/tax IDs/SV numbers and assert none survives lenient scan + rescan (SC-005); include the observed `DE0O3 7601 0085 0004 0XXX XX 94478` pattern
- [ ] T036 [P] [US3] Extend `libs/frontend/domain/earnings/src/lib/parser-request/parser-request.store.spec.ts`: consent/progress steps before analysis when the document is image-only; `RECOGNISED` origin ⇒ lenient scan used; recognised flag exposed to the preview; send blocked while the rescan finds personal data; no second consent when entering from an already-recognised import row
- [ ] T037 [P] [US3] Extend `libs/frontend/domain/earnings/src/lib/parser-request/parser-request.component.spec.ts` and `libs/frontend/domain/earnings/src/lib/import/request-parser-button.spec.ts`: "Request a parser" is available on the no-parser-matches row of a recognised document; `request-ocr-notice` shown in step 4
- [ ] T038 [P] [US3] Extend `libs/frontend/domain/earnings/src/lib/parser-request/layout-extractor.spec.ts`: recognised `PdfDocumentText` feeds the extractor; wire format `layout-submission-v1` is unchanged and carries no OCR provenance

### Implementation for User Story 3

- [ ] T039 [US3] Add `{ lenient?: boolean }` to `scanLine` / `scanDocument` in `libs/earnings/src/lib/parser-request/personal-data.ts` (shape-based IBAN / tax ID / SV rules per research R6; strict stays default and the only server mode); document the over-matching trade-off in a code comment; keep the server scan untouched (033 FR-017)
- [ ] T040 [US3] Extend `libs/frontend/domain/earnings/src/lib/parser-request/parser-request.store.ts` and `parser-request.component.ts`: same consent/progress/cancel states as the import store (reuse the `TextRecogniser`), pass `lenient` when `origin === 'RECOGNISED'`, expose a `recognised` flag, accept already-recognised text handed over from the import flow so no second consent is requested
- [ ] T041 [US3] Update `libs/frontend/domain/earnings/src/lib/import/earnings-import.component.ts` (no-parser-matches row): add the recognition tag, extend the explanatory text ("read via text recognition"), keep the existing **Request a parser** button and hand over the recognised text
- [ ] T042 [US3] Update `libs/frontend/domain/earnings/src/lib/parser-request/steps/preview-send.step.ts` (and `review-words.step.ts` / sheet components as needed): warning callout "recognised automatically and may contain errors" (`request-ocr-notice`), success callout listing removed kinds only (never the data) incl. the "look-alike values removed even if a digit was misread" statement, legend and low-confidence word underline per design.md screen 6; steps 1–3 unchanged
- [ ] T043 [P] [US3] Add DE + EN strings in `libs/frontend/shared-ui/src/lib/i18n/translations/requests.de.ts` / `requests.en.ts` (`requests-translations.spec.ts` must pass)
- [ ] T044 [US3] Verify via `verify-ui` with `tmp/2025_01.pdf` (manual validation only, never committed): accept recognition → "Request a parser" → recognised content with notice; IBAN/tax-ID areas removed despite misreads; send blocked until the rescan is clean

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Privacy and documentation stay truthful (Priority: P2)

**Goal**: The offer and the Earnings privacy note state that recognition runs on the device; DE/EN complete; user guide and affected specs describe the fallback; network inspection proves nothing leaves the device.

**Independent Test**: Full flow with network inspection shows no file/text content in any request and no third-party host; DE/EN texts and guide reviewed.

- [ ] T045 [P] [US4] Update the Earnings privacy note component under `libs/frontend/domain/earnings/src/lib/privacy-note/` (+ its spec) and its DE/EN strings in `earnings.de.ts` / `earnings.en.ts` to describe on-device text recognition (nothing leaves the device; recognised text is raw text under the same rules)
- [ ] T046 [P] [US4] Update `docs/user-guide.md` and `docs/user-guide.de.md` (recognition offer, double-check marker, limits: German only, ≤ 5 pages, digits can be misread) and `docs/development.md` / `docs/development.de.md` (engine port, assets in `assets/tesseract/`, opt-in integration spec)
- [ ] T047 [P] [US4] Update affected spec docs beyond T002/T003 (e.g. 032/033 `plan.md`/`data-model.md` cross-references) so they no longer state "OCR out of scope" / "text-based only" without the 034 amendment note
- [ ] T048 [US4] Verify via `verify-ui`: toggle DE/EN across the whole flow (no missing keys); DevTools/Playwright network capture shows zero requests carrying file or text content and tesseract assets served only from `/assets/tesseract/` (SC-004)

**Checkpoint**: All user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T049 Run `npx nx run-many -t test -p earnings frontend-domain-earnings backend api-contract` and `npx nx run-many -t lint -p earnings frontend-domain-earnings backend`; fix findings
- [ ] T050 Run `npx nx build frontend` (production): initial bundle budget unaffected, tesseract assets emitted, WASM/worker lazy-loaded only on consent
- [ ] T051 Run `npx nx run backend:openapi:check` (drift detection) and the backend e2e suite
- [ ] T052 Run the full quickstart.md validation (sections 1–4), including the manual DATEV flow; record any digit-accuracy findings in research.md as follow-up input (per-field digit-whitelist re-recognition idea)
- [ ] T053 Run `/speckit-sonar-validate` for the branch and fix issues / coverage gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001–T003 (governance) MUST be done before any implementation task (FR-016)
- **Foundational (Phase 2)**: depends on T004/T005; blocks all stories
- **US1 (P1)**: after Phase 2 — no dependency on other stories (MVP)
- **US2 (P1)**: after Phase 2; builds on the US1 store/component states (T024/T025) — implement right after US1
- **US3 (P2)**: after Phase 2; T041 touches the same component as T025/T031, so sequence it after those; T039 (lenient scan) is independent
- **US4 (P2)**: documentation/privacy work can start after Phase 1; T048 needs the full flow
- **Polish**: after all desired stories

### Within Each Story

- Tests first (must fail) → pure libs/contract → backend → stores → components → i18n → `verify-ui`
- Same-file tasks are sequential (e.g. T024 → T031 in `import-session.store.ts`; T025 → T031 → T041 in `earnings-import.component.ts`)

### Parallel Opportunities

- Setup: T002 ∥ T003
- Foundational: T006 ∥ T007 ∥ T008 ∥ T009 ∥ T012, then T010 → T011 → T013
- US1: tests T014–T019 all parallel; T020 ∥ T021 then T022 → T023; backend track (T020–T023) ∥ frontend track (T024–T027)
- US3: T034–T038 parallel; T039 ∥ T043
- US4: T045 ∥ T046 ∥ T047

### Parallel Example: User Story 1

```text
# Tests together:
Task: "Extend import-session.store.spec.ts (T014)"
Task: "Extend earnings-imports.component.spec.ts (T016)"
Task: "Extend earnings.repository.spec.ts / controller spec (T017)"
Task: "Extend earnings.e2e-spec.ts (T018)"

# Backend track ∥ frontend track:
Task: "Persist recognisedText end to end (T020–T023)"
Task: "Store + component consent/progress/marker (T024–T027)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (governance first) → Phase 2 (engine, port, conversion)
2. Phase 3 (US1): consent → recognition → preview marker → persisted badge
3. **STOP and VALIDATE** with the synthetic image-only fixture via `verify-ui`
4. Immediately add US2 — it is P1 and completes the "never trap the user" guarantee before anything ships

### Incremental Delivery

1. Setup + Foundational → engine ready
2. US1 + US2 → importable scans with a safe default (ship candidate)
3. US3 → parser requests for recognised documents (lenient personal-data scan)
4. US4 → privacy note, guide, network verification
5. Polish → Sonar, coverage, quickstart

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- Do not relax the arithmetic plausibility check or add numeric "healing" (spec FR-005, research R5)
- Nothing derived from a document is persisted, cached or logged; `cacheMethod: 'none'`
- Commit after each task or logical group (conventional commits)
