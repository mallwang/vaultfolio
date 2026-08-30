---
description: 'Task list for Light/Dark Theme Switch'
---

# Tasks: Light/Dark Theme Switch

**Input**: Design documents from `/specs/010-theme-switch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme-service.md, quickstart.md

**Tests**: Included — plan.md's Technical Context and quickstart.md explicitly call for
`theme.service.spec.ts` and `app-header.component.spec.ts` coverage.

**Organization**: Tasks are grouped by user story (spec.md). This is a small, frontend-only
feature within a single Nx project (`apps/frontend`) — no new Nx app/lib.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, relative to repo root

## Path Conventions

All paths are under `apps/frontend/src/app/`:

- `core/theme/theme.service.ts`, `core/theme/theme.service.spec.ts` (NEW)
- `core/layout/app-header/app-header.component.{ts,html,css,spec.ts}` (MODIFIED)
- `app.config.ts` (MODIFIED)

---

## Phase 1: Setup

**Purpose**: No new project scaffolding is needed — this feature reuses the existing
`apps/frontend` Nx project, its Jest/Angular Testing Library setup, and PrimeNG/PrimeIcons already
wired in `styles.css`/`app.config.ts`.

- [x] T001 Confirm `apps/frontend` builds and its test suite runs cleanly before starting
      (`npm exec nx test frontend`, `npm exec nx build frontend`), so any later failures are
      attributable to this feature's changes.

**Checkpoint**: Baseline green — safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `ThemeService` and PrimeNG dark-mode wiring are shared infrastructure every user
story's acceptance scenarios depend on (US1's toggle needs somewhere to read/write state; US2's
persistence and US3's app-wide consistency are properties of this same service). Building it once,
correctly, here avoids rework across phases.

**⚠️ CRITICAL**: No user story phase can be verified end-to-end until this phase is complete.

- [x] T002 Configure PrimeNG's dark-mode selector in
      `apps/frontend/src/app/app.config.ts`: add `options: { darkModeSelector: '.app-dark' }` to
      the existing `providePrimeNG({ theme: { preset: Aura } })` call (research.md #1). Verify the
      existing light-theme rendering is unaffected (no `.app-dark` class present yet).
- [x] T003 [P] Write `apps/frontend/src/app/core/theme/theme.service.spec.ts` covering, per
      data-model.md "Lifecycle" and contracts/theme-service.md "Behavioral guarantees" (write
      first; expect failures until T004 exists): - Resolves `'dark'`/`'light'` from `localStorage['vaultfolio-theme']` when present and valid. - Falls back to `window.matchMedia('(prefers-color-scheme: dark)').matches` when no valid
      stored value exists. - Falls back to `'light'` when neither a valid stored value nor a matched media query exists. - Treats any invalid/corrupted `localStorage` value, or a thrown read, as "no explicit
      choice" (falls through to the media-query/light default) without erroring. - `toggle()` flips `theme()`, adds/removes the `app-dark` class on
      `document.documentElement`, and writes the new value to
      `localStorage['vaultfolio-theme']`. - `toggle()` never throws even when `localStorage.setItem` throws (write is best-effort; the
      in-memory `theme()` value and DOM class still update).
- [x] T004 Implement `apps/frontend/src/app/core/theme/theme.service.ts` per
      contracts/theme-service.md: `providedIn: 'root'` class exporting `Theme = 'light' | 'dark'`,
      a `readonly theme: Signal<Theme>` resolved synchronously in the constructor per
      data-model.md's three-step lookup (localStorage → `prefers-color-scheme` → light), a
      `toggle()` method implementing the behavioral guarantees above, and constructor-time
      synchronous application of the resolved theme's `app-dark` class on
      `document.documentElement` (research.md #3, avoids flash of wrong theme). Wrap all
      `localStorage` reads/writes in try/catch so a blocked/throwing storage API degrades to
      in-memory-only behavior without errors (spec Edge Cases). Run T003 to green.

**Checkpoint**: `ThemeService` fully implemented and tested in isolation — user story phases can
now wire it into the UI.

---

## Phase 3: User Story 1 - Switch theme from the navigation bar (Priority: P1) 🎯 MVP

**Goal**: Any visitor, signed in or not, can toggle the app's appearance via a control in the
header, with the change applying immediately and no page reload.

**Independent Test**: Open the app signed out, click the toggle, confirm the appearance flips
immediately with no navigation; repeat signed in.

### Tests for User Story 1 ⚠️

- [x] T005 [P] [US1] Extend `apps/frontend/src/app/core/layout/app-header/app-header.component.spec.ts`
      (write first; expect failures until T006/T007 exist) to cover: - The icon-only toggle button renders in both the unauthenticated state (alone, in the
      header's right-hand position) and the authenticated state (inside `app-header__meta`,
      immediately before the "Sign out" button). - Clicking the toggle calls `ThemeService.toggle()` (inject/spy on `ThemeService`, or assert
      the resulting `aria-*`/icon change after a click, per whichever pattern the existing spec
      file already uses for `AuthService`/`CurrentUserStore`). - The button's `aria-pressed` reflects `theme() === 'dark'`, and `aria-label` reads "Switch
      to light theme" / "Switch to dark theme" opposite the current state (FR-008, FR-009).

### Implementation for User Story 1

- [x] T006 [US1] Update `apps/frontend/src/app/core/layout/app-header/app-header.component.ts`:
      `inject(ThemeService)` as a field (eager construction per research.md #3, since this
      component is always rendered at the root), expose a `protected readonly theme = this.themeService.theme`
      (or equivalent computed) and a `protected toggleTheme(): void { this.themeService.toggle(); }`
      handler.
- [x] T007 [US1] Update `apps/frontend/src/app/core/layout/app-header/app-header.component.html`:
      move the theme toggle `p-button` outside the `@if (isAuthenticated())` block so it always
      renders (FR-003); inside the authenticated branch, place it as a sibling immediately before
      the existing sign-out `p-button` inside `app-header__meta` (design.md layout); for the
      unauthenticated case render it alone in the equivalent right-hand position. Bind
      `icon="theme() === 'dark' ? 'pi pi-moon' : 'pi pi-sun'"`,
      `[attr.aria-pressed]="theme() === 'dark'"`,
      `[attr.aria-label]="theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"`,
      `severity="secondary"`, `text`, `(onClick)="toggleTheme()"`, matching the sign-out button's
      ghost styling (design.md "icon-only, circular ghost button").
- [x] T008 [US1] Update `apps/frontend/src/app/core/layout/app-header/app-header.component.css` if
      needed to keep the toggle visually aligned at 30×30px within `app-header__meta` and in the
      standalone unauthenticated position (design.md); reuse existing `app-header__meta` gap/flex
      rules rather than introducing new layout primitives.
- [x] T009 [US1] Run T005 to green and manually validate quickstart.md steps 1–2 (unauthenticated
      toggle visible/usable; authenticated toggle positioned before sign-out; both switch instantly
      with no page reload).

**Checkpoint**: User Story 1 fully functional and independently testable — this alone is a
shippable MVP (theme switches, but doesn't yet need to persist across reloads for this story's own
acceptance scenarios).

---

## Phase 4: User Story 2 - Theme choice is remembered (Priority: P2)

**Goal**: A visitor's explicit theme choice persists across reloads/new tabs in the same browser;
first-time visitors get the OS-preferred default.

**Independent Test**: Switch to dark, reload the page, confirm dark theme is still applied without
re-clicking.

**Note**: The persistence and OS-default logic this story's acceptance scenarios exercise is
already implemented and unit-tested in `ThemeService` (T003/T004, Phase 2) — this phase is about
confirming that behavior end-to-end through the real UI and closing any gaps found.

- [x] T010 [US2] Manually validate quickstart.md steps 3–4: switch to dark, reload, confirm it
      persists; clear `localStorage['vaultfolio-theme']` and reload, confirm fallback to
      `prefers-color-scheme` (or light if unset) without errors in the console; emulate
      `prefers-color-scheme: dark` with storage cleared and confirm a fresh load opens in dark
      theme.
- [x] T011 [US2] If manual validation in T010 surfaces a gap (e.g. a missed edge case in the
      resolution order), add a covering case to
      `apps/frontend/src/app/core/theme/theme.service.spec.ts` and fix it in
      `apps/frontend/src/app/core/theme/theme.service.ts`. Skip this task if T010 finds no gap.

**Checkpoint**: User Stories 1 and 2 both work independently — theme switches and now survives
reloads/new tabs.

---

## Phase 5: User Story 3 - Theme applies consistently across the whole application (Priority: P2)

**Goal**: The selected theme is reflected on every page — public and authenticated — not just the
page where the switch was made.

**Independent Test**: Switch theme on a public page, sign in, navigate to an authenticated page,
confirm the same theme is applied; and vice versa on sign-out.

**Note**: Because `ThemeService` applies the `app-dark` class to `document.documentElement` (a
single global element outside any routed component tree) and `AppHeaderComponent` is rendered
unconditionally at the app root (`app.html`), this consistency is a structural property of Phases
2–3's implementation rather than requiring separate per-route wiring. This phase validates that
property holds and adds regression coverage.

- [x] T012 [US3] Manually validate quickstart.md step 5: switch to dark on a public page (e.g.
      `/sign-in`), sign in, confirm `/app/dashboard`, `/app/holdings`, `/app/settings` all render
      in dark theme; switch to light while signed in, sign out, confirm the public page is light.
- [x] T013 [P] [US3] Add a regression check to
      `apps/frontend/src/app/core/theme/theme.service.spec.ts` (or extend
      `app-header.component.spec.ts`, whichever integration point already exercises navigation
      state) asserting the `app-dark` class on `document.documentElement` is unaffected by
      authentication-state transitions (`CurrentUserStore` going authenticated ↔ unauthenticated)
      — i.e. signing in/out never resets or re-derives the theme.

**Checkpoint**: All three user stories independently functional — theme switches instantly,
persists, and applies everywhere regardless of auth state or route.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final accessibility verification and full-suite validation across all stories.

- [x] T014 [P] Manually validate quickstart.md step 6 (accessibility): tab to the toggle
      keyboard-only, confirm visible focus and Enter/Space activation; inspect `aria-pressed` and
      `aria-label` update correctly after each toggle (SC-004, FR-008).
- [x] T015 Run the full frontend suite (`npm exec nx test frontend`) and confirm no regressions in
      `app-header.component.spec.ts` or elsewhere from moving the toggle button outside the
      `@if` block.
- [x] T016 Run `npm exec nx build frontend` and manually re-walk quickstart.md end-to-end once more
      as a final sanity pass before merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories — `ThemeService` (T004)
  must exist before `AppHeaderComponent` can consume it (T006).
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T004). This is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational (T004, already implements persistence) and
  benefits from US1's UI existing (T006/T007) to validate through the real toggle, but its own
  acceptance scenarios are already satisfied by Phase 2 — this phase is validation, not new
  build-out.
- **User Story 3 (Phase 5)**: Depends on Foundational (T002, T004) and US1's UI (T006/T007) to have
  something to click across routes/auth states during validation.
- **Polish (Phase 6)**: Depends on all prior phases.

### Within Each Phase

- Tests (T003, T005) MUST be written and failing before their corresponding implementation
  (T004, T006/T007).
- Service before component wiring (T004 before T006).
- Component logic before template before styling (T006 → T007 → T008).

### Parallel Opportunities

- T003 (`ThemeService` spec) has no file overlap with T002 (`app.config.ts`) — can run in
  parallel.
- T005 (`app-header` spec additions) can be drafted in parallel with T002/T003/T004 since it's a
  different file, though it will fail until T006/T007 land.
- T013 and T014 touch different files/concerns from each other and from T015/T016 — parallelizable.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Configure PrimeNG dark-mode selector in apps/frontend/src/app/app.config.ts"
Task: "Write ThemeService spec in apps/frontend/src/app/core/theme/theme.service.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T004) — `ThemeService` fully implemented and unit-tested.
3. Complete Phase 3: User Story 1 (T005–T009) — toggle wired into the header, working end-to-end.
4. **STOP and VALIDATE**: quickstart.md steps 1–2 pass; this alone is a demoable MVP (theme
   switches instantly for both auth states, even without persistence guarantees re-verified yet).

### Incremental Delivery

1. Setup + Foundational → `ThemeService` ready and tested.
2. User Story 1 → toggle works, no reload → demo-ready MVP.
3. User Story 2 → confirm/harden persistence across reloads.
4. User Story 3 → confirm/harden app-wide consistency across routes and auth transitions.
5. Polish → accessibility pass, full suite, final quickstart walk-through.

---

## Notes

- This feature has no backend, no new Nx project, and no API contracts — all "contracts" here are
  the internal `ThemeService` boundary (contracts/theme-service.md).
- US2 and US3 are largely validation phases against Phase 2's implementation rather than new
  build-out, because `ThemeService`'s single-source-of-truth design (root-level class toggle,
  root-level always-rendered header) makes persistence and cross-route consistency structural
  properties rather than something requiring separate code per story.
- Commit after each phase/logical group; stop at any checkpoint to validate independently.
</content>
