# Implementation Plan: Account Overview

**Branch**: `025-account-overview` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/025-account-overview/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A static reference directory of the user's accounts (banks, neobrokers, depots, credit cards) —
list, add, edit, delete, with optional category grouping (General/Leisure/Savings/Credit
Card/Other). No balances, no totals, no bank/brokerage API integration (FR-012, constitution's
Product Scope). Replaces the existing `AccountOverviewPlaceholderComponent`
(022-add-domain-placeholders) with a real page in the already-registered
`libs/frontend/domain/account-overview` library, backed by a new `accounts` table and a new
`AccountsOverviewModule` in the backend, following the same layered
controller/service/repository/domain-lib pattern already used by `holdings`
(003-manual-holdings-entry).

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. No new dependencies: this feature needs no decimal math, no
external API client, and no charting — just structured text fields, so it stays within the
existing PrimeNG (styled per `libs/frontend/shared-ui`) + Material Icons stack. PrimeNG `Dialog`
(add/edit modal), `Select` (category), `ConfirmDialog` (delete confirmation, FR-005) are used —
all already dependencies of `apps/frontend`.

**Storage**: SQLite (`better-sqlite3`), single new `accounts` table, accessed only through the
backend (Principle II) — same `DatabaseService.query()` raw-SQL pattern as `holdings`, no ORM
(Principle V/YAGNI).

**Testing**: Jest (Nx default for both NestJS and Angular projects); contract/integration tests per
Principle IV — domain-lib unit tests (validation), repository/controller unit tests, and an
e2e-spec against a real SQLite file, mirroring `holdings-persistence.e2e-spec.ts`.

**Target Platform**: Linux server (backend + SQLite-backed container), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No specific target beyond normal interactive-UI responsiveness (SC-002: add
an account in under a minute) — this is a low-volume reference list (tens of rows per user), not a
high-throughput data path; no pagination/virtualization is needed at this scale.

**Constraints**: No monetary values are stored or computed (FR-012) — every field is `TEXT`, so the
constitution's Money/decimal-handling clause does not apply here; no external HTTP calls
(constitution's Out of Scope: no banking/brokerage API integration).

**Scale/Scope**: Single new domain entity (`Account`), 1 backend module (~5 REST endpoints), 1
frontend domain library replacing its existing placeholder component, no new Nx libraries beyond
what already exists as a placeholder.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: The domain concept here (an account's shape + validation: name required,
  everything else optional free text) is thin enough that it lives as a standalone domain library
  `libs/domain/accounts` (backend) mirroring `libs/domain/holdings` — validation logic
  (`account-validation.ts`) is framework-independent and unit-tested in isolation, same pattern as
  `holding-validation.ts`. PASS.
- **II. API-First Interface**: New `AccountsOverviewController` exposes
  `GET/POST/PUT/DELETE /account-overview/accounts`; contract types live in
  `libs/api-contract/src/lib/account-overview.ts` (a new file — the existing `accounts.ts` in that
  library is feature 006's admin _user_-accounts contract, an unrelated entity that happens to
  share the English word "account"; naming this file `account-overview.ts` and its types
  `AccountOverviewEntry`/`Create/UpdateAccountOverviewEntryRequest` avoids any collision or
  ambiguity with `AccountSummary`). Structured error bodies (`VALIDATION_FAILED`,
  `ACCOUNT_NOT_FOUND`), consistent with `holdings`. PASS.
- **III. Test Coverage**: No monetary/date-of-record math exists here (FR-012), so the exact-value
  assertion mandate does not apply; ordinary implement-then-test coverage applies to validation
  (required name) and CRUD behavior. PASS.
- **IV. Integration Testing**: One e2e-spec exercises the real HTTP surface end-to-end against a
  temp SQLite file (create → appears in list → edit → delete), mirroring
  `holdings-persistence.e2e-spec.ts`; controller/repository unit tests cover the JSON
  request/response contract. PASS.
- **V. Observability, Versioning & Simplicity**: Plain structured logging via Nest's existing
  logger conventions (no new logging infrastructure); no new abstractions — a single
  controller/service/repository triad, YAGNI-compliant (no generic "notes" engine, no dynamic
  field schema — the small set of named detail fields from spec.md's Assumptions is hardcoded
  columns, matching `holdings`' per-asset-type column approach). PASS.
- **Product Scope / Stack Decision**: Account Overview is one of the constitution's
  already-registered planned domains (022-add-domain-placeholders); this feature builds its real
  page inside the existing `libs/frontend/domain/account-overview` library
  (`scope:frontend-domain`), replacing only its placeholder component — no new frontend-domain
  library is created, and it introduces no dependency on another domain library or the app-shell,
  consistent with the module-boundary rules. It does not integrate with any bank/brokerage API
  (FR-012, Out of Scope). PASS.

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/025-account-overview/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
├── design.md            # UX mockup review (already produced by /speckit-ux-review)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── account-overview/            # NEW — mirrors src/holdings/
│       │   ├── account-overview.module.ts
│       │   ├── account-overview.controller.ts
│       │   ├── account-overview.controller.spec.ts
│       │   ├── account-overview.service.ts
│       │   ├── account-overview.repository.ts
│       │   ├── account-overview.repository.spec.ts
│       │   └── account-overview.mapper.ts
│       ├── database/
│       │   └── database.service.ts      # MODIFIED — add `accounts` table to initializeSchema()
│       ├── app/
│       │   └── app.module.ts            # MODIFIED — register AccountOverviewModule
│       └── tests/
│           └── account-overview.e2e-spec.ts   # NEW
└── frontend/
    └── src/app/app.routes.ts            # MODIFIED — route to the new page component instead
                                          # of AccountOverviewPlaceholderComponent

libs/
├── domain/
│   └── accounts/                        # NEW — standalone Nx lib, mirrors libs/domain/holdings
│       └── src/lib/
│           ├── account-category.ts      # category enum/list
│           ├── account.ts               # Account entity
│           ├── account-validation.ts    # required-name validation, per-field trimming
│           └── *.spec.ts
├── api-contract/
│   └── src/lib/account-overview.ts      # NEW — request/response DTOs (see Constitution Check)
└── frontend/domain/account-overview/    # EXISTING lib — replace placeholder with real page
    └── src/lib/
        ├── account-overview-page/               # NEW — list + grouping + toolbar
        ├── account-overview-form/                # NEW — add/edit modal, reused for both
        └── account-overview-placeholder/        # REMOVED (superseded by account-overview-page)
```

**Structure Decision**: Reuses the existing `libs/frontend/domain/account-overview` Nx library
(already registered as a `scope:frontend-domain` placeholder per 022) rather than creating a new
frontend library — only its internal placeholder component is replaced. Adds one new backend
domain library, `libs/domain/accounts`, following the exact same shape as `libs/domain/holdings`
(entity + validation, framework-independent, Principle I). No shared library depends on another
domain library; the backend module lives at `apps/backend/src/account-overview/` alongside
`apps/backend/src/holdings/`, both registered in the same `app.module.ts`.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
