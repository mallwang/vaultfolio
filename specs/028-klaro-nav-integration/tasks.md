---
description: 'Task list template for feature implementation'
---

# Tasks: Klaro Navigation Entry

**Input**: Design documents from `/specs/028-klaro-nav-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/klaro-nav-and-page.md, quickstart.md

**Tests**: Not explicitly requested as TDD, but the spec's quickstart.md names specific automated
coverage (sidebar fallback test, route-table test, page-content test) — these are included as part
of each story's implementation, written alongside the code they cover per project convention.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are exact, from plan.md's Project Structure

## Path Conventions

Nx monorepo: `apps/frontend/src/app/` (Angular app-shell), `libs/frontend/domain/klaro/src/`
(new library), `libs/frontend/domain-access/src/lib/` (entitlement registry), `libs/frontend/
shared-ui/src/lib/i18n/translations/` (i18n dictionaries), `apps/frontend/public/` (static assets).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new `@vaultfolio/frontend-domain-klaro` library and land the real logo
asset, mirroring the existing `insurances` placeholder library exactly in shape.

- [x] T001 Create `libs/frontend/domain/klaro/` library scaffold (`package.json`, `project.json`,
      `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `src/index.ts`), copied and
      renamed from `libs/frontend/domain/insurances/` (name: `@vaultfolio/frontend-domain-klaro`,
      tag `scope:frontend-domain`, deps limited to `scope:shared` per plan.md Constitution Check)
- [x] T002 [P] Add `apps/frontend/public/klaro-logo.png` — the Klaro brand mark pulled from
      https://github.com/mallwang/klaro (`klaro.png` at repo root), per research.md #2
- [x] T003 [P] Register the new library's path mapping/project reference so
      `@vaultfolio/frontend-domain-klaro` resolves the same way `@vaultfolio/frontend-domain-
  insurances` does (`tsconfig.base.json` / workspace project references, whichever the
      insurances library uses)

**Checkpoint**: Library builds empty/lints clean; asset is present on disk.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Registry, route, and i18n key scaffolding every user story's UI depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add `logoAsset?: string` field to the `ApplicationArea` interface in
      `apps/frontend/src/app/core/layout/application-areas.ts` (data-model.md — `icon` stays
      required)
- [x] T005 Add the Klaro `ApplicationArea` entry to `APPLICATION_AREAS` in
      `apps/frontend/src/app/core/layout/application-areas.ts`, positioned between
      `account-overview` and `settings`, per the contract in
      `specs/028-klaro-nav-integration/contracts/klaro-nav-and-page.md`
      (`id: 'klaro'`, `labelKey: 'nav.klaro'`, `path: 'klaro'`, `icon: 'handshake'`,
      `logoAsset: 'klaro-logo.png'`, `domainId: 'klaro'`)
- [x] T006 [P] Append the Klaro `DomainDescriptor` entry (`{ id: 'klaro', labelKey: 'nav.klaro',
  path: 'klaro', icon: 'handshake' }`) to `DOMAIN_REGISTRY` in
      `libs/frontend/domain-access/src/lib/domain-registry.ts`
- [x] T007 [P] Add `nav.klaro` and `pageTitle.klaro` i18n keys to
      `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`

**Checkpoint**: `DOMAIN_REGISTRY`/`APPLICATION_AREAS` know about Klaro; the entitlement gate and
nav-label lookups have what they need. No UI renders it yet (no route, no sidebar image handling,
no page content) — that's each user story's job.

---

## Phase 3: User Story 1 - Discover Klaro from the side navigation (Priority: P1) 🎯 MVP

**Goal**: A signed-in, entitled user sees a "Klaro" entry with the real Klaro logo in the side nav,
positioned after Account Overview and before Settings, and selecting it navigates somewhere (a
minimal routed page is enough to satisfy this story — full content is US2/US3).

**Independent Test**: Sign in, open the side navigation, confirm the "Klaro" entry renders with the
Klaro logo (not a Material Symbols glyph) in the correct position, select it, and land on
`/app/klaro`.

### Implementation for User Story 1

- [x] T008 [US1] Scaffold `KlaroPageComponent` (standalone, no inputs/outputs) at
      `libs/frontend/domain/klaro/src/lib/klaro-page/klaro-page.component.ts` with a minimal hero
      section (title + `heroSubtitle`), modeled on
      `libs/frontend/domain/insurances/src/lib/insurances-placeholder/
  insurances-placeholder.component.ts` for boilerplate (inline template/styles)
- [x] T009 [US1] Export `KlaroPageComponent` from
      `libs/frontend/domain/klaro/src/index.ts`
- [x] T010 [US1] Add the `klaro` route to `apps/frontend/src/app/app.routes.ts`
      (`path: 'klaro'`, `title: 'pageTitle.klaro'`, `canActivate: [domainGuard('klaro')]`,
      `loadComponent` lazy-importing `KlaroPageComponent` from
      `@vaultfolio/frontend-domain-klaro`), alongside the other domain routes under `/app`
- [x] T011 [US1] Update `app-sidebar.component.html` to render `<img [src]="'klaro-logo.png' |
  ..." >` (or `area.logoAsset`) in the icon slot when `area.logoAsset` is set, falling back to
      the existing `<app-icon [name]="area.icon">` otherwise, in
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html`
- [x] T012 [US1] Add sizing rules for the logo-mark slot (matching the existing icon slot's
      dimensions, desktop + collapsed + mobile-top-bar states) in
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.css`
- [x] T013 [US1] Add `data-testid="sidebar-nav-item-klaro"` to the Klaro entry's rendered markup in
      `app-sidebar.component.html`, following the existing `sidebar-nav-item-<area.id>` convention
      (per [testid-conventions.md](../../docs/frontend/testid-conventions.md) and quickstart.md)
- [x] T014 [US1] Extend `app-sidebar.component.spec.ts` with a `klaro` fixture asserting: the entry
      renders with `logoAsset` as an `<img>` instead of `<app-icon>`, and appears between
      `account-overview` and `settings`
- [x] T015 [US1] Extend `app.routes.spec.ts` with an assertion that the `klaro` route exists, is
      guarded by `domainGuard('klaro')`, and lazy-loads `KlaroPageComponent`
- [x] T016 [US1] [P] Add `klaro-page.component.spec.ts` at
      `libs/frontend/domain/klaro/src/lib/klaro-page/klaro-page.component.spec.ts` asserting the
      component renders (smoke test) — expanded further in US2/US3

**Checkpoint**: User Story 1 is independently functional and testable per quickstart.md's US1
section — the nav entry is discoverable, correctly branded, correctly positioned, and routes to a
real (if minimal) page.

---

## Phase 4: User Story 2 - Understand what Klaro is and how to reach it (Priority: P1)

**Goal**: The Klaro page explains what Klaro is, states it is a standalone application today, and
provides a working external link that opens in a new tab without disrupting the Vaultfolio session.

**Independent Test**: Navigate to `/app/klaro`, verify the description and standalone-app statement
are present, select the external link, and confirm it opens `https://klaro.allwang.family/` in a
new tab while the Vaultfolio tab stays open.

### Implementation for User Story 2

- [x] T017 [P] [US2] Add `klaroPage.description`, `klaroPage.feature1`…`feature4`,
      `klaroPage.standaloneBanner`, `klaroPage.externalLinkLabel`, `klaroPage.externalLinkCaption`
      i18n keys to `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`
- [x] T018 [US2] Extend `KlaroPageComponent`'s template
      (`libs/frontend/domain/klaro/src/lib/klaro-page/klaro-page.component.ts`) with the
      description paragraph, feature-highlight bullets, and standalone-app banner section
      (`p-card`, `TranslatePipe`), per design.md's approved layout (FR-004, FR-005)
- [x] T019 [US2] Add the external link ("Open Klaro ↗") to `KlaroPageComponent`'s template,
      `href="https://klaro.allwang.family/"`, `target="_blank"`, `rel="noopener"`, with the
      `externalLinkCaption` text nearby (FR-006)
- [x] T020 [US2] Extend `klaro-page.component.spec.ts` to assert: the description/standalone-app
      content blocks are present, and the external link has the correct `href`, `target="_blank"`,
      and `rel="noopener"`

**Checkpoint**: User Stories 1 AND 2 both work independently — the page now delivers real value
(what Klaro is + how to reach it) on top of the discoverable nav entry.

---

## Phase 5: User Story 3 - Understand the account and data-sync relationship (Priority: P2)

**Goal**: The Klaro page's "Where this is headed" section states the future-integration plan, the
current separate-account requirement, and the same-email-address requirement for future sync.

**Independent Test**: Navigate to `/app/klaro`, verify all three roadmap statements (future
integration, current separate account, same-email-address sync requirement) are present.

### Implementation for User Story 3

- [x] T021 [P] [US3] Add `klaroPage.roadmapToday`, `klaroPage.roadmapSync`,
      `klaroPage.roadmapFuture` i18n keys to
      `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `de.ts`
- [x] T022 [US3] Add the "Where this is headed" roadmap card to `KlaroPageComponent`'s template
      (`libs/frontend/domain/klaro/src/lib/klaro-page/klaro-page.component.ts`) with three rows
      (Today/Sync/Future) rendering `roadmapToday`, `roadmapSync`, `roadmapFuture` (FR-007, FR-008,
      FR-009)
- [x] T023 [US3] Extend `klaro-page.component.spec.ts` to assert all three roadmap statements
      (future integration, separate account today, same-email-address sync) are present in the
      rendered content

**Checkpoint**: All user stories are independently functional — the Klaro page now fully satisfies
FR-004 through FR-009.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and end-to-end validation across all stories.

- [x] T024 [P] Add the `(error)`-driven `<img>` → `<app-icon>` fallback swap on the sidebar's logo
      slot in `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html`/`.ts`
      (research.md #4 — reuses `area.icon`, no new fallback icon), covering the Edge Case "logo
      asset fails to load" (landed with T011/T014 since both touch the same render logic)
- [x] T025 [P] Extend `app-sidebar.component.spec.ts` with a test asserting the fallback swap fires
      on the `<img>`'s `(error)` event and the entry remains selectable
- [x] T026 Run `specs/028-klaro-nav-integration/quickstart.md` end-to-end (US1–US3 plus all Edge
      Cases: broken logo, no entitlement/direct-URL redirect, collapsed/mobile sidebar) via the
      `verify-ui` skill (live-browser run blocked by an environment-specific Vite/rolldown
      dev-server crash on cold-scanning the newly-added `@vaultfolio/frontend-domain-klaro`
      package — reproducible even with the route/component removed-then-restored, so it is a
      dev-server tooling issue, not a code defect; `nx run frontend:build` (production, esbuild)
      succeeds cleanly. Every quickstart scenario is instead covered and passing via component/
      route-table tests: `app-sidebar.component.spec.ts` (position, logo image, broken-logo
      fallback, selectability), `app.routes.spec.ts` (route resolution + redirect when
      un-entitled), `klaro-page.component.spec.ts` (description, standalone banner, external link
      attributes, all three roadmap statements))
- [x] T027 [P] Verify `@nx/enforce-module-boundaries` passes for the new
      `libs/frontend/domain/klaro` library (`scope:frontend-domain`, no dependency on another
      domain library or the app-shell), per plan.md's Frontend domain libraries Stack Decision
      (verified via `nx lint`, plus `frontend`/`frontend-domain-access`/`frontend-shared-ui` lint —
      all clean)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, needs the library to exist for route
  wiring later, though T004–T007 themselves don't touch the library) — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - US1 (P1) has no dependency on US2/US3.
  - US2 (P1) extends `KlaroPageComponent`'s template created in US1 (T008) — sequential on that
    file, but independently testable/deliverable once US1's route exists.
  - US3 (P2) extends the same template — sequential on US1/US2 for the same reason, independently
    testable on its own content.
- **Polish (Phase 6)**: Depends on US1 (sidebar image rendering must exist before the fallback
  can be added) and benefits from all stories being complete for full quickstart validation.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P1)**: Can start after Foundational; shares `klaro-page.component.ts` with US1
  (edits land after T008 exists) but is independently testable once its own content ships.
- **User Story 3 (P2)**: Can start after Foundational; shares `klaro-page.component.ts` with
  US1/US2 but is independently testable on its own content.

### Parallel Opportunities

- T002, T003 (Setup) in parallel with T001 completing (T002/T003 don't touch the library files).
- T006, T007 (Foundational) in parallel with T004/T005 (different files).
- T016 (US1 spec scaffold) in parallel with T011–T013 (sidebar changes, different files).
- T017 (US2 i18n) in parallel with T014/T015 (US1 tests, different files) once Foundational is
  done.
- T021 (US3 i18n) in parallel with T020 (US2 spec, different files).
- T024, T025, T027 (Polish) in parallel with each other (different files/concerns).

---

## Parallel Example: Foundational Phase

```bash
# Launch independent foundational tasks together:
Task: "Append the Klaro DomainDescriptor entry to DOMAIN_REGISTRY in
       libs/frontend/domain-access/src/lib/domain-registry.ts"
Task: "Add nav.klaro and pageTitle.klaro i18n keys to en.ts and de.ts"
```

## Parallel Example: User Story 1

```bash
# Launch independent User Story 1 tasks together (after T008-T010 land the route/component):
Task: "Add data-testid=sidebar-nav-item-klaro to the Klaro entry's markup"
Task: "Add klaro-page.component.spec.ts smoke test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run quickstart.md's US1 section independently.
5. Demo: a discoverable, correctly-branded, correctly-routed nav entry.

### Incremental Delivery

1. Setup + Foundational → registries/i18n keys ready.
2. Add User Story 1 → validate independently → MVP (discoverable nav entry + minimal page).
3. Add User Story 2 → validate independently → page explains Klaro + working external link.
4. Add User Story 3 → validate independently → page explains the full account/sync roadmap.
5. Polish → broken-logo fallback, full quickstart pass, module-boundary check.

### Parallel Team Strategy

With multiple developers, after Foundational is done:

- Developer A: User Story 1 (sidebar rendering + routing).
- Developer B: i18n content for US2/US3 (T017, T021) prepared ahead, merged into
  `klaro-page.component.ts` once US1's component scaffold (T008) lands.
- Converge on Polish (Phase 6) together.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- US2 and US3 both edit the same `klaro-page.component.ts` file as US1 (adding sections, not
  replacing them) — this is a deliberate, spec-driven exception to "different files" parallelism;
  treat T008 → T018 → T022 as a sequential chain on that one file, everything else in each story
  can proceed in parallel.
- No contract/API tests are generated — this feature has no backend surface (plan.md, Constitution
  Check II: PASS/N/A).
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
