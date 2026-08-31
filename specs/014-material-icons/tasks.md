---
description: 'Task list template for feature implementation'
---

# Tasks: Material Icons as Default Icon Library

**Input**: Design documents from `/specs/014-material-icons/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Component tests are called for explicitly in plan.md's Testing section (name→glyph
resolution + unknown-name fallback for `vf-icon`); included below. No contract/integration tests
are needed (no API/contract changes).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Nx app, no new project: all paths are under `apps/frontend/src/app/` or
`apps/frontend/src/` (index.html, styles.css) or workspace root (`package.json`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Load the Material Symbols font and scaffold the `vf-icon` component that every user
story's file conversions depend on.

- [ ] T001 Add Material Symbols Outlined `<link>` tags (preconnect + stylesheet, per research.md
      §1) to `apps/frontend/src/index.html`, following the existing Inter font `<link>` pattern
- [ ] T002 [P] Create `ICON_NAME_MAP` in `apps/frontend/src/app/shared/icon/icon-name.map.ts` with
      the known mappings from data-model.md's table (`home`, `briefcase`→`work`,
      `chart-line`→`show_chart`, `check-circle`→`check_circle`, `clock`→`schedule`, `cog`→`settings`,
      `contract`→`description`, `download`, `envelope`→`mail`, `warning`, `inbox`, `key`, `lock`,
      `moon`→`dark_mode`, `sun`→`light_mode`, `pencil`→`edit`, `plus`→`add`, `replay`, `search`,
      `send`, `shield`, `sign-out`→`logout`, `spinner`→`progress_activity`, `close`, `trash`→`delete`,
      `upload`, `user-plus`→`person_add`, `arrow-left`→`arrow_back`)
- [ ] T003 [US1] Create `vf-icon` standalone Angular component
      (`apps/frontend/src/app/shared/icon/icon.component.ts` + `.html`) with a `name` input resolved
      via `ICON_NAME_MAP`, a `spin` input toggling a `vf-icon--spin` CSS class, `aria-hidden="true"` by
      default (research.md §4), and an `error`-glyph + `console.warn` fallback for unmapped names
      (FR-007, data-model.md's fallback contract)
- [ ] T004 [P] Add the `vf-icon--spin` rotation keyframe animation (same visual effect as today's
      `pi-spin` CSS) to `apps/frontend/src/styles.css` or a component-scoped stylesheet for
      `icon.component.ts`

**Checkpoint**: `vf-icon` is available for use; no template has been converted yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None beyond Phase 1 — this feature has no database/auth/routing prerequisites. Phase
1 already delivers the one shared building block (`vf-icon`) all user stories depend on, so there
is no separate blocking phase here.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Consistent icon visuals across the app (Priority: P1) 🎯 MVP

**Goal**: Every `<i class="pi pi-*">` usage across the app is replaced with `<vf-icon name="...">`,
so all icons render from the Material Symbols family everywhere (dashboard, holdings, admin, auth,
profile).

**Independent Test**: Navigate every major area of the app (dashboard, holdings, admin, auth,
profile) and confirm all icons render from the same visual family with no leftover `pi-*` glyphs
(quickstart.md §1).

### Tests for User Story 1

- [ ] T005 [P] [US1] Component test for `vf-icon` name→glyph resolution (each `ICON_NAME_MAP`
      entry renders its mapped glyph) in
      `apps/frontend/src/app/shared/icon/icon.component.spec.ts`
- [ ] T006 [P] [US1] Component test for `vf-icon` unknown-name fallback (renders `error` glyph +
      calls `console.warn`) in `apps/frontend/src/app/shared/icon/icon.component.spec.ts`

### Implementation for User Story 1

- [ ] T007 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/account/forgot-password/forgot-password.component.html`
- [ ] T008 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/account/link-invalid/link-invalid.component.html`
- [ ] T009 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/account/reset-password/reset-password.component.html`
- [ ] T010 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/account/verify-email/verify-email.component.html`
- [ ] T011 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/accounts/accounts.component.html` and
      `apps/frontend/src/app/admin/accounts/accounts.component.ts`
- [ ] T012 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/health-status/health-status.component.html`
- [ ] T013 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/invitations/invitations.component.html` and
      `apps/frontend/src/app/admin/invitations/invitations.component.ts`
- [ ] T014 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/invitations/invite-dialog/invite-dialog.component.html`
- [ ] T015 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/signups/reject-dialog/reject-dialog.component.html`
- [ ] T016 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/admin/signups/signups.component.html` and
      `apps/frontend/src/app/admin/signups/signups.component.ts`
- [ ] T017 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/core/layout/app-header/app-header.component.html`
- [ ] T018 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/core/layout/application-areas.ts`
- [ ] T019 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/core/layout/not-found/not-found.component.html`
- [ ] T020 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/dashboard/dashboard.component.html`
- [ ] T021 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/holdings/holdings.component.html` and
      `apps/frontend/src/app/holdings/holdings.component.ts`
- [ ] T022 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/imports/imports.component.html`
- [ ] T023 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/invite/accept/accept.component.html`
- [ ] T024 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/invite/expired/expired.component.html`
- [ ] T025 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/settings/profile/profile.component.html`
- [ ] T026 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/signup/signup.component.html`
- [ ] T027 [P] [US1] Replace `pi pi-*` usages with `<vf-icon name="...">` in
      `apps/frontend/src/app/signup/verify/verify.component.html`
- [ ] T028 [US1] Extend `ICON_NAME_MAP` (`icon-name.map.ts`) with any additional icon names
      discovered while performing T007–T027 that were not in the data-model.md starting inventory
- [ ] T029 [US1] Re-run
      `grep -rE "pi pi-|['\"]pi-[a-z]" apps/frontend/src` and confirm zero matches remain in app-level
      templates/components (PrimeNG-internal icons handled separately in User Story 2)

**Checkpoint**: At this point, all app-level (non-PrimeNG-internal) icon usages render via
`vf-icon`/Material Symbols; User Story 1 is independently testable per its Independent Test.

---

## Phase 4: User Story 2 - No visual regression in icon-driven components (Priority: P2)

**Goal**: PrimeNG components that render icons from their own internals (dialog close, dropdown
triggers, table sort arrows, confirm-dialog icons, toast severity icons) are given icon-slot
`ng-template` overrides rendering `vf-icon`, so their meaning stays clear after the swap.

**Independent Test**: Exercise each interactive control that depends on an icon (dropdowns,
dialogs, table sorting/pagination, alerts/toasts, form validation icons) and confirm each renders a
recognizable icon that conveys the same meaning as its prior counterpart (quickstart.md §2).

### Implementation for User Story 2

- [ ] T030 [US2] Add `#closeicon` `ng-template` override (rendering `<vf-icon name="close">`) to
      every `p-dialog` usage: `apps/frontend/src/app/admin/signups/reject-dialog/reject-dialog.component.html`,
      `apps/frontend/src/app/admin/invitations/invite-dialog/invite-dialog.component.html`,
      `apps/frontend/src/app/settings/profile/profile.component.html`,
      `apps/frontend/src/app/holdings/holdings.component.html`
- [ ] T031 [US2] Add dropdown-trigger icon-slot `ng-template` override (rendering
      `<vf-icon name="...">` with a chevron-down equivalent glyph) to every `p-select` usage:
      `apps/frontend/src/app/core/layout/app-header/app-header.component.html`,
      `apps/frontend/src/app/admin/invitations/invite-dialog/invite-dialog.component.html`,
      `apps/frontend/src/app/admin/accounts/accounts.component.html`,
      `apps/frontend/src/app/settings/preferences/preferences.component.html`,
      `apps/frontend/src/app/holdings/holding-form/holding-form.component.html`
- [ ] T032 [US2] Add trigger-icon `ng-template` override (rendering `<vf-icon name="...">` with a
      calendar glyph) to the `p-datepicker` usage in
      `apps/frontend/src/app/holdings/holding-form/holding-form.component.html`
- [ ] T033 [US2] Add sort-icon `ng-template` override(s) (ascending/descending/unsorted states,
      rendering `<vf-icon name="...">`) to every `p-table` usage:
      `apps/frontend/src/app/admin/signups/signups.component.html`,
      `apps/frontend/src/app/admin/invitations/invitations.component.html`,
      `apps/frontend/src/app/admin/accounts/accounts.component.html`,
      `apps/frontend/src/app/holdings/holdings.component.html`
- [ ] T034 [US2] Add icon + close icon-slot overrides to every `p-confirmdialog`/
      `ConfirmationService` usage: `apps/frontend/src/app/admin/signups/signups.component.ts`/`.html`,
      `apps/frontend/src/app/admin/invitations/invitations.component.ts`/`.html`,
      `apps/frontend/src/app/admin/accounts/accounts.component.ts`/`.html`,
      `apps/frontend/src/app/holdings/holdings.component.ts`/`.html`
- [ ] T035 [US2] Audit and, if rendered via a slot rather than CSS, add severity-icon overrides
      (success/warning/error/info, each a distinct `vf-icon` glyph) for every `p-toast`/`p-message`
      usage: `apps/frontend/src/app/admin/signups/signups.component.html`,
      `apps/frontend/src/app/admin/invitations/invitations.component.html`,
      `apps/frontend/src/app/admin/accounts/accounts.component.html`,
      `apps/frontend/src/app/settings/profile/profile.component.html`,
      `apps/frontend/src/app/settings/preferences/preferences.component.html`,
      `apps/frontend/src/app/holdings/holdings.component.html`
- [ ] T036 [US2] Manually verify the loading/spinner icon (`vf-icon`'s `[spin]` input,
      `spinner`→`progress_activity`) still animates wherever the old `pi-spin`/`pi-spinner` was used

**Checkpoint**: All PrimeNG-internal icons are overridden; User Stories 1 AND 2 both work
independently (no `pi-*` remains anywhere, including inside PrimeNG component internals).

---

## Phase 5: User Story 3 - Icon choice is documented for future work (Priority: P3)

**Goal**: The project's authoritative tech-stack documentation names Material Icons as the sole
required icon library and prohibits PrimeIcons.

**Independent Test**: Check the project's authoritative technology/architecture documentation and
confirm it names the new icon library as the sole, standard choice going forward
(quickstart.md §6).

**Status**: Already satisfied — the constitution's "Icon library" Stack Decision entry
(`.specify/memory/constitution.md`, v3.1.0) already names Material Icons as required and prohibits
PrimeIcons (see plan.md's Constitution Check). No task is needed for this story; it is verified as
part of Polish (T040).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Remove the now-unused `primeicons` dependency and run full validation per
quickstart.md.

- [ ] T037 Remove `@import 'primeicons/primeicons.css';` from `apps/frontend/src/styles.css`
- [ ] T038 [P] Remove the `primeicons` dependency from `package.json` (and
      `apps/frontend/package.json` if declared there too, per this repo's convention of declaring
      runtime deps in each app's own package.json) and run `npm install` to update the lockfile
- [ ] T039 Run
      `grep -rE "pi pi-|['\"]pi-[a-z]" apps/frontend/src && echo "FAIL" || echo "PASS"` and
      `grep -rn "primeicons" apps/frontend/src apps/frontend/package.json package.json 2>/dev/null && echo "FAIL" || echo "PASS"`
      (quickstart.md §1) and confirm both print `PASS`
- [ ] T040 [P] Run quickstart.md's full validation checklist (§§1–6): visual sweep across
      dashboard/holdings/admin/auth/profile, interactive-control meaning check, light/dark theme +
      disabled-state check, unknown-icon fallback check, accessibility spot-check, and the constitution
      documentation check
- [ ] T041 [P] Run `npm exec nx test frontend` and `npm exec nx lint frontend` and fix any
      failures introduced by the icon swap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. Delivers `vf-icon` and
  `ICON_NAME_MAP`, which every later phase depends on.
- **Foundational (Phase 2)**: N/A for this feature (folded into Phase 1 — see note above).
- **User Story 1 (Phase 3)**: Depends on Phase 1 (`vf-icon` must exist before templates can use
  it). Tasks T007–T027 (one file each) are independent of each other and fully parallelizable.
- **User Story 2 (Phase 4)**: Depends on Phase 1 (`vf-icon`); independent of User Story 1's
  completion in principle, but touches the same files as several US1 tasks (e.g.
  `holdings.component.html` appears in both T021 and T030/T033/T034/T035), so treat same-file
  US1/US2 tasks as sequential even though both are tagged for parallel-eligible files elsewhere.
- **User Story 3 (Phase 5)**: Already complete (constitution updated during planning); no
  implementation dependency on Phases 3–4.
- **Polish (Phase 6)**: Depends on User Story 1 AND User Story 2 both being complete (T037–T039
  require zero remaining `pi-*`/`primeicons` references, which only holds once both stories are
  done).

### Within Each User Story

- Phase 3: T005/T006 (tests) can run alongside T007–T027 (implementation) since they test
  `vf-icon` directly, not the converted templates; T028 (extend map) and T029 (verification grep)
  come after all file conversions.
- Phase 4: T030–T035 are grouped by PrimeNG component type; tasks touching different files are
  parallelizable, tasks touching the same file (e.g. `holdings.component.html` in T030/T033/T034/
  T035) must be done sequentially. T036 (spinner check) is a manual verification after T030–T035.

### Parallel Opportunities

- T002 (icon map) and T004 (spin CSS) can run in parallel with each other, both before T003.
- All of T007–T027 (21 single/dual-file tasks) can run in parallel — different files, no shared
  state beyond the already-built `vf-icon`/`ICON_NAME_MAP`.
- T005 and T006 (both same spec file) should be done together/sequentially in one edit rather than
  truly parallel, despite the `[P]` marker being technically valid for "different assertions."
- T038, T040, T041 in Polish can run in parallel with each other once T037/T039 confirm cleanup is
  complete.

---

## Parallel Example: User Story 1

```bash
# After Phase 1 (vf-icon + ICON_NAME_MAP) is complete, launch file conversions together:
Task: "Replace pi pi-* usages in apps/frontend/src/app/dashboard/dashboard.component.html"
Task: "Replace pi pi-* usages in apps/frontend/src/app/holdings/holdings.component.html and .ts"
Task: "Replace pi pi-* usages in apps/frontend/src/app/admin/accounts/accounts.component.html and .ts"
Task: "Replace pi pi-* usages in apps/frontend/src/app/signup/signup.component.html"
# ...and so on for the remaining independent files (T007-T027)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`vf-icon` component + icon map + font loading)
2. Complete Phase 3: User Story 1 (all app-level template conversions)
3. **STOP and VALIDATE**: Run quickstart.md §1's visual sweep and automated grep check
4. Note: `pi-*` usages baked into PrimeNG component internals (dialog close, table sort, etc.)
   will still show PrimeIcons glyphs until User Story 2 is done — this is expected at the MVP
   checkpoint, not a regression to fix within US1.

### Incremental Delivery

1. Complete Setup → `vf-icon` ready
2. Add User Story 1 → all app-authored icons converted → validate with quickstart §1 (MVP)
3. Add User Story 2 → PrimeNG-internal icons overridden → validate with quickstart §2–3
   (no PrimeIcons glyph remains anywhere, including component internals)
4. Polish → remove `primeicons` dependency, full quickstart validation, confirm constitution
   already documents the decision (User Story 3)

### Parallel Team Strategy

With multiple developers, after Phase 1 (Setup) is done:

- Developer A: User Story 1 file conversions (T007–T027), split by app area
- Developer B: User Story 2 PrimeNG icon-slot overrides (T030–T036), once Phase 1 lands
- Coordinate on shared files (e.g. `holdings.component.html`, `accounts.component.html`,
  `invitations.component.html`, `signups.component.html` appear in both stories) to avoid merge
  conflicts — do the US1 pass on a file before its US2 pass

---

## Notes

- [P] tasks = different files, no dependencies (unless flagged otherwise above for same-file
  overlap between US1 and US2)
- [Story] label maps task to specific user story for traceability
- User Story 3 requires no implementation task — the constitution amendment was already made
  during `/speckit-plan` (v3.1.0); Polish's T040 re-verifies it via quickstart.md §6
- Commit after each task or logical group
- Stop at the Phase 3 checkpoint to validate User Story 1 (MVP) independently before starting
  Phase 4
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
