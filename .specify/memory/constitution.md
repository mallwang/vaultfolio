<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles:
  - II. CLI Interface → II. API-First Interface (redefinition: this is a three-tier web app —
    frontend, backend, database — not a CLI/library tool; the interface contract is now the
    backend's API, not a CLI. Backward-incompatible redefinition → MAJOR bump.)
- Added sections: n/a
- Removed sections: n/a
- Modified sections:
  - Technology & Architecture Constraints: recorded frontend/backend/database three-tier
    architecture, Docker-based packaging and hosting; language/framework choices remain TODO.
- Templates requiring updates:
  - .specify/templates/plan-template.md ⚠ pending manual check (Constitution Check gates should
    reference API-First Interface, not CLI Interface)
  - .specify/templates/spec-template.md ⚠ pending manual check
  - .specify/templates/tasks-template.md ⚠ pending manual check
- Follow-up TODOs:
  - TODO(TECH_STACK): Specific frontend framework, backend language/framework, and database engine
    are not yet decided. Resolve during /speckit-plan for the first feature and backfill the
    Technology & Architecture Constraints section once chosen.
-->

# Personal Finance Management Constitution

## Core Principles

### I. Library-First
Every feature starts as a standalone library or module with a well-defined boundary, before any
UI or transport layer is wired to it. Libraries MUST be self-contained, independently testable,
and documented with a clear purpose; a library that exists only to hold shared code with no
coherent responsibility (an "organizational-only" library) is not permitted. This applies equally
to core finance domain logic (e.g., transaction categorization, budget calculation, balance
reconciliation) — that logic MUST be implemented and testable independently of the API layer or
UI that later calls into it.

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
pipeline → categorization → storage); and any shared schema (transaction records, account
schemas, budget definitions). Integration tests MUST exercise real serialization formats (e.g.,
actual JSON/CSV import files, not just in-memory objects).

**Rationale**: Personal finance data flows through multiple stages (import, normalization,
categorization, reporting). Most real-world defects in such pipelines occur at the boundaries
between stages, not inside a single function — unit tests alone will not catch them.

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

TODO(TECH_STACK): Specific frontend framework, backend language/framework, and database engine
have not yet been chosen. This MUST be resolved — via a constitution amendment — before or during
the first `/speckit-plan` run, and that plan's Constitution Check MUST fail closed (block) until
it is. Once chosen, this section must additionally record: primary language(s) and runtime
versions, the currency/decimal handling approach (to avoid floating-point representation of
money), and any regulatory or data-residency constraints applicable to financial data.

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

**Version**: 2.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
