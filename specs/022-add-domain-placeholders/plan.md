# Implementation Plan: Placeholder Domains for the Multi-Domain Pivot

**Branch**: `022-add-domain-placeholders` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-add-domain-placeholders/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Register five new domains — Retirement, Insurances, Haushaltsplaner, Historic Wealth Development,
and Account Overview — as entitlement-gated, navigable placeholders, reusing the domain-library
architecture from [020-domain-library-architecture](../020-domain-library-architecture/spec.md)
and the Dashboard/Settings extension points from
[021-frontend-extension-points](../021-frontend-extension-points/spec.md) exactly as-is. Each
domain is a new `scope:frontend-domain` Nx library exposing exactly one placeholder component; it
is wired into the app-shell by adding one entry to each of three existing, additive registries
(`DOMAIN_REGISTRY`, `APPLICATION_AREAS`, `app.routes.ts`'s route table) and one entry to the
backend's `KNOWN_DOMAIN_IDS` allow-list — no change to Dashboard, Settings, Holdings, or any other
domain's code. No backend routes, controllers, or persistence are introduced: a placeholder page
has no data of its own, so `RequiresDomain`/`DomainGuard` gating (already global backend
infrastructure) is not exercised by this feature — only the frontend `domainGuard` on each new
route, matching Holdings' pattern.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend, unchanged by this feature), Angular (frontend), Nx
(monorepo tooling) — per the constitution's Stack Decision. No new dependency is introduced; this
feature only adds Angular library projects following the existing `frontend-domain-holdings`
pattern.

**Storage**: SQLite, embedded in the backend (per constitution Stack Decision). This feature adds
no new tables/columns — `domainScopes: string[]` on the existing `User` record already stores
arbitrary domain ids; only the backend's in-memory `KNOWN_DOMAIN_IDS` allow-list (validation, not
storage) gains five entries.

**Testing**: Jest (Nx default) for unit tests of each new placeholder component and the updated
registries; existing Playwright/e2e or component specs for Holdings, Dashboard, and Settings serve
as the regression check for FR-006/SC-004 (no change to their behavior).

**Target Platform**: Linux server (backend container), modern evergreen browsers (Angular
frontend) — unchanged.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below).

**Performance Goals**: N/A — a placeholder page has no data fetching or computation; no new
performance-sensitive path is introduced.

**Constraints**: None beyond FR-006 (zero regression to existing Holdings/Dashboard/Settings
behavior) and FR-007 (adding a domain's real functionality later must stay additive — no
app-shell/Dashboard/Settings/other-domain change).

**Scale/Scope**: 5 new frontend domain libraries, each with exactly one component; 4 small,
additive edits to existing shared registries/route tables (2 frontend registries, 1 route table, 1
backend allow-list).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS. Each new domain is its own standalone Angular library
  (`scope:frontend-domain`), matching `frontend-domain-holdings`'s precedent; a placeholder has no
  business logic to isolate further, so no companion `scope:domain` library is needed for any of
  the five (none of them touch money/financial calculations at this stage — Assumptions).
- **II. API-First Interface**: PASS (N/A). No backend capability is added; the frontend adds no
  new API calls. `domainScopes` already flows through the existing `SessionUser`/`AccountSummary`
  contracts (020) — this feature only adds recognized values to that existing `string[]`.
- **III. Test Coverage**: PASS. No money/decimal/date logic is introduced, so the exact-value
  testing mandate does not apply; each placeholder component and the registry/route additions
  still get ordinary unit tests per the workspace's normal (implement-then-test) practice.
- **IV. Integration Testing**: PASS. No new library public contract, service boundary, or shared
  schema is introduced — `DashboardWidgetContribution`/`SettingsTabContribution`/`DomainDescriptor`
  contracts from 020/021 are consumed unchanged, with zero new entries in the widget/tab
  registries (FR-005). The existing Holdings/Dashboard/Settings integration tests are the
  regression signal for FR-006.
- **V. Observability, Versioning & Simplicity**: PASS. A placeholder page needs no logging beyond
  what routing/guards already emit. Simplicity is central to this feature's design: it deliberately
  adds nothing beyond one library + one component per domain plus four additive registry entries —
  no new abstraction is introduced.

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/022-add-domain-placeholders/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
└── frontend/
    └── src/app/
        ├── app.routes.ts                       # +1 route block per new domain (domainGuard-gated)
        ├── core/layout/application-areas.ts     # +1 APPLICATION_AREAS entry per new domain
        ├── dashboard/dashboard-widgets.registry.ts  # unchanged — no new domain contributes here
        └── settings/settings-tabs.registry.ts       # unchanged — no new domain contributes here

apps/
└── backend/
    └── src/accounts/accounts.service.ts        # KNOWN_DOMAIN_IDS gains the 5 new domain ids

libs/frontend/domain-access/
└── src/lib/domain-registry.ts                  # DOMAIN_REGISTRY gains 5 new DomainDescriptor entries

libs/frontend/domain/
├── retirement/                # NEW — @vaultfolio/frontend-domain-retirement
│   └── src/lib/retirement-placeholder/retirement-placeholder.component.ts
├── insurances/                # NEW — @vaultfolio/frontend-domain-insurances
│   └── src/lib/insurances-placeholder/insurances-placeholder.component.ts
├── haushaltsplaner/           # NEW — @vaultfolio/frontend-domain-haushaltsplaner
│   └── src/lib/haushaltsplaner-placeholder/haushaltsplaner-placeholder.component.ts
├── historic-wealth-development/  # NEW — @vaultfolio/frontend-domain-historic-wealth-development
│   └── src/lib/historic-wealth-development-placeholder/historic-wealth-development-placeholder.component.ts
└── account-overview/          # NEW — @vaultfolio/frontend-domain-account-overview
    └── src/lib/account-overview-placeholder/account-overview-placeholder.component.ts

libs/frontend/shared-ui/src/lib/i18n/translations/
├── en.ts                      # +nav.* and +<domain>Placeholder.* keys, 5 domains
└── de.ts                      # same keys, German copy
```

Each new library follows `libs/frontend/domain/holdings`'s existing shape exactly (own
`project.json`/`package.json` tagged `scope:frontend-domain`, own `tsconfig*.json`, `src/index.ts`
public entry point) so the existing `scope:frontend-domain → scope:shared` ESLint boundary rule
applies unchanged and needs no new rule.

**Structure Decision**: Five new `scope:frontend-domain` Nx libraries under `libs/frontend/domain/`
(one per new domain), each exporting exactly one placeholder component through its `src/index.ts`
public API — mirroring `libs/frontend/domain/holdings`'s existing structure. No new
`scope:domain` (backend/framework-independent business-logic) library is introduced for any of the
five, since none of them has any logic yet (Assumptions). No backend module/controller is added.
Wiring is four small, additive edits to existing shared files: `DOMAIN_REGISTRY`
(`libs/frontend/domain-access`), `APPLICATION_AREAS` (`apps/frontend`), the `app.routes.ts` route
table (`apps/frontend`), and `KNOWN_DOMAIN_IDS` (`apps/backend`) — exactly the touch points 020's
own contract (`contracts/domain-access.md`) documents as "adding a domain."

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
