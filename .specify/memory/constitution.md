<!--
Sync Impact Report
- Version change: 2.1.0 → 2.2.0 (MINOR: Technology & Architecture Constraints materially expanded
  to resolve the prior TODO(TECH_STACK) placeholder with a concrete stack decision)
- Modified principles: n/a
- Added sections: n/a
- Removed sections: n/a
- Modified sections:
  - Technology & Architecture Constraints: replaced the TODO(TECH_STACK) placeholder with a
    concrete stack decision — Nx monorepo; NestJS (TypeScript/Node.js) backend; Angular
    (TypeScript) frontend; PostgreSQL database; decimal money handling via PostgreSQL NUMERIC plus
    a fixed-point/decimal library at the application layer (no native float/double for money);
    market-data provider left unselected but MUST remain swappable per Principle I and Product
    Scope, decided per-feature in /speckit-plan.
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated — Technical Context now pre-fills
    Nx/NestJS/Angular/PostgreSQL/Jest, and Project Structure defaults to the Nx apps/libs layout
  - .specify/templates/spec-template.md ✅ no change needed (spec stays tech-agnostic)
  - .specify/templates/tasks-template.md ✅ updated — Path Conventions now default to the Nx
    apps/backend, apps/frontend, libs/* layout instead of generic single-project/mobile options
- Follow-up TODOs:
  - TODO(MARKET_DATA_PROVIDER): Specific market-data API vendor (prices, ETF composition) not yet
    chosen. Resolve during the /speckit-plan run for the first feature that needs live market data;
    isolate behind a dedicated module per Principle I and the Product Scope's External Market Data
    rules so the vendor stays swappable.
-->

# Vaultfolio Constitution

## Core Principles

### I. Library-First
Every feature starts as a standalone library or module with a well-defined boundary, before any
UI or transport layer is wired to it. Libraries MUST be self-contained, independently testable,
and documented with a clear purpose; a library that exists only to hold shared code with no
coherent responsibility (an "organizational-only" library) is not permitted. This applies equally
to core finance domain logic (e.g., position valuation, cost-basis/gain-loss calculation,
portfolio allocation and look-through weight aggregation) — that logic MUST be implemented and
testable independently of the API layer or UI that later calls into it.

**Rationale**: Financial logic is the highest-risk part of this system. Isolating it behind clear
library boundaries makes it possible to test money-handling code exhaustively, in isolation, and
without needing to stand up an entire application stack.

### II. API-First Interface
The backend exposes every capability the frontend needs through a documented, versioned API
(e.g., REST or GraphQL); the frontend MUST treat that API as the only path to data and business
logic — no bypassing it via direct database access or shared in-process calls. The API contract
(request/response schemas, status/error codes) MUST be written and reviewed before or alongside
the implementation, and both frontend and backend MUST be independently runnable and testable
against that contract (e.g., via a mock server or contract tests) without the other tier present.
Errors MUST use consistent, structured responses (status code + machine-readable error body), not
bare exceptions or HTML error pages. Operational/admin scripts (migrations, seed data, one-off
reconciliation jobs) MAY be exposed as CLI tools, but the CLI is not the product's primary
interface.

**Rationale**: In a three-tier web app, the frontend/backend boundary is the highest-traffic
contract in the system. Making the API the single, well-defined entry point keeps frontend and
backend independently deployable and testable, and prevents financial logic from leaking into the
UI layer or being duplicated across it.

### III. Test-First (NON-NEGOTIABLE)
Test-Driven Development is mandatory for all code that touches financial data or calculations:
tests are written first, reviewed and approved, confirmed to fail, and only then is
implementation written. The Red-Green-Refactor cycle MUST be followed strictly. Any change to
money amounts, balances, currency conversion, or date/period logic MUST include tests that assert
exact expected values — approximate or "close enough" assertions on monetary values are not
permitted.

**Rationale**: Silent correctness bugs in a finance tool directly cause incorrect financial
decisions. Test-first development is the cheapest point at which to catch them, and exact-value
assertions prevent floating-point or rounding errors from hiding inside loose tolerances.

### IV. Integration Testing
Integration tests are required, beyond unit tests, for: every new library's public contract;
any change to an existing contract; communication between services or modules (e.g., import
pipeline → valuation → storage, or market-data fetch → price cache → portfolio overview); and any
shared schema (holding records, transaction records, ETF composition data). Integration tests
MUST exercise real serialization formats (e.g., actual JSON/CSV import files, real market-data API
response payloads captured as fixtures) not just in-memory objects.

**Rationale**: Portfolio data flows through multiple stages (import or manual entry, price/
composition lookup, valuation, aggregation). Most real-world defects in such pipelines occur at
the boundaries between stages, not inside a single function — unit tests alone will not catch
them.

### V. Observability, Versioning & Simplicity
Text-based I/O and structured logging are required throughout so behavior is debuggable from
logs alone, without a debugger attached. All financial calculations and imports MUST log
sufficient context (inputs, source, timestamp) to reconstruct how a stored value was derived.
Libraries and any external-facing contracts (APIs, file formats, CLI flags for ops tooling) follow
MAJOR.MINOR.BUILD versioning; breaking changes to a contract require a MAJOR bump and a documented
migration path.
Implementations MUST start simple (YAGNI) — new abstractions, services, or dependencies require
explicit justification over a simpler alternative before being added.

**Rationale**: Auditability is a core requirement for any tool that handles someone's money —
users and maintainers must be able to trace why a balance or report looks the way it does.
Simplicity keeps that audit trail short and keeps the system easy to reason about as it grows.

## Product Scope

### In Scope
- Tracking investment holdings: ETFs, individual shares/stocks, gold and other precious metals,
  and similar investment vehicles.
- Manual entry and management of holdings and transactions (buys, sells, quantities, cost basis)
  via the UI.
- Bulk import of holdings/transactions via CSV or JSON files.
- A portfolio overview that aggregates allocation across holdings — including looking through ETF
  composition to underlying constituent weights — so overweight positions and duplicate/
  overlapping exposure across different holdings (e.g., the same share held both directly and
  inside two different ETFs) can be identified.

### Out of Scope
- Day-to-day expense or budget tracking (income, spending categories, bills, recurring payments).
  This is explicitly not a goal of the product and MUST NOT be added as a feature.
- Any integration with personal banking or brokerage account APIs to read the user's account or
  transaction data. All personal holdings/transaction data MUST originate from manual UI entry or
  explicit CSV/JSON import — it MUST NOT be pulled automatically from a linked bank or brokerage
  account.

### External Market Data (Permitted)
Unlike personal account data, reference/market data MAY be sourced from external APIs, because it
is public, non-personal information required to keep the portfolio overview accurate:
- Current prices for stocks, ETFs, gold, and other tracked instruments.
- ETF composition — the underlying constituent shares and their percentage weights — needed to
  compute look-through exposure across the whole portfolio.

Such integrations MUST be: read-only (the application never writes personal data back to a market-
data provider); isolated behind a dedicated module/service so a provider can be swapped without
touching core domain logic (per Principle I); and resilient to unavailability — the application
MUST remain usable with manually entered or last-known prices/composition if a market-data
provider is unreachable, since a user's recorded holdings are the source of truth, not the prices.

## Technology & Architecture Constraints

- The system is a three-tier web application: a **frontend**, a **backend**, and a **database**,
  each developed and deployed as a separate component communicating over the API defined in
  Principle II.
- The full stack (frontend, backend, database) MUST be packaged as Docker containers and MUST be
  runnable end-to-end via a single orchestration file (e.g., `docker-compose.yml`) for local
  development, with the same images used for hosting/deployment.
- The database MUST run as its own container/service, not embedded in the backend process, so
  data persists independently of application container restarts and can be backed up/restored on
  its own.
- The backend MAY integrate with external market-data providers (e.g., stock/ETF price APIs,
  ETF holdings/composition APIs) strictly for the read-only reference data described in Product
  Scope. No other external API integrations are permitted — in particular, no banking or
  brokerage account APIs.

### Stack Decision
- **Repository layout**: A single Nx monorepo houses the frontend, backend, and any shared
  libraries (e.g., shared DTOs/types, domain logic libraries required by Principle I). Nx project
  boundaries MUST be used to enforce the frontend/backend separation mandated by Principle II —
  the frontend project MUST NOT import backend source directly, only the published API contract.
- **Backend**: NestJS on Node.js, written in TypeScript. Domain/finance logic (position valuation,
  cost-basis/gain-loss, allocation/look-through aggregation) MUST live in standalone Nx libraries
  per Principle I, independent of NestJS controllers/modules, so it is testable without the HTTP
  layer.
- **Frontend**: Angular, written in TypeScript, in the same Nx monorepo.
- **Database**: PostgreSQL, run as its own container per the constraint above.
- **Money/decimal handling**: Monetary and quantity values MUST be stored using PostgreSQL's
  `NUMERIC`/`DECIMAL` type — never `FLOAT`/`DOUBLE PRECISION`. At the application layer, monetary
  values MUST be represented with an exact decimal type/library (not native JavaScript/TypeScript
  `number`) end-to-end through backend calculations and API responses, consistent with Principle
  III's ban on approximate assertions for monetary values.
- **Market-data provider**: Not yet selected — see `TODO(MARKET_DATA_PROVIDER)` in the Sync Impact
  Report above. Whichever provider is chosen MUST be isolated behind a dedicated Nx library/module
  per Principle I and the Product Scope's External Market Data rules, so it can be swapped without
  touching domain logic.

## Development Workflow & Quality Gates

- All work is specified via `/speckit-specify`, planned via `/speckit-plan`, and broken into tasks
  via `/speckit-tasks` before implementation begins; ad-hoc, unplanned changes to financial logic
  are not permitted.
- Every pull request MUST verify compliance with the Core Principles above before merge; a PR that
  weakens test coverage on money-handling code MUST be rejected regardless of urgency.
- Any deviation from a principle (e.g., skipping test-first for a specific change) MUST be
  documented with an explicit justification in the PR description and, if it becomes a recurring
  pattern, MUST trigger a constitution amendment rather than silent accumulation of exceptions.

## Governance

This constitution supersedes all other project practices, templates, and prior conventions where
they conflict. Amendments are made by editing this file via the `/speckit-constitution` command,
which MUST: record the change in the Sync Impact Report at the top of this file, apply semantic
versioning to the change (MAJOR for backward-incompatible principle removal/redefinition, MINOR
for a new principle or materially expanded guidance, PATCH for clarifications and wording), and
update the `Last Amended` date below.

All feature specs, plans, and task lists MUST include a Constitution Check step that verifies
alignment with the Core Principles; unresolved violations MUST be justified in the plan's
Complexity Tracking section or the plan MUST be revised to comply. Reviewers MUST treat this
constitution as authoritative over informal team conventions.

**Version**: 2.2.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
