---
description: 'Task list for Localized, Templated Email Notifications'
---

# Tasks: Localized, Templated Email Notifications

**Input**: Design documents from `/specs/015-localized-email-notifications/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notifications-lib.md, quickstart.md

**Tests**: Included — Principle IV requires the new library's public contract to be tested against
real `.hbs` files, and Principle III applies standard implement-then-test coverage to the modified
`EmailService` classes.

**Organization**: Tasks are grouped by user story (spec.md P1–P3, plus P2 US4) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Nx monorepo: `libs/notifications/src/` (new framework-independent library), `apps/backend/src/mail/`
(new shared SMTP-transport module), `apps/backend/src/{profile,signups,invitations}/` (modified
`EmailService` adapters and call sites) — per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Add the new dependency and scaffold the new library so later phases have somewhere to put code.

- [x] T001 Add `handlebars` as a runtime dependency in `package.json` (root) and
      `apps/backend/package.json`, matching the existing pattern for shared runtime deps (e.g.
      `decimal.js`, per `libs/domain/holdings/package.json`); run `npm install` at the repo root.
- [x] T002 Scaffold the new `libs/notifications` Nx library (`@vaultfolio/notifications`):
      `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json`, `jest.config.cts`, `project.json`
      (tags `scope:libs`, buildable + testable targets mirroring `libs/domain/holdings/project.json`),
      `package.json` with `"dependencies": { "handlebars": "^<installed-version>" }` (per the
      `domain-holdings` non-empty-deps pattern), and an empty `src/index.ts`.

**Checkpoint**: `npm exec nx test notifications` runs (no tests yet) and the library builds.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on — language resolution, the rendering
engine, shared partial content, and the consolidated SMTP transport. No user-story work can begin
until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Define the public contract types in `libs/notifications/src/lib/types.ts`:
      `NotificationType` union (7 values per data-model.md), `RenderedNotificationEmail`,
      `RenderNotificationRequest<V>`, re-exporting `LanguageCode` from `@vaultfolio/api-contract` —
      per contracts/notifications-lib.md §1.
- [x] T004 [P] Implement `resolveLanguage` in `libs/notifications/src/lib/language-resolution.ts`:
      `isSupportedLanguageCode(preferredLanguage) ? preferredLanguage : DEFAULT_LANGUAGE_CODE`, reusing
      `@vaultfolio/api-contract`'s `SUPPORTED_LANGUAGES`/`DEFAULT_LANGUAGE_CODE`/
      `isSupportedLanguageCode` (FR-002).
- [x] T005 [P] Unit tests for `resolveLanguage` in
      `libs/notifications/src/lib/language-resolution.spec.ts`: `null` → `'en'`, unsupported (e.g.
      `'fr'`) → `'en'`, `'de'` → `'de'`.
- [x] T006 Implement `renderNotification` in `libs/notifications/src/lib/notification-renderer.ts`:
      loads `templates/<type>/<lang>.{subject,html,text}.hbs` and `partials/<name>/<lang>.hbs` from
      disk, registers partials with Handlebars keyed `<name>-<lang>`, compiles once and caches
      in-process per `type+lang+file`, resolves the recipient's language via `resolveLanguage`, and
      independently falls back to `DEFAULT_LANGUAGE_CODE`'s files for that specific type when the
      resolved language's files don't exist for it (FR-003) — **file-existence driven, no
      per-language branching**, so a new language needs no changes to this file (US3). Throws only if
      the English fallback files for a type are themselves missing/malformed. `language` on the result
      reflects the language actually rendered (contracts/notifications-lib.md §1.2–1.3).
- [x] T007 [P] Create shared partials in `libs/notifications/src/lib/partials/{header,footer,salutation,signature}/{en,de}.hbs`
      (branding/logo header, footer, `{{name}}`-parameterized salutation, sign-off signature) — reused
      by every notification template (FR-005).
- [x] T008 Create `apps/backend/src/mail/mailer.module.ts` and `apps/backend/src/mail/mailer.service.ts`:
      consolidate the three duplicated `nodemailer.createTransport({...})` + `process.env.SMTP_*`
      blocks (currently in `profile/email.service.ts`, `signups/email.service.ts`,
      `invitations/email.service.ts`) into one `MailerService.send({to, subject, html, text})`
      (contracts/notifications-lib.md §3); reads `SMTP_HOST`/`SMTP_PORT` (default `587`)/`SMTP_USER`/
      `SMTP_PASSWORD` (auth only if `SMTP_USER` set)/`SMTP_FROM`/new `SMTP_SENDER_NAME`; passes
      `from: { name: SMTP_SENDER_NAME, address: SMTP_FROM }` when `SMTP_SENDER_NAME` is set, else the
      bare `SMTP_FROM` string (FR-008/FR-009, nodemailer performs RFC 5322/2047 encoding — FR-010);
      logs errors (never credentials/tokens) and rethrows, preserving today's 502-mapping behavior at
      callers.
- [x] T009 [P] Unit tests for `MailerService` in `apps/backend/src/mail/mailer.service.spec.ts`:
      `SMTP_SENDER_NAME` set → structured `from`; unset → bare `SMTP_FROM` (FR-009); a value
      containing a double-quote and a comma still produces a valid encoded `from` and does not throw
      (FR-010); send failure is logged and rethrown.

**Checkpoint**: Foundation ready — language resolution, generic rendering engine, shared partials,
and the consolidated mail transport all exist and are unit-tested; user story implementation can
now begin.

---

## Phase 3: User Story 1 - Receive emails in the preferred correspondence language (Priority: P1) 🎯 MVP

**Goal**: Every one of the 7 notification types is rendered from real template content and sent
through `MailerService`, in the recipient's resolved language, with existing sending
logic/who-and-when unchanged (FR-001, FR-002, FR-003, FR-007, FR-011, FR-012).

**Independent Test**: Set a test user's `email_language` to German, trigger each notification
type, confirm subject+HTML+text are German; set it to unset/null and confirm English.

### Template content for User Story 1

- [x] T010 [P] [US1] `password-reset` templates: `libs/notifications/src/lib/templates/password-reset/{en,de}.{subject,html,text}.hbs`, view model `{ resetUrl }`, including `header`/`salutation`/`footer`/`signature` partials.
- [x] T011 [P] [US1] `email-change-verification` templates: `libs/notifications/src/lib/templates/email-change-verification/{en,de}.{subject,html,text}.hbs`, view model `{ newEmail, verifyUrl }`.
- [x] T012 [P] [US1] `invitation` templates: `libs/notifications/src/lib/templates/invitation/{en,de}.{subject,html,text}.hbs`, view model `{ acceptUrl }`.
- [x] T013 [P] [US1] `signup-verification` templates: `libs/notifications/src/lib/templates/signup-verification/{en,de}.{subject,html,text}.hbs`, view model `{ verifyUrl }`.
- [x] T014 [P] [US1] `signup-admin-alert` templates: `libs/notifications/src/lib/templates/signup-admin-alert/{en,de}.{subject,html,text}.hbs`, view model `{ requestEmail }`.
- [x] T015 [P] [US1] `signup-welcome` templates: `libs/notifications/src/lib/templates/signup-welcome/{en,de}.{subject,html,text}.hbs`, view model `{ appUrl }`.
- [x] T016 [P] [US1] `signup-rejection` templates: `libs/notifications/src/lib/templates/signup-rejection/{en,de}.{subject,html,text}.hbs`, no reason exposed (FR-009 of spec 007), no view model needed.

### Renderer contract tests for User Story 1

- [x] T017 [US1] Contract tests in `libs/notifications/src/lib/notification-renderer.spec.ts` against the real `.hbs` files from T007/T010–T016: correct German content when `de` files exist for a type; correct English content when `preferredLanguage` is `null`/unsupported; `subject`/`html`/`text` always non-empty (FR-007); `language` on the result reflects what was actually rendered.

### EmailService adapters for User Story 1

- [x] T018 [US1] Rewrite `apps/backend/src/profile/email.service.ts`: inject `MailerService`, drop the local `transport()`/`process.env.SMTP_*` block; `sendEmailChangeVerification(user: {email, emailLanguage}, newEmail, token)` and `sendPasswordReset(user: {email, emailLanguage}, token)` call `renderNotification` (per contracts/notifications-lib.md §2) then `mailerService.send`; keep the existing `requireAbsoluteUrl` helper for building `verifyUrl`/`resetUrl`.
- [x] T019 [US1] Update `apps/backend/src/profile/profile.service.ts`: in `requestEmailChange`, load the acting user via `this.users.findById(userId)` (not currently loaded) so `emailLanguage` is available, and pass `{email: newEmail, emailLanguage: user.emailLanguage}` to `sendEmailChangeVerification`; in `requestPasswordReset`, pass the already-loaded `user` to `sendPasswordReset` instead of `user.email` alone. No change to when/whether these methods are called (FR-012).
- [x] T020 [US1] New `apps/backend/src/profile/email.service.spec.ts`: unit tests mocking `MailerService`, asserting `renderNotification` is invoked with the correct `type`/`preferredLanguage`/`viewModel` and `mailerService.send` receives the rendered result.
- [x] T021 [US1] Update `apps/backend/src/profile/profile.service.spec.ts` for the new `EmailService` call signatures from T018/T019.
- [x] T022 [US1] Rewrite `apps/backend/src/signups/email.service.ts`: inject `MailerService`; `sendVerification`/`sendWelcome`/`sendRejection` call `renderNotification`+`mailerService.send` (recipients have no account yet, so `preferredLanguage: null` → English fallback, per data-model.md); `sendAdminNotification(admins: {email, emailLanguage}[], requestEmail)` changes from one `to: [...]` send to `Promise.all` of one render+send per admin, each using that admin's own `emailLanguage` (FR-011, contracts/notifications-lib.md §2).
- [x] T023 [US1] Update `apps/backend/src/signups/signups.service.ts`'s `verify()` call site: pass the full `admins` array (`{email, emailLanguage}`) to `sendAdminNotification` instead of `admins.map((admin) => admin.email)`.
- [x] T024 [US1] New `apps/backend/src/signups/email.service.spec.ts`: unit tests mocking `MailerService`, including one asserting `sendAdminNotification` with mixed-language admins produces one render+send call per admin with each admin's own resolved language.
- [x] T025 [US1] Update `apps/backend/src/signups/signups.service.spec.ts` for the `sendAdminNotification` signature change from T022/T023.
- [x] T026 [US1] Rewrite `apps/backend/src/invitations/email.service.ts`: inject `MailerService`; `sendInvitation(to, token)` calls `renderNotification({type: 'invitation', preferredLanguage: null, viewModel: {acceptUrl}})` (invitees have no account/preference yet) then `mailerService.send`; keep the existing `APP_BASE_URL` validation.
- [x] T027 [US1] New `apps/backend/src/invitations/email.service.spec.ts`: unit tests mocking `MailerService`, asserting `renderNotification`/`mailerService.send` are called correctly.
- [x] T028 [US1] Wire `MailerModule` into `apps/backend/src/profile/profile.module.ts`, `apps/backend/src/signups/signups.module.ts`, and `apps/backend/src/invitations/invitations.module.ts` (`imports: [..., MailerModule]`) so each `EmailService`'s new `MailerService` dependency resolves.

**Checkpoint**: All 7 notification types render and send in the recipient's resolved language;
existing send call sites are otherwise unchanged. This is the MVP.

---

## Phase 4: User Story 2 - Maintain email content without touching application code (Priority: P2)

**Goal**: Prove, and document, that wording/shared-partial changes require editing only template
files — no `.ts` changes (FR-004, FR-005, SC-003, SC-006).

**Independent Test**: Change one notification's template wording only, rebuild/restart, confirm
the new wording is delivered with zero sending-logic changes.

- [x] T029 [P] [US2] Regression test in `libs/notifications/src/lib/notification-renderer.spec.ts`: assert a fixture template's exact rendered subject/body text matches known content (documents SC-003's "template-only edit" contract — a future wording change is expected to require updating only this fixture's expected string, not renderer code).
- [x] T030 [P] [US2] Partial-propagation test in `libs/notifications/src/lib/notification-renderer.spec.ts`: render two different notification types that both include the `footer` partial and assert both outputs contain the same footer content sourced from the one `partials/footer/en.hbs` file (SC-006).
- [x] T031 [P] [US2] `libs/notifications/README.md`: document the file-naming convention (contracts/notifications-lib.md §4), how to edit an existing template/partial's wording, and that no code changes are required for a content-only change.

**Checkpoint**: Maintainability contract is verified by tests and documented for template authors.

---

## Phase 5: User Story 3 - Add a new correspondence language with minimal effort (Priority: P3)

**Goal**: Confirm the renderer's directory/file-existence-driven design (T006) needs zero code
changes to support a new language, and document the exact steps (FR-006, SC-004).

**Independent Test**: Following only the documented pattern, add one language's content for one
type and confirm it sends correctly with no sending-logic changes.

- [x] T032 [US3] Table-driven test in `libs/notifications/src/lib/notification-renderer.spec.ts` parameterized across both existing languages (`en`, `de`) proving `renderNotification` contains no per-language branching (same code path, only the resolved language and looked-up files differ) — documents that a 3rd language needs only new files, not renderer changes.
- [x] T033 [US3] Regression test in `libs/notifications/src/lib/notification-renderer.spec.ts`: a language that is `isSupportedLanguageCode()`-true but has no template files for a given type falls back to English for that type rather than throwing (Edge Cases, partial-rollout scenario).
- [x] T034 [US3] Extend `libs/notifications/README.md` (from T031) with the "add a language" steps from contracts/notifications-lib.md §4 / quickstart.md Scenario 6: add `<lang>.subject/html/text.hbs` per type, add matching `partials/*/<lang>.hbs`, add one entry to `SUPPORTED_LANGUAGES` in `libs/api-contract/src/lib/i18n.ts` — no changes to `notification-renderer.ts`, `language-resolution.ts`, or any `*.service.ts`.

**Checkpoint**: Adding a language is proven, by test and documentation, to touch only template
files plus one catalog entry.

---

## Phase 6: User Story 4 - Emails show a friendly sender name instead of a raw address (Priority: P2)

**Goal**: Confirm end-to-end that `SMTP_SENDER_NAME` reaches the From header correctly, safely
encoded, with a working fallback when unset (FR-008, FR-009, FR-010).

**Independent Test**: Set `SMTP_SENDER_NAME`, trigger any notification, confirm the From header
shows `"<name>" <address>`; unset it and confirm the email still sends using the bare address.

- [x] T035 [US4] Add an integration-style test in `apps/backend/src/mail/mailer.service.spec.ts` (extending T009) that sends through a captured/mocked nodemailer transport and asserts the exact `from` value passed to `sendMail` for: `SMTP_SENDER_NAME` set to a plain name, unset, and a value containing `<`/`>`/`"`/`,` — confirming nodemailer's structured `from` form is used in all cases (FR-008/009/010 end-to-end, not just the transport-agnostic unit assertions from T009).
- [x] T036 [US4] Document `SMTP_SENDER_NAME` in the backend's environment-variable reference (wherever `SMTP_HOST`/`SMTP_FROM` etc. are already documented, e.g. `.env.example` or `README.md`) including its optional/fallback behavior.

**Checkpoint**: Sender display name is verified correct and documented for deployment.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [x] T037 Run `npm exec nx test notifications` and `npm exec nx test backend` (all updated/new spec files) and fix any failures.
- [x] T038 Run `npm exec nx lint notifications` and `npm exec nx lint backend`.
- [x] T039 Walk through quickstart.md Scenarios 1–6 manually (or via a local SMTP catch-all) to confirm end-to-end behavior matches the automated tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001–T002) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion. No dependency on other stories.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and on US1's template content (T010–T016) and renderer contract tests (T017) existing to extend/verify against.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2), specifically the generic renderer (T006); does not depend on US1/US2 completion but reuses the same `notification-renderer.spec.ts` file, so sequence after US1/US2 to avoid merge conflicts.
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2)'s `MailerService` (T008/T009); independent of US1/US2/US3.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### Within Each User Story

- Template content before renderer contract tests before service-adapter rewrites (US1).
- Service-adapter rewrite before its new spec file before the caller's existing spec update (per feature area, US1: profile → signups → invitations).

### Parallel Opportunities

- T001/T002 (Setup) are sequential (T002 needs the dependency from T001 recorded).
- T003–T005 and T007 (Foundational) can run in parallel; T006 depends on T003 (types) and benefits from T007 existing for manual smoke-testing but doesn't strictly require it; T008/T009 (mail module) are independent of T003–T007 and can run in parallel with them.
- T010–T016 (all 7 template-type content sets, US1) can run fully in parallel — different directories.
- T018/T020/T021 (profile), T022/T024/T025 (signups), T026/T027 (invitations) are three independent file groups within US1 and can be parallelized across developers, though each group is internally sequential (rewrite → new spec → update caller spec).
- T029–T031 (US2) can run in parallel.
- T035–T036 (US4) can run in parallel.

---

## Parallel Example: User Story 1 template content

```bash
# Launch all 7 template-type content tasks together (different directories, no shared files):
Task: "password-reset templates in libs/notifications/src/lib/templates/password-reset/"
Task: "email-change-verification templates in libs/notifications/src/lib/templates/email-change-verification/"
Task: "invitation templates in libs/notifications/src/lib/templates/invitation/"
Task: "signup-verification templates in libs/notifications/src/lib/templates/signup-verification/"
Task: "signup-admin-alert templates in libs/notifications/src/lib/templates/signup-admin-alert/"
Task: "signup-welcome templates in libs/notifications/src/lib/templates/signup-welcome/"
Task: "signup-rejection templates in libs/notifications/src/lib/templates/signup-rejection/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002).
2. Complete Phase 2: Foundational (T003–T009) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 (T010–T028).
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 against a local SMTP catch-all.
5. Deploy/demo if ready — this alone delivers SC-001/SC-002/SC-005(partially, since T008 already sets sender name)/most of FR-001–FR-003/FR-007/FR-011/FR-012.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate → deploy/demo (MVP: localized emails, consolidated transport, sender name already active since T008 is foundational).
3. Add US2 → validate maintainability contract via tests/docs.
4. Add US3 → validate/document new-language extensibility.
5. Add US4 → validate/document sender-name behavior end-to-end.
