<!--
Sync Impact Report
- Version change: 3.0.0 → 3.1.0 (MINOR: new Stack Decision entry adds a materially new,
  binding constraint — Material Icons as the sole icon library, PrimeIcons prohibited — without
  redefining or removing any existing principle or constraint)
- Modified principles: none
- Added sections: none (new bullet added to existing "Stack Decision" subsection)
- Removed sections: none
- Modified sections:
  - Technology & Architecture Constraints → Stack Decision: added an "Icon library" entry
    naming Google Material Icons (via PrimeNG's documented custom-icon mechanism) as the
    required, sole icon library for the frontend, and prohibiting PrimeIcons (PrimeNG's
    bundled default icon font) anywhere in the application UI.
- Rationale for this amendment: driven by feature 014-material-icons — the project is
  standardizing on one consistent icon visual language across the app instead of mixing
  PrimeIcons with other icon usage, and this decision needs to be binding for all future
  feature work, not just the one feature that introduces it.
- Templates requiring updates:
  - .specify/templates/constitution-template.md ✅ no change needed (generic placeholder
    template, no icon-specific language to update)
  - .specify/templates/plan-template.md ✅ no change needed (no icon-specific language)
  - .specify/templates/tasks-template.md ✅ no change needed (no icon-specific language)
  - .specify/templates/spec-template.md ✅ no change needed (spec stays technology-agnostic)
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

### III. Test Coverage

Code that touches financial data or calculations follows a normal implement-then-test approach:
implementation is written first, then tests are added to cover it — tests are not required to be
written before, or to fail before, the implementation exists, and no Red-Green-Refactor ordering
is mandated. This applies to all code, including financial logic, because this project's
development is agentic: a single LLM context window typically produces both the implementation
and its tests from the precise logic already established by upfront research/plan/tasks
artifacts, so a strict tests-first ordering does not provide the independent-design-check benefit
it gives human developers. Despite the relaxed ordering, coverage itself is not optional: any
change to money amounts, balances, currency conversion, or date/period logic MUST end up covered
by tests that assert exact expected values before the change is considered done — approximate or
"close enough" assertions on monetary values are not permitted.

**Rationale**: Silent correctness bugs in a finance tool directly cause incorrect financial
decisions, so financial code must still be thoroughly tested. But in an agentic workflow the
tests-first ordering mostly duplicates work the plan/tasks phase already did, without the benefit
it gives human developers of using the test as an independent spec check before writing code.
Exact-value assertions remain required regardless of ordering, to prevent floating-point or
rounding errors from hiding inside loose tolerances.

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
- The database MUST be a single embedded file, bind-mounted into the backend container from a
  host-side directory (not a Docker-managed named volume), so data persists independently of
  application container restarts/recreation and can be backed up/restored with a plain filesystem
  copy of that directory — no separate database container/service is required or permitted.
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
- **Database**: SQLite, embedded directly in the backend process as a single file at
  `DATABASE_PATH` (default `./data/vaultfolio.db`), bind-mounted from the host per the constraint
  above — not run as a separate container/service.
- **Money/decimal handling**: Monetary and quantity values MUST be stored as SQLite `TEXT` columns
  holding the canonical decimal string produced by the application-layer decimal library — never
  SQLite's `REAL` storage class (IEEE-754 float, unsafe for exact decimals) and never native
  JavaScript/TypeScript `number`. At the application layer, monetary values MUST be represented
  with an exact decimal type/library end-to-end through backend calculations and API responses,
  consistent with Principle III's ban on approximate assertions for monetary values.
- **Market-data provider**: Not yet selected — see `TODO(MARKET_DATA_PROVIDER)` in the Sync Impact
  Report above. Whichever provider is chosen MUST be isolated behind a dedicated Nx library/module
  per Principle I and the Product Scope's External Market Data rules, so it can be swapped without
  touching domain logic.
- **Icon library**: Google Material Icons (Material Symbols) is the sole, standard icon library for
  the frontend. All icons MUST be sourced from Material Icons via PrimeNG's documented custom-icon
  mechanism (https://primeng.dev/customicons); PrimeIcons (PrimeNG's bundled default icon font)
  MUST NOT be used anywhere in the application UI — new and existing icon usage alike MUST resolve
  to a Material Icons glyph, with no partial/mixed icon sets left in place.

## Development Workflow & Quality Gates

- All work is specified via `/speckit-specify`, planned via `/speckit-plan`, and broken into tasks
  via `/speckit-tasks` before implementation begins; ad-hoc, unplanned changes to financial logic
  are not permitted.
- Every pull request MUST verify compliance with the Core Principles above before merge; a PR that
  weakens test coverage on money-handling code MUST be rejected regardless of urgency.
- Any deviation from a principle (e.g., shipping money-handling code without exact-value test
  coverage) MUST be documented with an explicit justification in the PR description and, if it
  becomes a recurring pattern, MUST trigger a constitution amendment rather than silent
  accumulation of exceptions.

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

**Version**: 3.1.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-31
