# Implementation Plan: Tech Stack & Tooling Setup

**Branch**: `001-tech-stack-setup` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-tech-stack-setup/spec.md`

## Summary

Scaffold the Vaultfolio repository per the constitution's Stack Decision: a
single Nx monorepo with a NestJS backend, an Angular frontend, a PostgreSQL
database, and a Docker Compose file that runs all three end-to-end with one
command. The scaffold includes one standalone domain library and one shared
DTO/contract library to establish the Library-First and API-First boundaries
that every future feature will build on, plus a minimal end-to-end
health-check slice (backend `/health` endpoint, frontend page that calls it)
to prove the tiers are wired together correctly. No real business capability
(holdings, imports, valuation) is implemented in this feature.

## Technical Context

**Language/Version**: TypeScript, Node.js LTS (backend runtime); Nx-managed
workspace tooling

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo
tooling/build system) — per the constitution's Stack Decision. No
feature-specific dependencies beyond this baseline; the market-data provider
integration is explicitly out of scope for this feature (left as an empty,
reserved `libs/market-data/` slot, per Assumptions in spec.md).

**Storage**: PostgreSQL 16 (containerized), accessed only through the backend
(Principle II — the frontend never talks to the database directly)

**Testing**: Jest (Nx default generator for both NestJS and Angular
projects); one contract/integration test proving the backend health endpoint
is reachable end-to-end (Principle IV)

**Target Platform**: Linux containers (backend + PostgreSQL) orchestrated via
Docker Compose for local dev and as the deployment artifact; modern
evergreen browsers for the Angular frontend

**Project Type**: Web application — Nx monorepo containing an `apps/backend`
(NestJS), `apps/frontend` (Angular), and `libs/*` shared/domain libraries

**Performance Goals**: Not applicable to this feature — no business logic
with throughput requirements is introduced. The only observable behavior is
container startup and a health-check round trip, bounded by SC-001 (stack
reachable within 15 minutes of a clean checkout, dominated by one-time image
pulls/builds rather than steady-state throughput).

**Constraints**: Full stack MUST start via a single orchestration command
(constitution, Technology & Architecture Constraints); database MUST run as
an independent container/service so data survives backend/frontend restarts
(SC-003); no native floating-point type may be used for money/quantity
values anywhere in the scaffold, including placeholder code (FR-008).

**Scale/Scope**: Scaffold only — 1 backend app, 1 frontend app, 1 domain
library, 1 shared contract library, 1 Docker Compose file, no real domain
entities beyond a placeholder used to prove the exact-decimal rule (FR-008).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / Constraint                    | Status          | Notes                                                                                                                                                                                                                      |
| ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                          | PASS            | `libs/domain/example/` scaffolded as a standalone, independently testable library from the start (FR-007); no business logic lives directly in `apps/backend` controllers.                                                 |
| II. API-First Interface                   | PASS            | Backend exposes `GET /health` as a documented, versioned-ready REST endpoint; frontend only calls it over HTTP, never imports backend source (FR-001, enforced via Nx project boundary lint rule).                         |
| III. Test-First (NON-NEGOTIABLE)          | PASS            | Scaffold tasks will generate the health-check test before the endpoint per TDD; the example domain library's placeholder decimal function ships with an exact-value test asserting no floating-point drift, written first. |
| IV. Integration Testing                   | PASS            | One integration test exercises the real HTTP round trip (frontend → backend `/health`) against a real serialized JSON response, not an in-memory stub (FR-002, FR-003, FR-006).                                            |
| V. Observability, Versioning & Simplicity | PASS            | Backend configured with structured (JSON) logging from the start (FR-010); scaffold intentionally minimal — no extra services, no premature abstractions beyond what Nx/NestJS/Angular require (YAGNI).                    |
| Product Scope — Out of Scope              | PASS            | No banking/brokerage API integration added; no budget/expense tracking.                                                                                                                                                    |
| Product Scope — External Market Data      | PASS (deferred) | `libs/market-data/` left as an empty reserved slot only — no provider selected or wired, consistent with the constitution's open `TODO(MARKET_DATA_PROVIDER)`.                                                             |
| Technology & Architecture Constraints     | PASS            | Three-tier layout (frontend/backend/database), all three containerized, single `docker-compose.yml`, database as its own service, no unauthorized external API calls.                                                      |
| Stack Decision                            | PASS            | Nx monorepo; NestJS backend; Angular frontend; PostgreSQL via `NUMERIC`; decimal library (e.g., `decimal.js` or equivalent) used at the application layer for the placeholder monetary value.                              |

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-tech-stack-setup/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/                       # NestJS
│   ├── src/
│   │   ├── health/                # HealthModule: GET /health controller + service
│   │   ├── app.module.ts
│   │   └── main.ts                # bootstraps Nest app, structured (JSON) logger
│   └── src/tests/                 # e2e/integration test: real HTTP call to /health
└── frontend/                      # Angular
    ├── src/
    │   ├── app/
    │   │   └── health-status/     # minimal component that calls GET /health and renders status
    │   └── main.ts
    └── src/tests/                 # component test using a mocked HTTP backend

libs/
├── domain/example/                # standalone, framework-independent library (Principle I)
│   └── src/                       # one placeholder decimal-value function + exact-value unit test
├── api-contract/                  # shared TypeScript types (e.g., HealthResponse DTO) used by
│                                  # both apps/backend and apps/frontend, never backend internals
└── market-data/                   # RESERVED, empty placeholder only — no provider wired
                                   # (TODO(MARKET_DATA_PROVIDER) remains open per constitution)

docker-compose.yml                 # orchestrates backend, frontend, postgres as one command
docker/
├── backend.Dockerfile
└── frontend.Dockerfile
README.md                          # updated: local startup + per-project test instructions (FR-011)
```

**Structure Decision**: New Nx workspace created from scratch (no existing
apps/libs to extend, since this is the first feature). Introduces
`apps/backend`, `apps/frontend`, `libs/domain/example`, `libs/api-contract`,
and a reserved-but-empty `libs/market-data`. Nx project-boundary tags (e.g.,
`scope:backend`, `scope:frontend`, `scope:shared`) enforce that
`apps/frontend` may depend on `libs/api-contract` but not on `apps/backend`
or any backend-only library, satisfying Principle II. `libs/domain/example`
is a throwaway proof-of-pattern library (not real business logic); the first
real domain feature (e.g., valuation) will replace or extend it under the
same `libs/domain/*` convention.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
