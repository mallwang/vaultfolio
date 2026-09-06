---
description: 'Task list template for feature implementation'
---

# Tasks: UI Test-ID Convention

**Input**: Design documents from `/specs/024-ui-testid-convention/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/testid-convention-contract.md, quickstart.md

**Tests**: Not explicitly requested in the spec (see plan.md Constitution Check, Principle III) — no new
test tasks are generated. Existing unit tests for retrofitted components must keep passing unchanged
(FR-007), verified via T024.

**Organization**: Tasks are grouped by user story (US1 = convention doc, US2 = retrofit, US3 = ongoing
guidance) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact (this is a documentation + template-attribute retrofit; no new Nx project is created)

## Path Conventions

- New documentation artifact: `docs/frontend/testid-conventions.md` (repo root, no owning Nx project)
- Angular templates: `apps/frontend/src/app/**/*.component.html`
- Angular inline-template components: `libs/frontend/domain/*/src/lib/**/*.component.ts`,
  `libs/frontend/admin/src/lib/**/*.component.ts`
- Agentic guidance: `CLAUDE.md` (repo root), `.claude/skills/verify-ui/SKILL.md`

---

## Phase 1: Setup

**Purpose**: Create the home for the new convention document

- [x] T001 Create the `docs/frontend/` directory at the repo root (new top-level `docs/` dir, per
      research.md §1) so `docs/frontend/testid-conventions.md` has somewhere to live

---

## Phase 2: Foundational

**Not applicable to this feature.** There is no shared infrastructure, schema, or framework code that
blocks all three user stories — User Story 1 (the convention document) is itself the single
prerequisite that User Story 2 (retrofit) and User Story 3 (ongoing guidance) build on, so it is
modeled as Phase 3 below rather than duplicated here. No foundational tasks are generated.

---

## Phase 3: User Story 1 - A documented naming convention exists (Priority: P1) 🎯 MVP

**Goal**: One written document that lets any contributor or agent derive the correct `data-testid` (or
correctly conclude none is needed) for a static element, a repeated element, and a shared component —
without asking a maintainer.

**Independent Test**: Hand `docs/frontend/testid-conventions.md` alone to a reader, give them the
three example elements from the spec's Acceptance Scenarios, and confirm they land on the same names
an author following the convention would pick.

### Implementation for User Story 1

- [x] T002 [US1] Author `docs/frontend/testid-conventions.md` using
      `specs/024-ui-testid-convention/contracts/testid-convention-contract.md` as the authoritative
      source: the `data-testid` attribute definition (§1), the full decision table covering static /
      repeated / shared / exempt categories and the PrimeNG host-attribute placement rule with its
      escape hatch (§2, informed by research.md §2-4), the `language-switcher` / `theme-toggle`
      grandfathering statement (§3, FR-004), the "consumers of this contract" section naming
      `CLAUDE.md` and the `verify-ui` skill (§4, FR-008/FR-009), and the non-goals section (§5) —
      satisfies FR-001, FR-002, FR-003, FR-004, FR-005
- [x] T003 [US1] Self-validate the new doc against `specs/024-ui-testid-convention/quickstart.md`
      Scenario A: derive testids for the three example elements (translated-label submit button,
      holdings table row, a button reused in two lists) using only the doc, and confirm
      `language-switcher`/`theme-toggle` are unambiguously addressed — SC-003, Acceptance Scenario 4

**Checkpoint**: The convention document exists and is self-sufficient — User Story 2 (retrofit) and
User Story 3 (guidance updates) can now both proceed, in parallel if desired.

---

## Phase 4: User Story 2 - Existing UI gets stable selectors where they're missing (Priority: P2)

**Goal**: Every element across `apps/frontend` and the `libs/frontend/domain/*` / `libs/frontend/admin`
templates that matches an FR-002 category (translated-only label, repeated row/item, PrimeNG-wrapped
node with no other stable selector) carries a `data-testid` per the convention — with zero behavior,
styling, or existing-test-result changes (FR-007).

**Independent Test**: Pick one retrofitted element per FR-002 category (a translated-label button, a
repeated table row, a PrimeNG-wrapped control), confirm each carries a `data-testid`, and confirm a
Playwright script locates each by testid alone in every supported locale with no other app-behavior
change.

**Scope note**: The audit below (performed against the current codebase) found no existing shared
component reused across screens that requires a distinguishing `testIdPrefix` today — the pattern is
documented in User Story 1 for future use, but no current retrofit task needs it. Every file below was
reviewed; elements already exempt under FR-003 (DOM `id`, `formControlName`, `routerLink`) and
non-interactive/display-only templates are intentionally excluded.

### Implementation for User Story 2

- [x] T004 [P] [US2] Add `data-testid` (static category) to the translated-label submit button in
      apps/frontend/src/app/account/forgot-password/forgot-password.component.html
- [x] T005 [P] [US2] Add `data-testid` (static category) to the translated-label submit button in
      apps/frontend/src/app/account/reset-password/reset-password.component.html
- [x] T006 [P] [US2] Add `data-testid` (static category) to the translated-label "confirm email
      change" button in apps/frontend/src/app/account/verify-email/verify-email.component.html
- [x] T007 [P] [US2] Add `data-testid` (static category) to the translated-label submit button in
      apps/frontend/src/app/auth/sign-in/sign-in.component.html
- [x] T008 [P] [US2] Add `data-testid` (wrapped category, host-attribute placement) to the
      PrimeNG-wrapped sign-out `p-button` in
      apps/frontend/src/app/core/layout/app-header/app-header.component.html — verify it doesn't
      collide with the existing grandfathered `language-switcher`/`theme-toggle` testids in the same
      file
- [x] T009 [P] [US2] Add a distinct per-item `data-testid` (repeated category, keyed by `area.id`) to
      the nav `<a>` items rendered by the `@for` loop, and a `data-testid` (static category) to the
      sidebar collapse-toggle button, in
      apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html
- [x] T010 [P] [US2] Add `data-testid` (static category) to the translated-label "activate account"
      submit button in apps/frontend/src/app/invite/accept/accept.component.html
- [x] T011 [P] [US2] Add `data-testid` (static category) to the disabled preview toggle switch and to
      the "save" button in apps/frontend/src/app/settings/preferences/preferences.component.html
- [x] T012 [P] [US2] Add `data-testid` (static category) to every translated-label action button
      (save name, cancel email change, send verification link, change password, export data, delete
      account) and to the three danger-zone dialog footer button pairs, plus `data-testid` (wrapped
      category) to the PrimeNG dialog close-icon control on each of the three `p-dialog`s, in
      apps/frontend/src/app/settings/profile/profile.component.html
- [x] T013 [P] [US2] Add `data-testid` (static category) to the two fixed top-level tabs
      (profile/preferences) and a distinct per-item `data-testid` (repeated category, keyed by
      `tab.domainId`) to the dynamic domain tabs, in
      apps/frontend/src/app/settings/settings.component.html
- [x] T014 [P] [US2] Add `data-testid` (static category) to the translated-label submit button in
      apps/frontend/src/app/signup/signup.component.html
- [x] T015 [P] [US2] Add a distinct per-item `data-testid` (repeated category, keyed by
      `option.value`) to the asset-type selector buttons, and `data-testid` (static category) to the
      cancel/save buttons, in
      libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.ts
- [x] T016 [P] [US2] Add `data-testid` (static category) to the four admin tabs
      (accounts/signups/invitations/general) in libs/frontend/admin/src/lib/admin.component.ts
- [x] T017 [P] [US2] Add `data-testid` (static category) to the two holdings-area tabs
      (list/imports) in
      libs/frontend/domain/holdings/src/lib/holdings-area/holdings-area.component.ts
- [x] T018 [P] [US2] Add `data-testid` (static category) to the "keep it" and "reject signup" dialog
      buttons, plus `data-testid` (wrapped category) to the dialog close-icon control, in
      libs/frontend/admin/src/lib/signups/reject-dialog/reject-dialog.component.ts
- [x] T019 [P] [US2] Add `data-testid` (static category) to the "cancel" and "send invitation" dialog
      buttons, plus `data-testid` (wrapped category) to the dialog close-icon control, in
      libs/frontend/admin/src/lib/invitations/invite-dialog/invite-dialog.component.ts
- [x] T020 [P] [US2] Add a distinct per-row `data-testid` (repeated category, keyed by signup id) to
      the approve/reject/delete row buttons, and `data-testid` (wrapped category, via PrimeNG
      `pt`/passthrough attributes per the convention's escape hatch) to the shared `p-confirmdialog`
      accept/reject controls, in libs/frontend/admin/src/lib/signups/signups.component.ts
- [x] T021 [P] [US2] Add `data-testid` (static category) to the "invite member" header button, a
      distinct per-row `data-testid` (repeated category, keyed by invitation id) to the
      resend/cancel row buttons, and `data-testid` (wrapped category) to the shared `p-confirmdialog`
      controls, in libs/frontend/admin/src/lib/invitations/invitations.component.ts
- [x] T022 [P] [US2] Add a distinct per-row `data-testid` (repeated + wrapped category, keyed by
      account id) to the role-select and domain-scopes multiselect controls, a distinct per-row
      `data-testid` to the archive/reactivate buttons, and `data-testid` (wrapped category) to the
      shared `p-confirmdialog` controls, in libs/frontend/admin/src/lib/accounts/accounts.component.ts
- [x] T023 [P] [US2] Add `data-testid` to the static "add holding" header button, the static filter
      input, the sortable column headers (static category, keyed by column name), a distinct per-row
      `data-testid` (repeated category, keyed by holding id) to the edit/delete row buttons, the
      static empty-state "add first holding" button, and `data-testid` (wrapped category) to the
      add/edit dialog and delete-confirm dialog controls, in
      libs/frontend/domain/holdings/src/lib/holdings.component.ts
- [x] T024 [US2] Run `npx nx affected -t test` (scoped to the projects touched by T004-T023) and
      confirm every retrofitted component's existing unit tests still pass with unchanged assertions —
      FR-007
- [x] T025 [US2] Using the `verify-ui` skill, Playwright-verify one retrofitted element per FR-002
      category (one static, one repeated, one PrimeNG-wrapped): locate each via `getByTestId` in the
      default locale, switch to a second supported locale via `language-switcher`, and confirm the
      same locator still finds it with no rendered-output change — SC-002, quickstart Scenario B

**Checkpoint**: Every FR-002-qualifying element in the current app has a stable `data-testid`; User
Story 1 and User Story 2 together already deliver the primary value of the feature.

---

## Phase 5: User Story 3 - New UI work keeps the convention current going forward (Priority: P3)

**Goal**: The agentic guidance itself instructs that a new/changed UI element meeting the convention's
criteria gets its `data-testid` added in the same change, and points verification-script authors at the
convention doc before they fall back to translated-text matching.

**Independent Test**: Walk through a hypothetical new-button change against the updated `CLAUDE.md` and
`verify-ui` skill text and confirm both explicitly call for a `data-testid` at the point of
implementation, without needing the full US2 retrofit to be complete.

### Implementation for User Story 3

- [x] T026 [P] [US3] Update the "Verifying UI changes" section of `CLAUDE.md` to instruct that a
      new/changed interactive element meeting the convention's criteria gets its `data-testid` added
      as part of that same change, linking to `docs/frontend/testid-conventions.md` — FR-008
- [x] T027 [P] [US3] Update item 1 of the "Selector conventions" list in
      `.claude/skills/verify-ui/SKILL.md` to link to `docs/frontend/testid-conventions.md` and
      instruct: when an in-scope element is missing a testid, add one per the convention before
      falling back to translated-text matching (item 4) — FR-009
- [x] T028 [US3] Walk through `specs/024-ui-testid-convention/quickstart.md` Scenario C against the
      updated `CLAUDE.md`/`SKILL.md` text and confirm both acceptance scenarios (guidance calls for
      the attribute; skill points to the doc before text-matching) are satisfied — SC-004

**Checkpoint**: All three user stories are complete and independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final acceptance sweep across all three stories

- [x] T029 [P] Cross-check SC-001: re-review every file touched in Phase 4 (T004-T023) against the
      FR-002 categories and confirm no qualifying element was missed
- [x] T030 Run the full `specs/024-ui-testid-convention/quickstart.md` validation end-to-end
      (Scenarios A, B, C) as the final acceptance check before merging

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Not applicable — no tasks
- **User Story 1 (Phase 3)**: Depends on Setup (T001, for the `docs/frontend/` directory) — BLOCKS
  User Story 2 and User Story 3 (both reference the doc)
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (the convention must exist to follow it);
  independent of User Story 3
- **User Story 3 (Phase 5)**: Depends on Phase 3 completion; independent of User Story 2 — can run in
  parallel with Phase 4
- **Polish (Phase 6)**: Depends on Phase 4 and Phase 5 both being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — the prerequisite for both others
- **User Story 2 (P2)**: Depends on User Story 1's document existing; not otherwise coupled to User
  Story 3
- **User Story 3 (P3)**: Depends on User Story 1's document existing; not otherwise coupled to User
  Story 2

### Within Each User Story

- Phase 3: T002 (author doc) before T003 (self-validate against quickstart)
- Phase 4: T004-T023 (all independent files) before T024 (test run) before T025 (Playwright
  verification)
- Phase 5: T026 and T027 (independent files) before T028 (walkthrough validation)

### Parallel Opportunities

- All Phase 4 file-edit tasks (T004-T023) are marked [P] — different files, no dependencies between
  them — and can be done by different people/agents simultaneously once Phase 3 is complete
- Phase 5's T026 and T027 are marked [P] and can run in parallel with each other and with all of
  Phase 4
- T029 can run in parallel with nothing else in Phase 6 (T030 depends on everything)

---

## Parallel Example: User Story 2

```bash
# Once Phase 3 (the convention doc) is done, launch a batch of independent file edits together:
Task: "Add data-testid to forgot-password submit button in apps/frontend/src/app/account/forgot-password/forgot-password.component.html"
Task: "Add data-testid to reset-password submit button in apps/frontend/src/app/account/reset-password/reset-password.component.html"
Task: "Add per-item data-testid to holding-form asset-type buttons in libs/frontend/domain/holdings/src/lib/holding-form/holding-form.component.ts"
Task: "Add per-row data-testid to accounts.component.ts row controls in libs/frontend/admin/src/lib/accounts/accounts.component.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create `docs/frontend/`)
2. Complete Phase 3: User Story 1 (write and self-validate the convention document)
3. **STOP and VALIDATE**: Hand the doc to a fresh reader per quickstart Scenario A
4. This alone already satisfies FR-001 through FR-005 and SC-003

### Incremental Delivery

1. Setup + User Story 1 → convention document ready (MVP)
2. Add User Story 2 → retrofit lands, unit tests re-verified, Playwright-confirmed locale-independent
   → SC-001, SC-002
3. Add User Story 3 → guidance updated so the convention stays current going forward → SC-004
4. Phase 6 → final cross-check and full quickstart run before merge

### Parallel Team Strategy

With multiple developers/agents:

1. One person completes Setup + User Story 1 (the doc is a small, single-owner deliverable)
2. Once the doc lands:
   - Developer/agent A takes the `apps/frontend/src/app/**` half of User Story 2 (T004-T014)
   - Developer/agent B takes the `libs/frontend/**` half of User Story 2 (T015-T023)
   - Developer/agent C takes User Story 3 (T026-T028) in parallel with both
3. Phase 6 runs once A, B, and C all finish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new test files are added (tests not requested); FR-007 compliance is verified via the existing
  suite (T024), not new assertions
- Retrofit tasks (T004-T023) must add only the `data-testid` attribute (or, for computed values,
  `[attr.data-testid]`) — no other markup, styling, or logic change, per FR-007
- Commit after each task or logical group (per this repo's `speckit.git.commit` extension)
- Stop at the Phase 3 checkpoint to validate the convention independently before starting the retrofit
