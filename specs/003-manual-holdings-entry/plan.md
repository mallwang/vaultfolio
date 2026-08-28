# Implementation Plan: Manual Holdings Entry

**Branch**: `003-manual-holdings-entry` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-manual-holdings-entry/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace the placeholder Holdings table (scaffolded in
[002-primeng-app-structure](../002-primeng-app-structure/spec.md)) with full CRUD for manually
entered holding lots: a type-driven add/edit form (ETF, Share, Gold, Bitcoin, each with its own
required fields per FR-001–FR-006), a list showing every lot without merging (FR-009, FR-010), and
delete with confirmation (FR-014). Per Principle I, the field/validation rules that make a
"Holding" valid (per-type required fields, positive quantity/price, non-future purchase date,
well-formed ISIN) live in a new framework-independent domain library
(`libs/domain/holdings`), unit-tested first (Principle III) with exact-decimal assertions
(`decimal.js`, matching `libs/domain/example`'s established pattern). The backend exposes this
through a documented REST contract (Principle II) backed by a new `holdings` table (`NUMERIC`
columns, no ORM — extending the existing hand-rolled `DatabaseService` migration pattern). The
frontend replaces the placeholder `HoldingsComponent` table with a real PrimeNG-driven list, an
add/edit dialog whose field set swaps per asset type, and a delete-confirm dialog, per
[design.md](./design.md).

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling), PrimeNG
(already wired up per 002-primeng-app-structure — `p-table`, `p-dialog`, `p-select`,
`p-inputnumber`, `p-datepicker`, `p-confirmdialog`), `decimal.js` (exact decimal handling, already
a dependency), `pg` (raw driver, already a dependency — no ORM is introduced, matching the
established `DatabaseService` pattern). No new runtime dependency is required for this feature —
see [research.md](./research.md) for the ISIN-validation and DTO-validation decisions that avoid
adding `class-validator`.

**Storage**: PostgreSQL, accessed only via the backend (Principle II), through a new `holdings`
table with `NUMERIC` columns for quantity/price/weight/purity (never `FLOAT`/`DOUBLE PRECISION`,
per the constitution's Money/decimal handling clause).

**Testing**: Jest — unit tests for `libs/domain/holdings` (Principle III, TDD, exact-value
assertions), unit tests for the backend service/repository, an integration test in
`apps/backend/src/tests/` issuing real HTTP requests via `supertest` against a running Nest app
instance (Principle IV, matching `health.e2e-spec.ts`), and Angular component tests for the
holdings list/form (matching the existing `health-status.component.spec.ts` pattern).

**Target Platform**: Linux server (backend + PostgreSQL containers), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No dedicated performance target beyond SC-001 (add-holding round trip under
1 minute of user interaction, not a system latency budget) — this is manual CRUD over a small
per-user dataset (dozens of lots), not a high-throughput path.

**Constraints**: List MUST remain usable with dozens of lots (Edge Cases) — addressed by
client-side PrimeNG `p-table` paging/sorting, no server-side pagination required at this scale.

**Scale/Scope**: Single-user-scoped dataset (no auth/multi-tenancy in this feature, per
Assumptions), expected to hold on the order of dozens to low hundreds of lots.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                | Check                                                                                                                                                                                                                                                      | Status |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Library-First                         | Holding validity rules (per-type required fields, positive quantity/price, non-future date, ISIN format) live in `libs/domain/holdings`, independent of NestJS/Angular, unit-tested in isolation.                                                          | PASS   |
| II. API-First Interface                  | New REST endpoints under `/holdings` are documented in [contracts/holdings-api.md](./contracts/holdings-api.md) before implementation; frontend calls only this API, never the database directly; errors use structured JSON bodies.                       | PASS   |
| III. Test-First (NON-NEGOTIABLE)         | `libs/domain/holdings` tests (quantity/price/date/ISIN validation, per-type field rules) are written first, confirmed failing, then implemented; monetary values asserted with exact decimal equality (`decimal.js`), never approximate.                   | PASS   |
| IV. Integration Testing                  | New `apps/backend/src/tests/holdings.e2e-spec.ts` exercises the real HTTP contract (create/list/update/delete) against a running Nest instance with a real Postgres connection, per FR-017 (persistence across sessions).                                  | PASS   |
| V. Observability, Versioning, Simplicity | Structured logging on holding create/edit/delete (id, asset type, outcome) so a stored value's origin is traceable; `holdings-api.md` is versioned `1.0.0`; no ORM/ORM-adjacent abstraction is introduced — extends the existing raw-`pg` pattern (YAGNI). | PASS   |

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-manual-holdings-entry/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/             # Phase 1 output (/speckit-plan command)
│   └── holdings-api.md
├── design.md              # Approved UX review mockup (already present)
├── mockup.html            # Local durable copy of the mockup (already present)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/                        # NestJS
│   ├── src/
│   │   ├── app/app.module.ts       # register HoldingsModule alongside DatabaseModule/HealthModule
│   │   ├── database/                # existing DatabaseService — extended with a holdings
│   │   │                            # migration (CREATE TABLE IF NOT EXISTS holdings ...)
│   │   ├── holdings/                 # NEW feature module
│   │   │   ├── holdings.module.ts
│   │   │   ├── holdings.controller.ts   # maps HTTP <-> domain, per contracts/holdings-api.md
│   │   │   ├── holdings.service.ts      # orchestrates domain validation + repository
│   │   │   ├── holdings.repository.ts   # raw `pg` queries against the holdings table
│   │   │   └── holdings.mapper.ts       # DB row <-> domain Holding <-> API DTO mapping
│   │   └── main.ts
│   └── src/tests/
│       └── holdings.e2e-spec.ts     # NEW — real HTTP integration test (Principle IV)
└── frontend/                        # Angular
    └── src/app/holdings/            # existing placeholder area — replaced with:
        ├── holdings.component.ts/html/css        # list (p-table) + "Add holding" action
        ├── holdings.service.ts                    # HttpClient calls to /holdings
        ├── holding-form/                          # add/edit dialog (p-dialog), field set
        │   ├── holding-form.component.ts/html/css # driven by selected/locked asset type
        │   └── holding-form.component.spec.ts
        └── holdings.component.spec.ts

libs/
├── domain/
│   ├── example/                     # existing placeholder — untouched by this feature
│   └── holdings/                    # NEW standalone domain library (Principle I)
│       ├── src/lib/
│       │   ├── asset-type.ts        # AssetType union + per-type required-field metadata
│       │   ├── holding.ts           # Holding domain model (Decimal quantity/price/weight/purity)
│       │   ├── holding-validation.ts # quantity/price positivity, future-date check, ISIN checksum
│       │   └── holding-validation.spec.ts  # written first, Principle III
│       └── (README.md, package.json, jest.config.cts, tsconfig*.json — mirrors libs/domain/example)
└── api-contract/
    └── src/lib/holdings.ts          # NEW shared DTOs: CreateHoldingRequest, UpdateHoldingRequest,
                                      # HoldingResponse, per contracts/holdings-api.md
```

**Structure Decision**: Extends the existing Nx layout established by
001-tech-stack-setup/002-primeng-app-structure rather than introducing new top-level shapes. One
new domain library (`libs/domain/holdings`, tag `scope:domain`) holds the finance-adjacent
validity rules per Principle I; `libs/api-contract` (tag `scope:shared`) gains the Holding DTOs so
frontend and backend cannot drift on shape (Principle II); `apps/backend` gains a `holdings`
feature module following the existing `health` module's controller/service split, with a
repository layer added (raw `pg`, no ORM) since this module — unlike `health` — persists real
domain state; `apps/frontend` replaces its placeholder `holdings` table with the real list +
form components already blocked out by `design.md`. No new Nx project is created; module boundary
tags (`scope:domain` → `scope:domain`/`scope:shared` only; `scope:backend` →
`scope:shared`/`scope:domain`; `scope:frontend` → `scope:shared` only) already permit this shape
without an `eslint.config` change.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — this section is intentionally empty.
