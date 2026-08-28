# Implementation Plan: SQLite Migration & Self-Hosted Persistence

**Branch**: `004-sqlite-migration` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-sqlite-migration/spec.md`

## Summary

Replace PostgreSQL with SQLite (via `better-sqlite3`, raw driver, no ORM) as the backend's
persistence layer, so the whole app can self-host as a single `docker compose up` with no separate
database container — the SQLite file lives under a host-bind-mounted `./data` directory instead of
a Docker-managed volume. `DatabaseService` and `HoldingsRepository` are adapted (UUID generation
moves to the app layer, `NUMERIC`/`TIMESTAMPTZ` columns become `TEXT` holding canonical
decimal/ISO-8601 strings, WAL mode + busy-timeout for safe concurrent access) with no change to the
`Holding` domain shape, the REST API contract, or existing test intent. The `postgres` service is
removed from `docker-compose.yml`; the project constitution and README are amended to document
SQLite as the ratified database choice.

## Technical Context

**Language/Version**: TypeScript, Node.js 24 (matches `docker/backend.Dockerfile`'s `node:24-slim`)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. New for this feature: `better-sqlite3` (raw SQLite driver,
replacing `pg`; see [research.md](./research.md) #1). `decimal.js` (already a dependency) continues
to own all monetary/quantity arithmetic at the application layer, unchanged.

**Storage**: SQLite, a single file at `${DATABASE_PATH}` (default `./data/vaultfolio.db`),
bind-mounted from the host into the backend container; accessed only by the backend (Principle II).
Replaces PostgreSQL, which previously ran as its own `docker-compose` service/container.

**Testing**: Jest (Nx default); existing health + holdings unit and e2e suites
(`apps/backend/src/tests/holdings.e2e-spec.ts`) run unmodified in intent against a temp-file SQLite
database per research.md #8.

**Target Platform**: Linux server — now just the `backend` + `frontend` containers (no database
container); modern evergreen browsers for the Angular frontend. Self-hosting target explicitly
includes NAS/Portainer deployments (spec.md Input).

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below) — unchanged
from 003.

**Performance Goals**: N/A — no new throughput/latency target; spec Assumptions explicitly scope
this to low, single-household concurrent write load, not a performance optimization.

**Constraints**: Byte-exact decimal round-trip for all monetary/quantity fields (FR-005, SC-005);
safe concurrent access to the single database file without corruption (edge case, research.md #6);
`./data` directory/file auto-created on first startup (FR-003); loud, non-silent startup failure
if `./data` isn't writable, without crashing the process so the health check can still report
"unreachable" (edge case, research.md #7).

**Scale/Scope**: Single self-hosted user/household; single backend container instance, no
horizontal scaling sharing one database file (spec.md Assumptions).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: Pass — no domain logic changes; `libs/domain/holdings` is
  untouched, only the backend's persistence adapter changes.
- **Principle II (API-First Interface)**: Pass — the REST contract
  (`specs/003-manual-holdings-entry/contracts/holdings-api.md`, `GET /health`) is unchanged; the
  frontend still only talks to the backend's HTTP API.
- **Principle III (Test-First)**: Pass, with an explicit obligation carried into tasks — any change
  to `HoldingsRepository`/`DatabaseService` that touches decimal storage MUST have exact-value
  tests (round-trip of `quantity`/`purchase_price`/`weight_grams`/`current_value` through the new
  `TEXT`-column storage) written and failing before the SQLite schema/queries are implemented, not
  just reused unmodified from 003.
- **Principle IV (Integration Testing)**: Pass, with an explicit obligation — the existing
  `holdings.e2e-spec.ts` integration suite MUST be re-run (not just unit-tested) against the new
  SQLite-backed `DatabaseService`, per FR-010/SC-004, plus a new integration test for the
  stop/remove/recreate persistence scenario (SC-002, quickstart.md #2).
- **Principle V (Observability, Versioning & Simplicity)**: Pass — stays raw-driver/no-ORM
  (research.md #1), adds exactly one new dependency (`better-sqlite3`) with clear justification,
  and keeps the same structured-logging pattern (`Logger.error` on startup failure) as the code it
  replaces.

### Known, intentional gate violation: Technology & Architecture Constraints

The current constitution (v2.2.0) states the database "MUST run as its own container/service, not
embedded in the backend process" and names PostgreSQL specifically as the Stack Decision. This
feature's entire purpose is to change exactly that — SQLite runs embedded in the backend process,
as a file, not as a separate container/service.

This is **not** a Complexity Tracking violation (i.e., not "extra complexity added against an
unchanged principle") — it's the constitution's own database constraint becoming outdated by
design. Per FR-011, User Story 3, and the spec's Assumptions ("Update the constitution" = follow
the existing `/speckit-constitution` governance process), this plan treats the amendment as
**required, in-scope work for this feature**, not a deviation to justify away:

- The constitution's "database MUST run as its own container/service" bullet and its "Database:
  PostgreSQL" Stack Decision line must both be amended via `/speckit-constitution` to describe
  SQLite as an embedded, file-based, bind-mounted database as the ratified choice.
- This amendment is tracked as an explicit task (User Story 3) in `tasks.md`, run via the standard
  governance process — not a hand-edit — and is a **gate for calling this feature complete**
  (spec.md Acceptance Scenario 3.1), even though it doesn't block Phase 0/1 design work here.
- Until that amendment lands, the constitution is temporarily inconsistent with `main`'s actual
  database choice on this branch — acceptable for the duration of one feature branch, not as an
  ongoing pattern.

No other Complexity Tracking entries are needed — this feature does not add services, layers, or
abstractions beyond what already existed for PostgreSQL access.

## Project Structure

### Documentation (this feature)

```text
specs/004-sqlite-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── deployment-contract.md   # Phase 1 output — docker-compose service/env/volume contract
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── database/
│       │   ├── database.module.ts     # unchanged (DI wiring)
│       │   └── database.service.ts    # MODIFIED: pg Pool -> better-sqlite3 Database,
│       │                              #   mkdir ./data, WAL + busy_timeout PRAGMAs,
│       │                              #   SQLite-flavored migrate()
│       ├── holdings/
│       │   ├── holdings.repository.ts # MODIFIED: app-generated UUID on insert,
│       │                              #   otherwise same query shapes (RETURNING kept)
│       │   └── holdings.mapper.ts     # UNCHANGED — already speaks decimal/ISO strings
│       └── tests/
│           └── holdings.e2e-spec.ts   # MODIFIED: point DATABASE_PATH at a temp file
└── frontend/                          # UNCHANGED

# no new libs — this feature is entirely within apps/backend's existing database/holdings modules
docker-compose.yml                      # MODIFIED: remove `postgres` service, add `./data` bind
                                         #   mount + DATABASE_PATH env var on `backend`
README.md                               # MODIFIED: Tech stack / running-locally sections (FR-011)
.specify/memory/constitution.md         # MODIFIED via /speckit-constitution (FR-011, see above)
```

**Structure Decision**: No new Nx projects or libraries. This feature is scoped entirely to
`apps/backend`'s existing `database` and `holdings` modules (persistence-adapter swap), plus the
repository-root `docker-compose.yml`, `README.md`, and the constitution — consistent with
Principle I (the `domain-holdings` library that owns validation/merge logic is untouched) and
YAGNI (no new abstraction is justified for a same-shape storage-engine swap).

## Complexity Tracking

> No entries. The one constitution/spec tension in this feature (the database's own governing
> constraint changing) is addressed above under Constitution Check, not here — it is not added
> complexity against a stable principle, it's the intentional subject of the feature.
