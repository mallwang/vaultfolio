# Implementation Plan: Frontend Shell Extension Points

**Branch**: `021-frontend-extension-points` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-frontend-extension-points/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Close the four gaps 020 deliberately left open: give the Dashboard and Settings areas a per-domain
extension mechanism (a domain library optionally contributes one dashboard widget and/or one
settings tab, filtered by the same `isDomainEntitled`/`domainGuard` mechanism 020 already built),
retrofit the existing holdings distribution widget onto that mechanism as proof, fold the standalone
"Imports" navigation entry/route into Holdings as an internal tab, and extract Admin/"Verwaltung"
into its own `scope:frontend-admin` Nx library so it can never be mistaken for a product domain. The
new extension points live as plain registry arrays in `apps/frontend` (not inside the `scope:shared`
`domain-access` library), so `domain-access` still never depends on any individual domain library
(FR-007) — the same asymmetry `app.routes.ts` already relies on today for the Holdings route.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. This feature adds no new external dependency; it restructures
existing frontend code and adds one new frontend library (`libs/frontend/admin`).

**Storage**: SQLite, embedded in the backend process (constitution Stack Decision). Unchanged — no
schema change; this feature reuses the `domain_scopes` column and `role` column 020 already added,
with no backend contract change at all.

**Testing**: Jest (backend, Nx default) / Vitest (frontend, per `nx.json`'s
`unitTestRunner: vitest-angular`); existing Holdings/Admin/Settings/Dashboard unit and component
tests move with their code (Principle IV) — no contract change to any of them beyond the new
optional extension-point filtering, so no new integration test is required beyond confirming moved
tests still pass and the new `@nx/enforce-module-boundaries` rule for `scope:frontend-admin` fails
as expected on a deliberate violation.

**Target Platform**: Linux server (backend container), modern evergreen browsers (Angular frontend)
— unchanged.

**Project Type**: web-service + frontend, Nx monorepo. Purely a frontend restructuring +
extension-point addition; no new app is introduced.

**Performance Goals**: Not applicable — no performance-sensitive code path is touched; widget/tab
rendering reuses the existing dynamic-`import()`/`@defer` code-splitting pattern already proven on
the Dashboard today (research.md #3), so no new bundle-size regression is expected.

**Constraints**: Single deployable frontend bundle (FR-010 of 020, still binding) — the extension
mechanism MUST NOT introduce lazy-loaded remote bundles or per-domain build/deploy artifacts;
contributions are ordinary dynamic `import()`s within the one frontend bundle, per research.md #3.

**Scale/Scope**: One domain today (holdings, retrofitted onto the dashboard-widget half of the
mechanism only, per Assumptions); the mechanism must generalize to ~5 more domains planned in future
specs without per-domain config growth beyond one registry-array entry per shell area (SC-001).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: Satisfied — Admin becomes its own standalone library
  (`libs/frontend/admin`), independently testable and structurally distinct from both the app-shell
  and any product-domain library (FR-012). The two new contribution types
  (`DashboardWidgetContribution`, `SettingsTabContribution`) extend the existing `domain-access`
  library's coherent single purpose (entitlement-gated shell composition) rather than creating a new
  "organizational-only" library.
- **II. API-First Interface**: Satisfied — no backend contract changes at all in this feature; every
  mechanism reuses 020's existing `SessionUser.domainScopes`/`role` fields and `isDomainEntitled`
  logic unchanged.
- **III. Test Coverage**: Satisfied — no monetary/calculation logic is touched. The only new logic
  (entitlement filtering of two more lists, a generic dynamic-component host) is boolean/structural,
  not monetary, and gets ordinary unit/component-test coverage.
- **IV. Integration Testing**: Applicable to `libs/frontend/admin`'s newly-established public
  contract (its routed components) and to the new `HoldingsAreaComponent` tab container — covered by
  the existing Playwright/component tests moving with Admin's and Holdings' code, plus new
  component tests for the tab-switching/redirect behavior itself (mirroring the existing
  `settings.component.spec.ts`/`admin.component.ts` pattern, once such a spec exists — see
  tasks.md).
- **V. Observability, Versioning & Simplicity**: Satisfied — the design deliberately rejects an
  Angular DI multi-provider mechanism and a per-contribution `order` field as premature (research.md
  #1, #7), reusing the exact `DOMAIN_REGISTRY`/`APPLICATION_AREAS` plain-array convention already
  established by 020 rather than introducing a second registration mechanism. The new
  `scope:frontend-admin` tag is one bounded addition to an existing, already-understood
  `depConstraints` list, not a new boundary system.

**Result**: PASS — no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-frontend-extension-points/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── dashboard-settings-extension-points.md
│   ├── module-boundaries.md   # delta on 020's contract
│   └── routes.md              # delta on 009's contract
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
└── frontend/
    └── src/app/
        ├── app.routes.ts                 # Holdings route restructured (tabs), Settings children
        │                                 # gain contributed tabs, Admin route imports the new
        │                                 # library, legacy /imports redirects updated
        ├── core/layout/
        │   └── application-areas.ts       # 'imports' entry removed
        ├── dashboard/
        │   ├── dashboard.component.ts     # renders DASHBOARD_WIDGET_CONTRIBUTIONS via
        │   │                               # DynamicOutletComponent instead of a hard-coded import
        │   └── dashboard-widgets.registry.ts   # NEW — one entry: holdings' distribution widget
        ├── settings/
        │   ├── settings.component.ts      # tab list gains filtered SETTINGS_TAB_CONTRIBUTIONS
        │   └── settings-tabs.registry.ts  # NEW — empty for this spec (mechanism only)
        └── admin/                         # REMOVED — moved to libs/frontend/admin

libs/
├── frontend/
│   ├── admin/                             # NEW — moved from apps/frontend/src/app/admin/*
│   │   ├── src/lib/                       # AdminComponent, Accounts/Sign-ups/Invitations/General
│   │   ├── src/index.ts                   # public entry
│   │   └── package.json                   # tag: scope:frontend-admin (NEW tag)
│   ├── domain-access/
│   │   └── src/lib/
│   │       ├── dashboard-widget-contribution.ts   # NEW — type only
│   │       └── settings-tab-contribution.ts       # NEW — type only
│   ├── domain/
│   │   └── holdings/
│   │       └── src/lib/
│   │           ├── holdings-area/                 # NEW — HoldingsAreaComponent (tabs container)
│   │           └── imports/                       # NEW — ImportsComponent, moved from apps/frontend
│   └── shared-ui/
│       └── src/lib/
│           └── dynamic-outlet/            # NEW — DynamicOutletComponent (generic loader → NgComponentOutlet)
├── domain/                                # EXISTING backend finance-logic libs — untouched
├── api-contract/                          # untouched — no contract change
├── market-data/
└── notifications/
```

**Structure Decision**: No new Nx `libs/frontend/*`-tree glob is needed — `libs/frontend/admin` sits
at the same level as the existing `libs/frontend/domain-access`/`libs/frontend/shared-ui`, already
covered by the root `package.json`'s `libs/frontend/*` workspace glob (020). The two extension-point
types are additive exports on the existing `domain-access` library (`scope:shared`, unchanged tag);
the registries that reference actual domain components live in `apps/frontend` (`scope:frontend`),
which already has the module-boundary permission to import `scope:frontend-domain` libraries — this
is what keeps `domain-access` itself domain-agnostic (FR-007, research.md #1). `HoldingsAreaComponent`
and the relocated `ImportsComponent` are added to the existing `libs/frontend/domain/holdings`
library (no new library — Imports has no independent identity outside Holdings, per the spec).
`DynamicOutletComponent` is added to the existing `libs/frontend/shared-ui` library (no new library
— it is a generic presentation primitive, the same category `IconComponent`/`EchartComponent`
already occupy there). `libs/frontend/admin` is the one genuinely new library this feature
introduces, carrying the new `scope:frontend-admin` tag documented in
[contracts/module-boundaries.md](contracts/module-boundaries.md). `apps/frontend` and `apps/backend`
keep their existing tags and remain the only two deployable projects — no new build/deploy target is
introduced (020's FR-010, still binding).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
