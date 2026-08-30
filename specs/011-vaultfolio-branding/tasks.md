---
description: 'Task list template for feature implementation'
---

# Tasks: Vaultfolio Branding

**Input**: Design documents from `/specs/011-vaultfolio-branding/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: This feature includes one existing test task (`VaultfolioTitleStrategy` behavior) since
its non-trivial fallback logic is testable in isolation; no other tasks are pure UI markup/asset
changes that don't warrant additional automated tests per the constitution's Test-First principle
(scoped to financial data/calculations, which this feature does not touch).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

All paths are under `apps/frontend/` (Angular), per plan.md's Project Structure — this feature
introduces no backend or `libs/` changes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the single brand asset in place before any story references it.

- [ ] T001 Add the Vaultfolio logo source art at `apps/frontend/public/vaultfolio-logo.png`
- [ ] T002 [P] Regenerate `apps/frontend/public/favicon.ico` from the same logo art (replacing the
      previous generic favicon)
- [ ] T003 [P] Copy the logo to the repo root as `logo.png` (source for the README, per
      research.md §3)

**Checkpoint**: Brand asset exists and is available to every downstream story.

---

## Phase 2: Foundational (Blocking Prerequisites)

No cross-story blocking infrastructure is required — routing, theming, and layout each touch
disjoint files (`app.routes.ts`/`core/title.strategy.ts` for US1, `app.config.ts` theme preset for
US3, `app-header`/`app-sidebar` for US2, `README.md` for US4). Skip directly to the user stories;
each depends only on Phase 1's asset where noted.

---

## Phase 3: User Story 1 - Recognizable browser tab per page (Priority: P1) 🎯 MVP

**Goal**: Every route's browser tab title reads "Vaultfolio - <Page>", with a bare "Vaultfolio"
fallback, updating on client-side navigation without a full reload.

**Independent Test**: Navigate through the app's routes (sign-in, dashboard, holdings, imports,
settings, an unknown path) and confirm each browser tab title per spec.md's Acceptance Scenarios.

### Tests for User Story 1

- [ ] T004 [P] [US1] Unit test `VaultfolioTitleStrategy` in
      `apps/frontend/src/app/core/title.strategy.spec.ts` — assert it prefixes a resolved route
      title with `"Vaultfolio - "` and falls back to bare `"Vaultfolio"` when no route title
      resolves

### Implementation for User Story 1

- [ ] T005 [US1] Implement `VaultfolioTitleStrategy` (extends Angular's `TitleStrategy`) in
      `apps/frontend/src/app/core/title.strategy.ts`, using `buildTitle(snapshot)` and
      `Title.setTitle()` per research.md §1 (depends on T004 per Test-First ordering when TDD is
      followed)
- [ ] T006 [US1] Add a `title` string to every route in
      `apps/frontend/src/app/app.routes.ts` (Sign In, Invite Expired, Accept Invite, Link
      Invalid, Verify Email, Forgot Password, Reset Password, Sign Up, Verify Sign Up, Dashboard,
      Holdings, Imports, Settings, and both `**` wildcard Not Found routes)
- [ ] T007 [US1] Register `{ provide: TitleStrategy, useClass: VaultfolioTitleStrategy }` in the
      `providers` array of `apps/frontend/src/app/app.config.ts`
- [ ] T008 [US1] Remove the now-unused static `title` class field from
      `apps/frontend/src/app/app.ts` (superseded by per-route titles)
- [ ] T009 [US1] Update the static `<title>` in `apps/frontend/src/index.html` from `"frontend"`
      to `"Vaultfolio"` (the pre-hydration/initial value, before the router strategy takes over)

**Checkpoint**: User Story 1 is fully functional and independently testable — every route now
produces a "Vaultfolio"-branded browser tab title.

---

## Phase 4: User Story 2 - Consistent brand identity in the app shell (Priority: P2)

**Goal**: The Vaultfolio logo appears as the favicon, apple-touch-icon, and in the app header; the
old sidebar brand mark/wordmark is removed so branding isn't duplicated.

**Independent Test**: Open the app, inspect the tab icon and app header for the logo, and confirm
the sidebar (including its collapsed/mobile layout) no longer renders a separate brand mark.

**Depends on**: Phase 1 (T001–T003) for the logo asset.

### Implementation for User Story 2

- [ ] T010 [US2] Add `<link rel="apple-touch-icon" href="vaultfolio-logo.png" />` to
      `apps/frontend/src/index.html` (favicon `<link>` already points at `favicon.ico`, updated by
      T002)
- [ ] T011 [P] [US2] Add `.app-header__brand` and `.app-header__logo` styles to
      `apps/frontend/src/app/core/layout/app-header/app-header.component.css`
- [ ] T012 [US2] Wrap the header's crumb/title block in a `.app-header__brand` container and add
      the logo `<img>` in `apps/frontend/src/app/core/layout/app-header/app-header.component.html`
      (depends on T011 for the class names it references)
- [ ] T013 [P] [US2] Remove the `.app-brand`, `.app-brand__mark`, `.app-brand__name` rules
      (including their mobile/collapsed-layout overrides) from
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.css`
- [ ] T014 [P] [US2] Remove the `.app-brand` markup block from
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html`

**Checkpoint**: User Stories 1 AND 2 both work independently — tab icon, touch icon, and header
all carry the Vaultfolio logo, and it is not duplicated in the sidebar.

---

## Phase 5: User Story 3 - Brand-consistent accent color (Priority: P3)

**Goal**: Primary buttons, links, and focus rings use a teal accent pinned to the logo's icon
color (`teal.700`), with correct hover/active shades, in both light and dark mode.

**Independent Test**: Inspect a primary button, a link, and a focused form field in both light and
dark mode; confirm the accent matches the logo and that hover/active states are darker teal
shades.

### Implementation for User Story 3

- [ ] T015 [US3] Define `VaultfolioPreset` via `definePreset(Aura, { semantic: { primary: {...} } })`
      in `apps/frontend/src/app/app.config.ts`, mapping `50`–`950` to `{teal.*}` tokens and pinning
      `color`/`hoverColor`/`activeColor` to `{teal.700}`/`{teal.800}`/`{teal.900}` per research.md
      §2
- [ ] T016 [US3] Switch `providePrimeNG`'s `theme.preset` from `Aura` to `VaultfolioPreset` in
      `apps/frontend/src/app/app.config.ts` (keep `darkModeSelector: '.app-dark'` unchanged;
      depends on T015)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — the app's interactive accent
color now matches the Vaultfolio logo in both theme modes.

---

## Phase 6: User Story 4 - Branded project README (Priority: P4)

**Goal**: The Vaultfolio logo is displayed centered near the top of the README, above the intro
description.

**Independent Test**: Open `README.md` and confirm the logo renders before the introductory
paragraph.

**Depends on**: Phase 1 (T003) for the repo-root `logo.png` copy.

### Implementation for User Story 4

- [ ] T017 [US4] Add a centered `<p align="center"><img src="logo.png" ... /></p>` block above the
      introductory paragraph in `README.md`

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T018 Run `npx nx test frontend`, `npx nx lint frontend`, `npx nx build frontend` and confirm
      no new failures
- [ ] T019 Walk through every scenario in [quickstart.md](./quickstart.md) manually in a running
      `npx nx serve frontend` session, in both light and dark mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Empty for this feature — proceed directly to user stories.
- **User Stories (Phase 3–6)**: US1 has no dependency on Phase 1. US2 and US4 depend on Phase 1's
  logo asset (T001/T003). US3 is fully independent of Phase 1. All four stories are independent of
  each other and can proceed in any order or in parallel.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories or on Phase 1.
- **User Story 2 (P2)**: Depends on Phase 1 (logo asset) only.
- **User Story 3 (P3)**: No dependencies on Phase 1 or other stories.
- **User Story 4 (P4)**: Depends on Phase 1 (logo asset copy) only.

### Parallel Opportunities

- T002 and T003 can run in parallel with each other (after T001).
- T004 (test) can be written in parallel with nothing else in US1 (it precedes T005 by Test-First
  ordering).
- T011, T013, T014 (different CSS/HTML files) can run in parallel within US2.
- Once Phase 1 completes, US1, US2, US3, and US4 can all proceed in parallel (different
  developers/files) since none of them share a file.

---

## Parallel Example: Phase 1 + all four user stories

```bash
# After Phase 1 (T001-T003) completes, the four stories touch disjoint files and can run together:
Task: "US1 — title.strategy.ts, app.routes.ts, app.config.ts (TitleStrategy), app.ts, index.html <title>"
Task: "US2 — index.html apple-touch-icon, app-header.component.{css,html}, app-sidebar.component.{css,html}"
Task: "US3 — app.config.ts (VaultfolioPreset + theme.preset)"
Task: "US4 — README.md"
```

Note: US1 and US3 both edit `apps/frontend/src/app/app.config.ts` (different, non-overlapping
regions — provider array vs. theme preset) — coordinate to avoid merge conflicts if worked on
simultaneously by different people.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: Confirm every route's browser tab title per quickstart.md's US1 section.
4. Deploy/demo if ready — this alone fixes the most visible branding gap.

### Incremental Delivery

1. Setup → logo asset ready.
2. Add User Story 1 → validate → ship (MVP: correct tab titles everywhere).
3. Add User Story 2 → validate → ship (logo in favicon/touch-icon/header, sidebar mark removed).
4. Add User Story 3 → validate → ship (teal accent color).
5. Add User Story 4 → validate → ship (branded README).
6. Run Phase 7 polish/regression pass after all four are in.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature was found already implemented in the working tree when this task list was
  generated (see git history on branch `011-vaultfolio-branding`); tasks above describe the
  correct build order for reproducing it from scratch, and double as a review/verification
  checklist against the existing changes.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
