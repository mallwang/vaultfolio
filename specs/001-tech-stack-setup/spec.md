# Feature Specification: Tech Stack & Tooling Setup

**Feature Branch**: `001-tech-stack-setup`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "I would like to setup the tech stack and tools like described in the constitution."

## User Scenarios & Testing _(mandatory)_

<!--
  This feature is foundational/infrastructural rather than end-user-facing: the
  "user" of these journeys is the developer working on Vaultfolio. It establishes
  the scaffolding (repository layout, application shells, database, local
  orchestration) that every subsequent user-facing feature will be built on top
  of, per the constitution's Technology & Architecture Constraints and Stack
  Decision sections.
-->

### User Story 1 - Run the full stack locally with one command (Priority: P1)

A developer who has just cloned the repository can bring up the frontend,
backend, and database together with a single command and reach a working
(even if minimal) application in the browser, without manually installing or
configuring each component by hand.

**Why this priority**: This is the foundation every other feature depends on.
Without a runnable, orchestrated stack, no further feature work (import
pipelines, valuation, portfolio overview, etc.) can be developed or
demonstrated. It also directly satisfies the constitution's requirement that
the full stack be runnable end-to-end via a single orchestration file.

**Independent Test**: Can be fully tested by cloning the repository on a clean
machine with only the container runtime installed, running the single startup
command, and confirming the frontend loads in a browser, the backend responds
to a basic health-check request, and the database is reachable — delivering a
working local development environment on its own.

**Acceptance Scenarios**:

1. **Given** a clean checkout of the repository and a container runtime
   installed, **When** the developer runs the single orchestration command,
   **Then** the frontend, backend, and database all start successfully and
   the frontend is reachable in a browser.
2. **Given** the stack is running, **When** the developer requests the
   backend's health-check endpoint, **Then** it responds successfully and
   confirms it can reach the database.
3. **Given** the stack is running, **When** the developer stops and restarts
   the database container (with the frontend/backend left running), **Then**
   previously stored data is still present afterward.

---

### User Story 2 - Add a new domain library independent of the API/UI (Priority: P2)

A developer can create a new standalone library within the monorepo (for
example, a finance domain-logic library) that can be built and tested on its
own, without needing the backend server or frontend application running.

**Why this priority**: This directly enables Principle I (Library-First) and
Principle III (Test-First) for all future finance-logic features — without
this scaffolding in place, every subsequent feature would have to invent its
own project structure, which risks inconsistent boundaries between domain
logic, the API layer, and the UI.

**Independent Test**: Can be fully tested by generating a new library via the
monorepo's tooling, adding a trivial function and a passing test to it, and
running that library's tests in isolation (without starting the backend or
frontend) to confirm they pass — delivering a working, independently testable
library scaffold on its own.

**Acceptance Scenarios**:

1. **Given** the monorepo scaffold exists, **When** a developer generates a
   new library for shared domain logic, **Then** the library is created with
   its own test setup and can be built and tested without starting the
   backend or frontend.
2. **Given** a library exists, **When** the frontend project attempts to
   import backend-only source directly (bypassing the published API
   contract), **Then** the monorepo's project-boundary rules reject the
   import.

---

### User Story 3 - Confirm the backend and frontend are independently runnable and testable (Priority: P3)

A developer can start and test the backend on its own (against a mock or
contract-level expectation of the frontend) and can start and test the
frontend on its own (against a mocked or stubbed backend), without requiring
the other tier to be present.

**Why this priority**: This validates Principle II (API-First Interface) is
structurally supported by the scaffold from day one, even though no real
business-capability API endpoints exist yet — it confirms the two tiers are
decoupled before feature work begins layering endpoints and UI on top.

**Independent Test**: Can be fully tested by starting only the backend
project and running its test suite, then separately starting only the
frontend project and running its test suite, confirming both pass without the
other tier running.

**Acceptance Scenarios**:

1. **Given** only the backend project, **When** its test suite is run,
   **Then** all tests pass without the frontend or a live browser present.
2. **Given** only the frontend project, **When** its test suite is run,
   **Then** all tests pass without the backend server running.

---

### Edge Cases

- What happens when the container runtime is not installed or not running
  when the developer attempts to start the stack? The developer MUST receive
  a clear, actionable error rather than a silent failure or an unrelated
  stack trace.
- What happens when the database container fails to start (e.g., a port
  conflict)? The backend MUST fail its health check clearly rather than
  starting in a broken, half-connected state.
- What happens when a developer tries to store a monetary or quantity value
  through the initial scaffold's example code path? It MUST be persisted
  using an exact decimal representation, never a native floating-point
  number, even in placeholder/example code.
- How does the scaffold behave the first time it is started (empty database,
  no prior data)? It MUST start cleanly and reach a healthy state without
  requiring manual database setup steps beyond what the single orchestration
  command performs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The repository MUST be organized as a single monorepo containing
  the frontend application, the backend application, and any shared
  libraries, with enforced project boundaries so the frontend cannot import
  backend source directly.
- **FR-002**: The system MUST provide a backend application shell that starts
  successfully and exposes at least one endpoint (e.g., a health check) over
  HTTP.
- **FR-003**: The system MUST provide a frontend application shell that
  builds and serves successfully and can render a minimal page in a browser.
- **FR-004**: The system MUST provide a relational database running as its
  own independent service/container, separate from the backend application
  process, so its data persists across backend/frontend container restarts.
- **FR-005**: The full stack (frontend, backend, database) MUST be startable
  end-to-end via a single local orchestration command.
- **FR-006**: The backend and frontend projects MUST each be independently
  buildable and independently testable (each project's automated tests MUST
  be runnable without the other tier present).
- **FR-007**: The scaffold MUST include at least one standalone, independently
  testable library (outside the backend/frontend application projects)
  demonstrating the project structure that future domain-logic features
  (e.g., valuation, cost-basis calculation) will follow.
- **FR-008**: Any example/placeholder monetary or quantity value introduced by
  the scaffold MUST use an exact decimal representation at both the database
  layer and the application layer — never a native floating-point number.
- **FR-009**: The scaffold MUST NOT include any integration with personal
  banking or brokerage account APIs, and MUST NOT include any external API
  integration other than the placeholder/interface for future read-only
  market-data lookups.
- **FR-010**: The scaffold's structured logging MUST be configured from the
  start so backend requests and startup/health events are logged in a
  consistent, structured format.
- **FR-011**: The repository MUST document (e.g., in a top-level README) how
  a new developer starts the full stack locally and how to run each project's
  tests independently.

### Key Entities

- **Monorepo workspace**: The overall repository structure containing the
  frontend application, backend application, and shared libraries, with
  defined boundaries between them.
- **Frontend application**: The single-page web application shell that end
  users will eventually interact with.
- **Backend application**: The server application shell that exposes the
  API surface future features will extend, and that owns all access to the
  database.
- **Database service**: The independently running relational data store
  that persists application data across restarts of the other components.
- **Shared/domain library**: A standalone, independently testable module
  (outside the frontend/backend applications) that future business logic
  (e.g., valuation, allocation) will be implemented in.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new developer can go from a clean repository checkout to a
  fully running local stack (frontend reachable in a browser, backend
  health check passing, database reachable) in under 15 minutes on a machine
  that already has the required container runtime installed.
- **SC-002**: 100% of the scaffold's automated tests (backend, frontend, and
  any shared library) pass when each project is run in isolation, without
  the other tiers present.
- **SC-003**: Restarting the database service/container alone, without
  restarting the frontend or backend, results in zero loss of previously
  stored data.
- **SC-004**: A developer can add one new standalone library and have it
  building and passing its own tests within a single short session, without
  needing to modify the backend or frontend applications.

## Assumptions

- The "tech stack and tools" referenced by the user request are exactly those
  already decided in the constitution's Stack Decision section (Nx monorepo,
  NestJS/TypeScript backend, Angular/TypeScript frontend, PostgreSQL
  database, Docker-based orchestration) — this feature scaffolds that
  decision rather than re-opening it.
- No real business-capability features (holdings entry, import, valuation,
  portfolio overview) are in scope for this feature; only the foundational
  project structure, minimal application shells, and local orchestration are
  in scope. Those capabilities will be specified as separate features built
  on top of this scaffold.
- The market-data provider integration remains unselected (per the
  constitution's open TODO) and is out of scope here; this feature only
  needs to leave room for it to be added later as an isolated module,
  without wiring an actual external provider.
- "Developer" is the primary actor for all user stories in this feature,
  since it is infrastructural; end-user-facing scenarios begin with the
  first real product feature built on this scaffold.
- A container runtime (e.g., Docker) is assumed to be available on developer
  machines and any hosting target; installing that runtime itself is outside
  this feature's scope.
