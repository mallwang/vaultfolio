# Tasks: Notification Center

**Input**: Design documents from `/specs/043-notification-center/`

**Tech stack**: TypeScript, Angular ~22.1, PrimeNG ^22.1, Nx monorepo, Jest (new lib), Vitest (Angular)

**Scope**: Frontend-only. New `libs/frontend/hints` (scope:shared) + app-shell `core/hints` + provider code in two domain libs. No backend change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the new shared library and cross-cutting additions.

- [x] T001 Create `libs/frontend/hints` library scaffold: `package.json` (`@vaultfolio/frontend-hints`, scope:shared), `tsconfig.json`, `tsconfig.spec.json`, `jest.config.cts`, `.spec.swcrc` — mirror `@vaultfolio/frontend-domain-access` config
- [x] T002 [P] Add `notifications: 'notifications'` entry to `ICON_NAME_MAP` in `libs/frontend/shared-ui/src/lib/icon/icon-name.map.ts`

---

## Phase 2: Foundational (Pure Library — Blocking All User Stories)

**Purpose**: All pure logic and types in `@vaultfolio/frontend-hints`. No Angular dependency. Must be complete before any app-shell or provider work.

**⚠️ CRITICAL**: US1, US2 and US3 all import from this library; nothing else can start until T009 is done.

- [x] T003 Create core hint types in `libs/frontend/hints/src/lib/hint.ts` (`Hint`, `HintSeverity`, `HintTarget`)
- [x] T004 [P] Create registry types in `libs/frontend/hints/src/lib/hint-provider.ts` (`HintProvider`, `HintProviderContribution`)
- [x] T005 Implement `hintSignature(hint)` using cyrb53 hash over sorted canonical JSON of `{ titleKey, descriptionKey, severity, params }` in `libs/frontend/hints/src/lib/hint-signature.ts`
- [x] T006 Implement hidden-state transitions (`isHidden`, `hide`, `restore`, `purgeStale`, `parseHiddenState`, `serializeHiddenState`) in `libs/frontend/hints/src/lib/hidden-state.ts`
- [x] T007 Implement `viewOf(hints, state)` returning `{ active, hidden, badge }` and grouping helpers in `libs/frontend/hints/src/lib/hint-view.ts`
- [x] T008 [P] Implement `hintTestId(id)` (lowercase, replace non-`[a-z0-9]` runs with `-`) in `libs/frontend/hints/src/lib/hint-test-id.ts`
- [x] T009 Export all public API from `libs/frontend/hints/src/index.ts`
- [x] T010 [P] Jest tests for `hintSignature` (stable across evaluations, language-independent, changes with params change) in `libs/frontend/hints/src/lib/hint-signature.spec.ts`
- [x] T011 [P] Jest tests for hidden-state: `isHidden`, `hide`, `restore`, `purgeStale`, parse/serialize round-trip, version-mismatch empty, storage-failure in `libs/frontend/hints/src/lib/hidden-state.spec.ts`
- [x] T012 [P] Jest tests for `viewOf`: active/hidden partition, badge count, `9+` cap, dot when count=0 and hidden>0, group order (warnings before info) in `libs/frontend/hints/src/lib/hint-view.spec.ts`

**Checkpoint**: `npx nx test @vaultfolio/frontend-hints` passes — library is ready.

---

## Phase 3: User Story 1 — Member sees open hints at a glance (Priority: P1) 🎯 MVP

**Goal**: Bell with count badge in the header; panel listing all active hints grouped by source, ordered warnings-first; link navigates and closes the panel; empty state when no hints.

**Independent Test**: Sign in with at least two providers contributing hints → badge shows total count → open panel → hints grouped by source, warnings first → follow a link → correct page, panel closed.

### Implementation for User Story 1

- [x] T013 [US1] Create empty `HINT_PROVIDER_CONTRIBUTIONS: HintProviderContribution[]` registry in `apps/frontend/src/app/core/hints/hint-providers.registry.ts`
- [x] T014 [P] [US1] Create `HintsStorage` (best-effort `localStorage` read/write, try/catch, per-user key `vaultfolio.hints-hidden.<userId>`) in `apps/frontend/src/app/core/hints/hints-storage.ts`
- [x] T015 [US1] Create `HintsStore` with provider lifecycle (`load()` on sign-in, `refresh()` on `NavigationEnd` throttled to 60 s and on panel open) in `apps/frontend/src/app/core/hints/hints.store.ts`
- [x] T016 [US1] Create `HintsBellComponent` (bell icon, count badge, opens panel on click, `data-testid="hints-bell"` and `data-testid="hints-badge"`) in `apps/frontend/src/app/core/hints/hints-bell/`
- [x] T017 [US1] Create `HintsPanelComponent` (active hint list, groups from `viewOf`, hint rows with title/description/severity icon/link, empty state) in `apps/frontend/src/app/core/hints/hints-panel/`
- [x] T018 [US1] Wire `HintsBellComponent` into `apps/frontend/src/app/core/layout/app-header/` before the language selector (visible only when signed in)
- [x] T019 [P] [US1] Add `hints.*` base i18n keys (panel title, empty state, link defaults, aria labels) in both `en` and `de` translation files under `libs/frontend/shared-ui/src/lib/i18n/translations/`

**Checkpoint**: Badge visible in header with mock provider; panel opens, lists hints, link navigates and closes panel.

---

## Phase 4: User Story 2 — Member hides and restores hints (Priority: P1)

**Goal**: Hide button on each active hint; "Hidden" collapsible section; badge excludes hidden; state survives reload; hint reactivates when content hash changes; per-user storage.

**Independent Test**: Hide one of two hints → badge drops by one → hint under "Ausgeblendet (1)" → reload → still hidden → restore → badge back up → hide all → gray dot, no number.

### Implementation for User Story 2

- [x] T020 [US2] Add `hide(hintId)` / `restore(hintId)` actions and per-user `localStorage` persistence (read on init, write on change) to `HintsStore` in `apps/frontend/src/app/core/hints/hints.store.ts`
- [x] T021 [US2] Add hidden section (`hints-hidden-toggle`, hidden count header, restore buttons per row with `data-testid="hints-restore-<safe-id>"`) to `HintsPanelComponent` in `apps/frontend/src/app/core/hints/hints-panel/`
- [x] T022 [US2] Implement dot state (`badge.dot`) in `HintsBellComponent`: show gray dot (no number) when all hints hidden in `apps/frontend/src/app/core/hints/hints-bell/`
- [x] T023 [P] [US2] Vitest tests for `HintsStore`: hide persists to storage, restore removes from hidden, reactivation on signature change, different user sees different state in `apps/frontend/src/app/core/hints/hints.store.spec.ts`

**Checkpoint**: Full hide/restore cycle works including reload persistence and reactivation.

---

## Phase 5: User Story 3 — Features provide hints through a shared contract (Priority: P2)

**Goal**: Two real providers (Insurances, Earnings) wired via the registry; entitlement + maintenance gating; failure isolation.

**Independent Test**: Register InsurancesHintProvider and EarningsHintProvider → hints appear with correct source → put Insurances in maintenance → its hints disappear → simulate failing Earnings → Insurances hints remain.

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement `InsurancesHintProvider` wrapping `InsurancesStore` (`ensureLoaded()`, `gaps().redundant`, one hint per `RedundantItem`, id `insurances.redundant.<contractId>.<otherId>`) in `libs/frontend/domain/insurances/src/lib/hints/insurances-hint-provider.ts`; export from `libs/frontend/domain/insurances/src/index.ts`
- [x] T025 [P] [US3] Implement `EarningsHintProvider` calling `EarningsService.dataCheck()`, one hint per row with difference or `completeness.status === 'MISSING'`, id `earnings.data-check.<employerId>.<year>` in `libs/frontend/domain/earnings/src/lib/hints/earnings-hint-provider.ts`; export from `libs/frontend/domain/earnings/src/index.ts`
- [x] T026 [US3] Register both providers in `apps/frontend/src/app/core/hints/hint-providers.registry.ts` (lazy `loadProvider` imports, `domainId` set for both)
- [x] T027 [US3] Add entitlement + maintenance filtering (skip load when not entitled or in maintenance) and per-provider failure isolation guard (`try/catch` around `hints()`) in `HintsStore` in `apps/frontend/src/app/core/hints/hints.store.ts`
- [x] T028 [P] [US3] Add provider i18n keys (`hints.groups.insurances`, `hints.groups.earnings`, title/description/linkLabel keys per hint type) in `en` and `de` translation files under `libs/frontend/shared-ui/src/lib/i18n/translations/`

**Checkpoint**: Both real providers contribute hints; maintenance flag hides one provider's hints without affecting the other; failing provider leaves shell intact.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, mobile layout, test-id completeness, final validation.

- [x] T029 [P] Add `data-testid` attributes per `docs/frontend/testid-conventions.md` to all interactive and translated elements: `hints-bell`, `hints-badge`, `hints-panel`, `hints-hidden-toggle`, and per-row `hints-row-<safe-id>`, `hints-hide-<safe-id>`, `hints-restore-<safe-id>`, `hints-link-<safe-id>` (use `hintTestId(id)`)
- [x] T030 [P] Add mobile layout: `HintsPanelComponent` hosted in `p-dialog` (with `dismissableMask`, close button) at ≤768 px via `matchMedia` signal; desktop keeps `p-popover` in `apps/frontend/src/app/core/hints/hints-panel/`
- [x] T031 [P] Add keyboard accessibility and ARIA live region for badge count in `HintsBellComponent` (button role, `aria-label` with count, `aria-live="polite"` on badge update)
- [x] T032 Run `npx nx lint frontend @vaultfolio/frontend-hints @vaultfolio/frontend-domain-insurances @vaultfolio/frontend-domain-earnings` and `npx nx build frontend` — resolve all errors
- [x] T033 Playwright verification via `verify-ui` skill: all four quickstart.md scenarios (badge + list, hide + restore, gating + isolation, mobile)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — can start after T009 (index.ts exported)
- **US2 (Phase 4)**: Depends on Phase 3 — needs HintsStore and HintsPanelComponent shells
- **US3 (Phase 5)**: Depends on Phase 3 — needs registry and HintsStore filtering hooks; T024/T025 can start parallel to Phase 4
- **Polish (Phase 6)**: Depends on US1, US2, and US3

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **US2 (P1)**: Extends US1 HintsStore and HintsPanelComponent — sequential after US1
- **US3 (P2)**: Requires US1 registry and store filtering stubs — T024/T025 can run in parallel with US2; T026/T027 after US1

### Within Each Phase

- T003/T004 before T005–T008 (types first)
- T005–T008 before T009 (index.ts last)
- T009 before any app-shell or domain work
- T013/T014 before T015 (store needs registry and storage)
- T015 before T016/T017 (components need store)
- T016/T017 before T018 (header needs bell)
- T020 (store) before T021/T022 (components need hide/restore signals)
- T024/T025 before T026 (registry needs provider classes)
- T026/T027 before T028 (i18n keys can be added in parallel but providers must exist to know the key names)

### Parallel Opportunities Within Phases

```bash
# Phase 2 — after T003/T004:
T005  T006  T007  T008   # run in parallel (different files)
T010  T011  T012          # run in parallel (different spec files)

# Phase 3 — after T015:
T016  T017  T019           # run in parallel

# Phase 5 — after Phase 3:
T024  T025  T028           # run in parallel

# Phase 6 — after US1/US2/US3:
T029  T030  T031  T032     # run in parallel
```

---

## Implementation Strategy

### MVP First (US1 + US2 — all P1 stories)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational library (CRITICAL — blocks everything)
3. Complete Phase 3: US1 (badge + list with mock/empty registry)
4. Complete Phase 4: US2 (hide/restore with localStorage)
5. **STOP and VALIDATE**: Badge, list, hide, restore work end-to-end
6. Complete Phase 5: US3 (real providers, gating, isolation)
7. Complete Phase 6: Polish, lint, build, Playwright

### Why US2 before US3

Both US1 and US2 are P1. US3 is P2 but unlocks the real test data. Completing US1+US2 first keeps the store and panel stable before adding provider complexity.

### Incremental Delivery

1. Phase 1 + 2 → library shipped and tested in isolation
2. Phase 3 → bell visible in header; demo with synthetic provider
3. Phase 4 → hide/restore usable; feature is already useful without real data
4. Phase 5 → real Insurances and Earnings hints appear
5. Phase 6 → production-ready (a11y, mobile, testids, lint clean)
