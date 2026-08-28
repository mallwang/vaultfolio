# Phase 0 Research: Tech Stack & Tooling Setup

All Technical Context items were resolvable directly from the constitution's
Stack Decision and Technology & Architecture Constraints — no unresolved
`NEEDS CLARIFICATION` markers remain. This document records the decisions and
the alternatives considered, for traceability.

## Monorepo tooling

- **Decision**: Nx, using its native NestJS and Angular application
  generators, plus Nx library generators for `libs/*`.
- **Rationale**: Explicitly mandated by the constitution's Stack Decision.
  Nx provides project-boundary enforcement (via `nx lint` / dependency
  constraints) that directly implements Principle II's ban on the frontend
  importing backend source, and its library generators give a consistent
  shape for Principle I's Library-First requirement.
- **Alternatives considered**: Turborepo + separate framework CLIs (rejected
  — no built-in project-boundary enforcement, would require hand-rolled
  lint rules); plain npm workspaces (rejected — no generators, no dependency
  graph tooling, more manual setup contradicting Principle V's simplicity
  goal by requiring bespoke tooling).

## Backend framework

- **Decision**: NestJS on Node.js LTS, TypeScript.
- **Rationale**: Mandated by the constitution. NestJS's module system maps
  cleanly onto Principle I (feature modules wrap domain libraries rather
  than containing logic themselves) and its built-in structured logging
  (`Logger`) satisfies Principle V's observability requirement with no
  extra dependency.
- **Alternatives considered**: Express/Fastify directly (rejected — no
  built-in module boundaries or DI, more boilerplate to reach the same
  Principle I structure); not evaluated further since the constitution
  already fixes this choice.

## Frontend framework

- **Decision**: Angular, TypeScript, in the same Nx workspace.
- **Rationale**: Mandated by the constitution; Nx has first-class Angular
  support (generators, build/test executors) with no extra integration work.
- **Alternatives considered**: None evaluated — constitution fixes this
  choice.

## Database & decimal handling

- **Decision**: PostgreSQL 16, run as its own container, `docker-compose.yml`
  service `postgres`, with a named volume for data persistence across
  container restarts (satisfies SC-003). Monetary/quantity columns use
  `NUMERIC`; the backend represents those values at the application layer
  with an exact-decimal library (e.g., `decimal.js`) rather than native
  `number`, per FR-008 and Principle III.
- **Rationale**: Mandated by the constitution's Money/decimal handling
  clause; a named Docker volume is the standard way to decouple container
  lifecycle from data lifecycle.
- **Alternatives considered**: SQLite for local dev (rejected — constitution
  requires PostgreSQL specifically, and a dev/prod database mismatch risks
  hiding `NUMERIC`-specific behavior); storing money as integer cents in a
  native number (rejected — constitution explicitly requires an exact
  decimal library end-to-end, and integer-cents breaks down for
  fractional-share quantities which this product also needs to track).

## Local orchestration

- **Decision**: A single root `docker-compose.yml` defining `backend`,
  `frontend`, and `postgres` services, each built from a dedicated
  Dockerfile under `docker/`, startable via `docker compose up`.
- **Rationale**: Directly required by the constitution ("packaged as Docker
  containers ... runnable end-to-end via a single orchestration file") and
  by spec.md FR-005/SC-001.
- **Alternatives considered**: Separate compose files per service (rejected
  — contradicts the "single orchestration file" requirement); a Makefile
  wrapping multiple `docker run` commands (rejected — Compose already
  provides service dependency ordering and networking, avoiding
  reinventing that logic, per Principle V's YAGNI guidance).

## Testing framework

- **Decision**: Jest, using Nx's default Jest executor for both the NestJS
  and Angular projects; one integration test for the backend
  `/health` endpoint using NestJS's `Test`/`supertest`-based e2e harness
  hitting a real HTTP server; one Angular component test using
  `HttpClientTestingModule` to verify the health-status component renders
  a real (fixture) JSON response shape.
- **Rationale**: Jest is Nx's default for both frameworks, minimizing
  tooling surface area (Principle V). The integration test satisfies
  Principle IV's requirement to exercise a real serialization format
  (actual JSON over HTTP), not just in-memory objects.
- **Alternatives considered**: Vitest (rejected — not the Nx default for
  NestJS/Angular presets, would add configuration overhead with no
  constitution-mandated benefit).

## Structured logging

- **Decision**: NestJS's built-in `Logger`, configured to emit JSON-formatted
  log lines (via a lightweight formatter, e.g., `nestjs-pino` or a small
  custom `LoggerService`) so startup and request events are structured from
  the first commit.
- **Rationale**: Principle V requires structured logging throughout,
  starting now avoids retrofitting it once real financial-calculation
  logging (inputs, source, timestamp) is added in later features.
- **Alternatives considered**: Deferring structured logging to a later
  feature (rejected — Principle V says logging is required "throughout,"
  and retrofitting a log format after handlers exist is more churn than
  configuring it once at scaffold time).

## Open item carried forward (not resolved here)

- **Market-data provider selection** remains unresolved
  (`TODO(MARKET_DATA_PROVIDER)` in the constitution). This feature only
  reserves an empty `libs/market-data/` slot; provider selection and
  integration are explicitly out of scope per spec.md's Assumptions and
  will be researched in the plan for whichever feature first needs live
  market data.
