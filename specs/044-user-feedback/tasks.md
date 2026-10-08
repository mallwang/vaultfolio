# Tasks: User Feedback

**Input**: Design documents from `/specs/044-user-feedback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/feedback-api.md, quickstart.md, mockup.html

**Tests**: Included. The constitution requires exact-value quota boundary tests and e2e/integration tests for module-to-module flows.

**Organization**: Grouped by user story. US1 (send) is the MVP; US2/US3 are frontend behaviour on top of the same dialog; US4/US5 are server-enforced rules that US1 only wires in minimally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1..US5 (user story phases only)
- All commands go through `npx nx ...` (npm, never pnpm). Never read `.env` or `environment.local.ts`.

---

## Phase 1: Setup

**Purpose**: Shared contract and icon used by both apps.

- [ ] T001 [P] Create `libs/api-contract/src/lib/feedback.ts` with `FEEDBACK_CATEGORIES`, `FEEDBACK_SUBJECT_MAX=100`, `FEEDBACK_MESSAGE_MAX=2000`, `FEEDBACK_DAILY_LIMIT=5`, `FEEDBACK_WINDOW_HOURS=24`, request/response/quota types and error-code union (`validation_error`, `bot_protection_failed`, `feedback_limit_reached`, `feedback_delivery_failed`, `feedback_unavailable`) per contracts/feedback-api.md; export from `libs/api-contract/src/index.ts`
- [ ] T002 [P] Add `'feedback'` to `ENCRYPTION_DOMAIN_IDS` in `libs/api-contract/src/lib/encryption.ts`
- [ ] T003 [P] Add a `feedback` entry (Material icon, e.g. `rate_review`/`feedback`) to `libs/frontend/shared-ui/src/lib/icon/icon-name.map.ts`
- [ ] T004 [P] Verify the PrimeNG 22 `p-dialog` inputs `closable`, `closeOnEscape`, `dismissableMask`, `modal` (Context7 `/primefaces/primeng`) and note the confirmed names as a comment-free decision in the T027 implementation

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Backend persistence, encryption domain and the mail template. No endpoint behaviour yet.

- [ ] T005 Add table `feedback_submissions` and index `idx_feedback_owner_created (owner_id, created_at)` to `initializeSchema()` in `apps/backend/src/database/database.service.ts` per data-model.md (category CHECK, `payload_enc`, `key_version`)
- [ ] T006 Register the `feedback` domain with `payloadTable('feedback_submissions')` in `apps/backend/src/encryption/domain-encryption.registry.ts` and extend `apps/backend/src/encryption/domain-encryption.registry.spec.ts`
- [ ] T007 Wire the `feedback` domain into rotation/startup/admin screens: check `encryption-admin.controller.ts`, `apps/backend/src/openapi/dto/encryption.ts`, `apps/backend/src/tests/encryption-e2e.helpers.ts` (add an insert fixture for `feedback_submissions`), and the encryption specs so the new id is covered
- [ ] T008 [P] Add `feedback` label to `libs/frontend/shared-ui/src/lib/i18n/translations/encryption.en.ts` and `encryption.de.ts`, and extend the list in `encryption-translations.spec.ts`
- [ ] T009 [P] Add notification type `feedback-admin-notice` to `libs/notifications/src/lib/types.ts` and templates `libs/notifications/src/lib/templates/feedback-admin-notice/` (en, de): subject `[Feedback: <category>] <subject>`, body with category, subject, message, sender name/email, sender language; extend `notification-renderer.spec.ts` (render en+de, HTML-escaping of subject/message)
- [ ] T010 [P] Create `apps/backend/src/feedback/feedback.repository.ts` (insert row, `findById(id, ownerId)`, `listSince(ownerId, sinceIso)`) with unit spec using the raw better-sqlite3 test DB pattern of `account-overview`
- [ ] T011 [P] Create `apps/backend/src/feedback/feedback-crypto.service.ts` (encrypt/decrypt `{subject,message}` with AAD `feedback_submissions|<id>|<owner_id>`, modelled on the account-overview crypto service) and `feedback-available.guard.ts`-style availability check returning 503 `feedback_unavailable` when the domain key is unavailable; unit spec
- [ ] T012 Check account deletion/retention purge (`apps/backend/src/accounts/accounts.service.ts` and users service): decide whether `feedback_submissions` rows of a deleted user must be removed like other owner data; implement the same cleanup if other owner tables are cleaned, otherwise record "kept for traceability" in research.md

**Checkpoint**: Table, encryption domain, template and repository/crypto exist and are unit-tested.

---

## Phase 3: User Story 1 - Member sends feedback (P1) 🎯 MVP

**Goal**: A signed-in member fills the dialog, submits, mails reach all admins in their language, row is stored encrypted, dialog closes after confirmed delivery.

**Independent Test**: quickstart scenario 1: submit as the test account; admin mailbox receives mail; dialog closes with toast; DB row has no plaintext.

### Tests for US1

- [ ] T013 [P] [US1] Backend e2e `apps/backend/src/feedback/feedback.e2e-spec.ts`: happy path 201 (mail per admin in admin language, row stored, ciphertext at rest, no plaintext in DB), validation errors (empty, over limit, bad category/attemptId), 502 when no admins or SMTP fails (nothing stored), 503 when key unavailable (no mail sent), 201 + `FeedbackStoreFailed` log when mail ok but insert fails
- [ ] T014 [P] [US1] Unit spec `apps/backend/src/feedback/feedback.service.spec.ts` for the send flow order (validate → key → idempotency → quota → mail → insert)
- [ ] T015 [P] [US1] Vitest `apps/frontend/src/app/core/feedback/feedback.store.spec.ts`: open/close, send success closes + toast + quota refresh, send keeps dialog open while pending (double submit sends one request with the same `attemptId`)
- [ ] T016 [P] [US1] Vitest `apps/frontend/src/app/core/feedback/feedback-dialog/feedback-dialog.component.spec.ts`: required-field/length errors with counters, category select, submit disabled while invalid/pending

### Implementation for US1

- [ ] T017 [P] [US1] Create `apps/backend/src/feedback/feedback-email.service.ts` (one mail per admin via `MailerService`, per-admin `emailLanguage`, throws when no admins or any send fails per contracts/feedback-api.md)
- [ ] T018 [US1] Create `apps/backend/src/feedback/feedback.service.ts` (`send()` per research flow with in-process per-user lock, `quota()` placeholder returning remaining/limit) and `feedback.exceptions.ts`
- [ ] T019 [US1] Create `apps/backend/src/feedback/feedback.controller.ts` (`POST /feedback` with `@TurnstileAction('feedback') @UseGuards(TurnstileGuard)`, `GET /feedback/quota`) and `feedback.module.ts`; register `FeedbackModule` in `apps/backend/src/app/app.module.ts`
- [ ] T020 [P] [US1] Add Swagger DTOs `apps/backend/src/openapi/dto/feedback.ts`, re-export in `apps/backend/src/openapi/dto/index.ts`, and regenerate `api/openapi.yml` (use the repo's openapi nx target; check `--help` first)
- [ ] T021 [P] [US1] Add i18n `libs/frontend/shared-ui/src/lib/i18n/translations/feedback.en.ts` and `feedback.de.ts` (dialog labels, categories, errors, toast, quota footer text, cancel confirm) with a parity spec; register in the translation index
- [ ] T022 [US1] Create `apps/frontend/src/app/core/feedback/feedback.store.ts` (open state, generated `attemptId` per attempt, `send()` via `HttpClient` to `/feedback`, quota signal via `GET /feedback/quota`)
- [ ] T023 [US1] Create `apps/frontend/src/app/core/feedback/feedback-dialog/` (`p-dialog` per T004, category, subject, message with char counters, `app-turnstile` row, submit/cancel, sending state, success toast on 201) with `data-testid`s (`feedback-dialog`, `feedback-category`, `feedback-subject`, `feedback-message`, `feedback-submit`, `feedback-cancel`) per `docs/frontend/testid-conventions.md` Match the approved layout in `design.md` / `mockup.html`.
- [ ] T024 [US1] Create `apps/frontend/src/app/core/feedback/feedback-button/` and place it left of the hints bell in `apps/frontend/src/app/core/layout/app-header/app-header.component.{html,ts}` (testid `feedback-button`), mount the dialog in the app shell; update `app-header.component.spec.ts`
- [ ] T025 [US1] Run the `verify-ui` skill: sign in with the test account, send feedback, confirm dialog closes and toast appears (desktop + mobile width, light + dark)

**Checkpoint**: MVP: feedback can be sent and arrives encrypted-at-rest + mailed.

---

## Phase 4: User Story 2 - Dialog protects against accidental loss (P1)

**Goal**: Only Cancel closes the dialog; Escape acts as Cancel; confirm when text exists.

**Independent Test**: quickstart scenario 2.

- [ ] T026 [P] [US2] Extend `feedback-dialog.component.spec.ts`: backdrop click keeps open; Escape triggers cancel; empty → closes immediately; text → in-dialog confirm (confirm closes + discards, decline returns); cancel disabled while sending
- [ ] T027 [US2] Implement in `feedback-dialog.component.{ts,html}`: `closable=false`, `dismissableMask=false`, `closeOnEscape=false`, manual Escape handler → cancel flow, in-dialog cancel confirm (testids `feedback-cancel-confirm`, `feedback-cancel-keep`), cancel disabled while pending; focus trap and `aria-live` error region (FR-016)
- [ ] T028 [US2] `verify-ui`: click backdrop, press Escape, cancel empty vs. with text; keyboard-only pass (Tab order, focus return to the header button)

---

## Phase 5: User Story 3 - Failed sends keep the draft (P1)

**Goal**: Failure keeps the dialog open with an error, stores a per-user draft, restores it on reopen, shows a hint in the notification center.

**Independent Test**: quickstart scenario 3.

### Tests for US3

- [ ] T029 [P] [US3] `apps/frontend/src/app/core/feedback/feedback-draft.spec.ts`: parse/serialize, wrong version/garbage → absent, `isEmpty`
- [ ] T030 [P] [US3] `feedback-draft-storage.spec.ts`: per-user key `vaultfolio.feedback-draft.<userId>`, user separation, storage throwing is swallowed
- [ ] T031 [P] [US3] `feedback-hint-provider.spec.ts`: hint `feedback.draft` present only while a draft exists, `ready` true, target `['/app']` with `{feedback:'draft'}`

### Implementation for US3

- [ ] T032 [P] [US3] Create `apps/frontend/src/app/core/feedback/feedback-draft.ts` (pure type, parse, serialize, isEmpty)
- [ ] T033 [US3] Create `feedback-draft-storage.ts` (best-effort per-user localStorage load/save/clear, reactive `hasDraft` signal)
- [ ] T034 [US3] Update `feedback.store.ts`: save draft on any failed send (network/502/503/403/429), restore draft when opening, clear on success or confirmed discard
- [ ] T035 [US3] Dialog error banners for delivery failure / unavailable / network with retry hint, mapped from error codes (testids `feedback-error-banner`)
- [ ] T036 [P] [US3] Create `feedback-hint-provider.ts` (`HintProvider`, id `feedback.draft`, info severity) and add the entry (`sourceId:'feedback'`, no `domainId`, `groupLabelKey`) to `apps/frontend/src/app/core/hints/hint-providers.registry.ts`
- [ ] T037 [P] [US3] Add hint texts and group label to `libs/frontend/shared-ui/src/lib/i18n/translations/hints.en.ts` and `hints.de.ts` (+ parity spec update)
- [ ] T038 [US3] In the shell, open the dialog when the route has `?feedback=draft` and strip the param (`app-shell` or the feedback button host component); spec for the param handling
- [ ] T039 [US3] `verify-ui`: force a failing send (e.g. Playwright route abort), confirm error + draft restore after reload + hint in the bell opens the dialog; second user does not see the draft

---

## Phase 6: User Story 4 - Daily limit enforced and visible (P2)

**Goal**: 5 delivered feedbacks per rolling 24 h per user, server-enforced, visible in the dialog.

**Independent Test**: quickstart scenario 4.

- [ ] T040 [P] [US4] Exact-value unit tests in `feedback.service.spec.ts` for quota arithmetic: 4 → remaining 1; 5 → 429 with `quota`; row at exactly 24 h no longer counts; `resetAt` = oldest + 24 h; failed attempts do not count; idempotent retry of a stored `attemptId` returns 201 without a new row/mail even at the limit
- [ ] T041 [P] [US4] Extend `feedback.e2e-spec.ts`: sixth request → 429 `feedback_limit_reached` with quota body, `GET /feedback/quota` values, concurrent requests of one user cannot exceed 5
- [ ] T042 [US4] Implement real quota in `feedback.service.ts` (rolling window from stored rows, per-user lock covering quota + idempotency) and the 429 body
- [ ] T043 [US4] Dialog quota footer (remaining, reset time, localized), submit disabled with explanation at limit while editing/draft stays possible, quota refresh after send and on 429; testids `feedback-quota`, `feedback-limit-banner`; Vitest cases in the dialog/store specs
- [ ] T044 [US4] `verify-ui`: use the synthetic test account to reach the limit (5 sends) and confirm footer, disabled submit and draft editing

---

## Phase 7: User Story 5 - Bot protection (P2)

**Goal**: Submission requires a valid Turnstile result; rejection does not count and keeps the draft.

**Independent Test**: quickstart scenario 5.

- [ ] T045 [P] [US5] Extend `feedback.e2e-spec.ts`: missing/invalid token → 403 `bot_protection_failed`, nothing stored, quota unchanged
- [ ] T046 [US5] Dialog: gate submit on the Turnstile token, reset `app-turnstile` after every failed attempt, show retry message on 403 and keep the draft (reuse existing `app-turnstile` as in the signup/login forms); Vitest case
- [ ] T047 [US5] `verify-ui`: confirm challenge row renders and resets after a failed attempt

---

## Phase 8: Polish & Cross-Cutting

- [ ] T048 [P] Add `docs`/`CLAUDE.md`-style notes only where a convention changed (e.g. list `feedback` in encryption domain docs under `docs/` if domains are enumerated there; grep first)
- [ ] T049 Run `npx nx run-many -t lint test typecheck -p backend frontend api-contract notifications shared-ui` (adjust project names via `npx nx show projects`), fix failures; run the backend e2e target
- [ ] T050 Run the SonarQube check via `mcp__sonarqube__*` tools on the branch/PR for new issues and coverage of changed files
- [ ] T051 Walk through `quickstart.md` end to end and fix gaps

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → (US2, US3, US4, US5).
- Within Phase 2: T005 before T010/T011/T012; T006 before T007; T009 independent.
- US1: backend (T017–T020) and frontend (T021–T024) can proceed in parallel after Phase 2; T025 needs both.
- US2 builds on the US1 dialog (T023). US3 builds on the US1 store/dialog. US4 builds on the US1 service. US5 builds on T019/T023.
- US2, US3, US4, US5 are independent of each other after US1 (US3 and US5 both touch dialog files, so serialise those edits).

## Parallel Examples

- Phase 1: T001, T002, T003, T004 together.
- Phase 2: T008, T009, T010, T011 together after T005.
- US1: T013–T016 (tests) together; T017, T020, T021 together; then T018 → T019 and T022 → T023 → T024.
- US3: T029, T030, T031, T032, T036, T037 together.

## Implementation Strategy

1. **MVP**: Phases 1–3 (send works end to end, encrypted at rest). Stop and validate with quickstart scenario 1.
2. Add US2 and US3 (both P1) so no text can be lost, then US4 and US5 (P2). Note: the daily limit and Turnstile guard are structurally present from US1 (guard on the route); US4/US5 phases harden and surface them.
3. Polish and Sonar.
