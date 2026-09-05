# Implementation Plan: Domain Library Architecture

**Branch**: `020-domain-library-architecture` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-domain-library-architecture/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Give the Nx workspace an enforced (not just conventional) boundary between product domains, and
move today's single holdings feature behind it as the first domain, so that as five more domains
are added later none of them can silently import another's internals. Two `depConstraints`
additions to the existing `@nx/enforce-module-boundaries` config make cross-domain imports a lint
failure in the same CI step that already enforces `scope:*` today; a new `scope:shared` library
(`domain-access`) provides the one place ("is this user entitled to this domain") both the route
guard and the sidebar nav filter consult, extending the existing `role`-based admin gate pattern
rather than replacing it. Holdings' existing components/routes/service move into a new
`scope:frontend-domain` library unchanged in behavior; the app-shell keeps composing routes, now
against that library's public entry point instead of inline files.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. This feature adds no new external dependency; it is a restructuring
of existing frontend code plus one small additive column on an existing table.

**Storage**: SQLite, embedded in the backend process (constitution Stack Decision). This feature
adds one nullable `TEXT` column (`domain_scopes`, JSON-encoded array) to the existing `users` table,
added directly to the single init script in `database.service.ts` (no incremental migration file,
per the workspace's collapsed-init-script convention, commit 462794d).

**Testing**: Jest (backend, Nx default) / Vitest (frontend, per `nx.json`'s
`unitTestRunner: vitest-angular`); existing holdings unit/component tests move with their code
(Principle IV — no contract change to holdings itself, so no new integration test is required
beyond confirming the moved tests still pass and a boundary-violation lint check fails as expected).

**Target Platform**: Linux server (backend container), modern evergreen browsers (Angular frontend)
— unchanged.

**Project Type**: web-service + frontend, Nx monorepo. This feature is purely a workspace
restructuring + access-control addition; no new app is introduced.

**Performance Goals**: Not applicable — no performance-sensitive code path is touched; this is a
structural/access-control change with no new runtime computation beyond a constant-time array/role
check per navigation event.

**Constraints**: Single deployable frontend bundle (FR-010) — the new library boundary MUST NOT
introduce lazy-loaded remote bundles or per-domain build/deploy artifacts (ruling out Module
Federation, consistent with the decision this spec builds on).

**Scale/Scope**: One domain today (holdings, retrofitted); the boundary/entitlement mechanism must
generalize to ~5 more domains planned in future specs (FR-011) without per-domain config growth
beyond one registry entry and one route.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: Satisfied — holdings' feature code becomes its own standalone library
  (`libs/frontend/domain/holdings`) with a well-defined public entry point, independently testable.
  The new `domain-access` library is a coherent, single-purpose library (entitlement decisions), not
  an "organizational-only" grab-bag — passes the anti-pattern check explicitly called out by this
  principle.
- **II. API-First Interface**: Satisfied — the only backend contract change is additive
  (`SessionUser.domainScopes`, `AccountSummary.domainScopes`, one new `PATCH
/accounts/:id/domain-scopes` route under the existing `@Roles('ADMIN')`-guarded controller); no
  bypass of the API layer is introduced.
- **III. Test Coverage**: Satisfied — no monetary/calculation logic is touched by this feature;
  holdings' existing exact-value tests move unchanged. New entitlement logic (`isDomainEntitled`) is
  boolean, not monetary, and gets ordinary unit-test coverage.
- **IV. Integration Testing**: Applicable to the new `PATCH /accounts/:id/domain-scopes` contract —
  requires an integration test exercising the real request/response shape (per Principle IV), and to
  the moved holdings library's continued route-level behavior (covered by existing Playwright/
  component tests moving with it).
- **V. Observability, Versioning & Simplicity**: Satisfied — no new abstraction beyond what FR-004/
  SC-003 explicitly require (one registry, one entitlement function, one guard factory); the design
  deliberately rejects per-domain `depConstraints` rules and a dedicated entitlements admin page as
  premature (see research.md #2, #6). Both new libraries follow the workspace's existing
  MAJOR.MINOR.BUILD-versioned, `package.json`-scoped-export convention already used by
  `libs/domain/*`/`libs/api-contract`.

**Result**: PASS — no violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/020-domain-library-architecture/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── module-boundaries.md
│   └── domain-access.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── auth/                    # AuthService: SessionUser now includes domainScopes
│       ├── accounts/                # NEW: PATCH :id/domain-scopes alongside existing :id/role
│       └── database/database.service.ts  # NEW: domain_scopes column on users table
└── frontend/
    └── src/app/
        ├── app.routes.ts            # holdings route now imports the library's public entry
        │                            # point + uses domainGuard('holdings')
        ├── core/layout/
        │   ├── application-areas.ts     # ApplicationArea gains optional domainId
        │   └── app-sidebar/              # nav filter also calls isDomainEntitled
        └── admin/accounts/           # UI for granting/revoking a domain scope (research.md #6)

libs/
├── frontend/
│   ├── domain/
│   │   └── holdings/                # NEW — moved from apps/frontend/src/app/holdings/*
│   │       ├── src/
│   │       │   ├── lib/             # components, holdings.service.ts (unchanged behavior)
│   │       │   └── index.ts         # public entry (route provider / entry component)
│   │       └── package.json         # "exports": only "." + "./package.json" (tag: scope:frontend-domain)
│   └── domain-access/               # NEW — DOMAIN_REGISTRY, isDomainEntitled, domainGuard
│       ├── src/
│       │   ├── lib/
│       │   └── index.ts
│       └── package.json             # tag: scope:shared
├── domain/                          # EXISTING backend finance-logic libs — untouched, unrelated
│   ├── holdings/                    # (backend valuation logic — different from libs/frontend/domain/holdings)
│   ├── auth/
│   ├── invitations/
│   └── example/
├── api-contract/                    # SessionUser + AccountSummary gain domainScopes (additive)
├── market-data/
└── notifications/
```

**Structure Decision**: Holdings' existing feature code
(`apps/frontend/src/app/holdings/**`) is extracted into a new library,
`libs/frontend/domain/holdings` (`@vaultfolio/frontend-domain-holdings`, tag
`scope:frontend-domain`), placed in a new `libs/frontend/` tree rather than inside the existing
`libs/domain/` tree — the latter already means "backend finance logic" per the constitution's Stack
Decision and must stay framework-free and backend-reachable only (research.md #1). A second new
library, `libs/frontend/domain-access` (`@vaultfolio/frontend-domain-access`, tag `scope:shared`),
holds the one entitlement mechanism FR-004/SC-003 require. Both are added to the root `package.json`
`workspaces` globs (`libs/frontend/*`, `libs/frontend/domain/*`). No existing library changes tag;
`eslint.config.mjs` gains the two `depConstraints` entries documented in
[contracts/module-boundaries.md](contracts/module-boundaries.md). `apps/frontend` and `apps/backend`
keep their existing tags and continue to be the only two deployable projects (FR-010 — no new
build/deploy target is introduced).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
