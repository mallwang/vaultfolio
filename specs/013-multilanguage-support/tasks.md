# Tasks: Multilanguage Support

**Input**: Design documents from `/specs/013-multilanguage-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/profile-api-i18n.md, quickstart.md

**Tests**: Included — plan.md's Testing section and Constitution Check (Principles III/IV) call
for unit/integration coverage of `I18nService`, the `translate` pipe, the new profile
service/controller methods, and the new DB migration step.

**Organization**: Tasks are grouped by user story (US1 display language, US2 email correspondence
language, US3 content completeness) per spec.md priorities P1/P2/P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

## Path Conventions

Nx monorepo: `apps/backend/src/`, `apps/frontend/src/app/`, `libs/api-contract/src/lib/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared language catalog that both display-language (US1) and
email-language (US2) work depends on.

- [ ] T001 [P] Create `SupportedLanguage`/`LanguageCode`/`SUPPORTED_LANGUAGES` (`en` default,
      `de`) in `libs/api-contract/src/lib/i18n.ts` per contracts/profile-api-i18n.md
- [ ] T002 [P] Export the new `i18n.ts` module from `libs/api-contract/src/index.ts` (follow the
      existing export pattern used for `profile.ts`)

**Checkpoint**: Shared catalog available to both frontend and backend.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core i18n mechanics that every user story's UI work depends on — no user story can
render translated text until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [US1] Create `en.ts` default-language dictionary (empty/skeleton keyed object) in
      `apps/frontend/src/app/core/i18n/translations/en.ts`
- [ ] T004 [P] [US1] Create `de.ts` dictionary skeleton in
      `apps/frontend/src/app/core/i18n/translations/de.ts`
- [ ] T005 [US1] Implement `I18nService` in `apps/frontend/src/app/core/i18n/i18n.service.ts` —
      signal-based active language, resolves `localStorage['vaultfolio-language']` (else catalog
      default) at construction, falls back to default for a stored-but-unsupported code, exposes
      a `setLanguage(code)` method that updates the signal and best-effort persists (mirrors
      `apps/frontend/src/app/core/theme/theme.service.ts`)
- [ ] T006 [P] [US1] Unit tests for `I18nService` in
      `apps/frontend/src/app/core/i18n/i18n.service.spec.ts` — resolution order, persistence,
      fallback-on-removed/unsupported language (mirrors `theme.service.spec.ts`)
- [ ] T007 [US1] Implement `translate` pipe in
      `apps/frontend/src/app/core/i18n/translate.pipe.ts` — looks up a dotted key path in the
      active-language dictionary, falls back to `en.ts` on a missing key (never a raw key or
      empty string, FR-011)
- [ ] T008 [P] [US1] Unit tests for the pipe in
      `apps/frontend/src/app/core/i18n/translate.pipe.spec.ts` — key lookup, missing-key fallback
      to default dictionary, missing key in both dictionaries

**Checkpoint**: `I18nService` + `translate` pipe are functional and unit-tested; user story
implementation can now begin.

---

## Phase 3: User Story 1 - Switch the application display language (Priority: P1) 🎯 MVP

**Goal**: A header navbar language switcher that instantly re-renders visible UI text and
persists the choice per-device (FR-001–FR-005).

**Independent Test**: Open the app, use the language switcher to pick "Deutsch", verify all
visible UI text changes without a page reload, reload the page and verify German is still
applied; open a different browser and verify it still starts in English.

### Implementation for User Story 1

- [ ] T009 [US1] Add a language switcher control (`p-select`, flag+name per design.md) to
      `apps/frontend/src/app/core/layout/app-header/app-header.component.html`/`.ts`, next to the
      existing theme toggle, listing `SUPPORTED_LANGUAGES` and bound to `I18nService`'s active
      language signal
- [ ] T010 [US1] Wire the switcher's selection to `I18nService.setLanguage()` so all
      `translate`-piped text on screen updates immediately (FR-003, SC-001)
- [ ] T011 [P] [US1] Extend `app-header.component.spec.ts` with a test asserting selecting a
      language calls `I18nService.setLanguage` and marks the active option (mirrors existing
      theme-toggle test coverage in that spec)
- [ ] T012 [US1] Replace hardcoded header navbar strings with `| translate` bindings reading from
      the new dictionaries (scope: header/nav only — remaining screens covered in Phase 5, US3)

**Checkpoint**: User Story 1 fully functional and independently testable/demoable — header
switches instantly, persists per-device, defaults to English for first-time visitors.

---

## Phase 4: User Story 2 - Configure a separate email correspondence language (Priority: P2)

**Goal**: An account-level "email correspondence language" setting on Settings › Preferences,
independent of and unaffected by the display language (FR-006–FR-009).

**Independent Test**: As a logged-in user, open Settings › Preferences, set an email
correspondence language different from the current display language, save, verify `GET
/api/profile` returns the new `emailLanguage`, then change the display language and confirm
`emailLanguage` is unchanged.

### Tests for User Story 2 ⚠️

- [ ] T013 [P] [US2] Migration test in `apps/backend/src/database/database.service.spec.ts` —
      `migrateI18n()` adds `users.email_language` (nullable, `CHECK` against
      `SUPPORTED_LANGUAGES` codes) and is idempotent against an already-migrated DB
- [ ] T014 [P] [US2] `ProfileService.updateEmailLanguage()` unit tests in
      `apps/backend/src/profile/profile.service.spec.ts` — valid code, `null` (clear), invalid
      code rejected
- [ ] T015 [P] [US2] `PATCH /api/profile/email-language` controller tests in
      `apps/backend/src/profile/profile.controller.spec.ts` — 200 on valid/`null` body, 400
      `invalid_email_language` on unsupported code, requires auth (mirrors existing
      `display-name` route coverage)

### Implementation for User Story 2

- [ ] T016 [US2] Add `migrateI18n(db)` to `apps/backend/src/database/database.service.ts` —
      idempotent `PRAGMA table_info` check then `ALTER TABLE users ADD COLUMN email_language TEXT
    NULL CHECK (...)` generated from `SUPPORTED_LANGUAGES` codes; call it from `onModuleInit`
      alongside `migrateProfile()` (research.md #4)
- [ ] T017 [P] [US2] Add `emailLanguage: LanguageCode | null` to `ProfileSummary` and add
      `UpdateEmailLanguageRequest { emailLanguage: LanguageCode | null }` in
      `libs/api-contract/src/lib/profile.ts`
- [ ] T018 [US2] Implement `ProfileService.updateEmailLanguage()` in
      `apps/backend/src/profile/profile.service.ts` — validates against `SUPPORTED_LANGUAGES`
      (400 `invalid_email_language` otherwise), persists `email_language`, returns updated
      `ProfileSummary`, logs the mutation (`this.logger.log({ actor, event })` per plan.md)
      (depends on T016, T017)
- [ ] T019 [US2] Add `PATCH /profile/email-language` route to
      `apps/backend/src/profile/profile.controller.ts` (`AuthGuard`, no `@Roles()`), and include
      `emailLanguage` in the existing `GET /api/profile` response (depends on T018)
- [ ] T020 [US2] Add "Email correspondence language" control to
      `apps/frontend/src/app/settings/preferences/preferences.component.html`/`.ts` — same
      `SUPPORTED_LANGUAGES` list/labels as the header switcher (FR-012), pre-filled from
      `I18nService`'s current display language only when unset (research.md #3, client-side
      pre-fill, never auto-saved), calls `PATCH /profile/email-language` on save
- [ ] T021 [P] [US2] Extend `preferences.component.spec.ts` (or create it, matching sibling
      settings component spec conventions) — save calls the new endpoint, pre-fill behavior,
      independence from display-language changes

**Checkpoint**: User Stories 1 AND 2 both independently functional — email-language setting
persists to the account and survives display-language changes.

---

## Phase 5: User Story 3 - Content is available in all supported languages (Priority: P3)

**Goal**: Every translatable string on the switcher, settings, and primary screens has both `en`
and `de` entries, with graceful default-language fallback for anything missing (FR-010–FR-012).

**Independent Test**: For each supported language, navigate the primary screens (dashboard,
holdings, settings) and confirm no raw translation keys or empty strings are visible; temporarily
remove a `de` key and confirm the UI shows the `en` text instead of breaking.

### Implementation for User Story 3

- [ ] T022 [US3] Replace hardcoded strings with `| translate` bindings and add corresponding
      `en`/`de` dictionary entries for the sign-in/authentication screens
- [ ] T023 [US3] Replace hardcoded strings with `| translate` bindings and add corresponding
      `en`/`de` dictionary entries for the dashboard screen(s)
- [ ] T024 [US3] Replace hardcoded strings with `| translate` bindings and add corresponding
      `en`/`de` dictionary entries for the holdings list/form screens
- [ ] T025 [US3] Replace hardcoded strings with `| translate` bindings and add corresponding
      `en`/`de` dictionary entries for Settings (Profile + Preferences, including the new
      email-language control from T020)
- [ ] T026 [US3] Replace hardcoded strings with `| translate` bindings and add corresponding
      `en`/`de` dictionary entries for admin screens (role-gated nav and admin sections)
- [ ] T027 [P] [US3] Manual pass per quickstart.md's US3 section across all primary screens in
      both languages, confirming SC-005 (<1% missing translations) and no visible raw key paths

**Checkpoint**: All user stories independently functional; primary screens fully translated in
`en` and `de`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T028 Run `npx nx affected -t lint test` (or `npx nx run-many -t lint test -p frontend
    backend api-contract`) and fix any failures
- [ ] T029 Execute quickstart.md's US1–US3 scenarios end-to-end manually against a running
      `nx serve backend` + `nx serve frontend`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001 catalog) — BLOCKS all user stories (frontend
  dictionaries/pipe need the catalog shape; nothing renders translated text before this).
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Setup (T001, the shared catalog) for backend validation;
  does not depend on Phase 2 or US1's frontend work (its own T020 UI work only needs
  `I18nService` from Phase 2 for the pre-fill convenience, not for the setting itself to
  function).
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2, dictionaries/pipe must exist) and
  benefits from US1 (header, T012) and US2 (preferences, T020) already having their controls in
  place to translate (T025 touches T020's markup).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2. No dependency on US2/US3.
- **User Story 2 (P2)**: Backend half (T013–T019) can start after Phase 1 (catalog only) in
  parallel with US1. Frontend half (T020–T021) needs Phase 2's `I18nService` for the pre-fill.
- **User Story 3 (P3)**: Should follow US1/US2 in practice (T025 depends on T020's markup
  existing) even though dictionary work for other screens (T022–T024, T026) has no such
  dependency.

### Parallel Opportunities

- T001, T002 in parallel (Setup).
- T004, T006, T008 in parallel with each other (Phase 2, different files); T003/T005/T007 are
  sequential prerequisites within their own chain (dictionary → service → pipe reads dictionary).
- T011 in parallel with T012 (Phase 3, different concerns/files).
- T013, T014, T015, T017 in parallel (Phase 4, different files); backend implementation (T016,
  T018, T019) is sequential.
- T021 in parallel with T022–T026 (different files).
- T022, T023, T024, T026 in parallel with each other (different screen files); T025 waits on T020.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Create de.ts dictionary skeleton in apps/frontend/src/app/core/i18n/translations/de.ts"
Task: "Unit tests for I18nService in apps/frontend/src/app/core/i18n/i18n.service.spec.ts"
Task: "Unit tests for translate pipe in apps/frontend/src/app/core/i18n/translate.pipe.spec.ts"
```

## Parallel Example: Phase 4 (User Story 2 tests + DTO)

```bash
Task: "Migration test in apps/backend/src/database/database.service.spec.ts"
Task: "ProfileService.updateEmailLanguage() unit tests in apps/backend/src/profile/profile.service.spec.ts"
Task: "PATCH /api/profile/email-language controller tests in apps/backend/src/profile/profile.controller.spec.ts"
Task: "Add emailLanguage/UpdateEmailLanguageRequest to libs/api-contract/src/lib/profile.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (shared catalog).
2. Complete Phase 2: Foundational (`I18nService`, `translate` pipe, dictionaries — CRITICAL,
   blocks all stories).
3. Complete Phase 3: User Story 1 (header switcher).
4. **STOP and VALIDATE**: Run quickstart.md's US1 steps.
5. Deploy/demo if ready — this alone delivers SC-001/SC-002.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → validate independently → demo (MVP).
3. Add User Story 2 → validate independently → demo (email-language setting live, even before any
   cron email feature consumes it).
4. Add User Story 3 → validate independently → demo (full content coverage, SC-005).
5. Polish (Phase 6).

### Parallel Team Strategy

With multiple developers, after Phase 1+2 land:

- Developer A: User Story 1 (Phase 3).
- Developer B: User Story 2 backend (T013–T019), then frontend (T020–T021) once Phase 2 lands.
- Developer C: User Story 3 dictionary/markup work (T022–T026), joining in as US1/US2 markup
  becomes available for T025.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- No new Nx project, no new runtime dependency (plan.md, research.md #1) — all tasks touch
  `apps/frontend`, `apps/backend`, or `libs/api-contract` only.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before moving on.
