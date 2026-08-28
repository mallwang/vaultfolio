# Feature Specification: SQLite Migration & Self-Hosted Persistence

**Feature Branch**: `004-sqlite-migration`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Migrate the backend database from PostgreSQL to SQLite, with the database file stored in a /data directory on disk. This enables the whole app (frontend + backend) to be packaged as a docker-compose stack for self-hosting on a NAS via Portainer, with the SQLite file bind-mounted from the host so data persists across container recreation. Scope: replace PostgreSQL with SQLite as the persistence layer (raw driver, no ORM, matching the existing no-ORM approach in database.service.ts/holdings.repository.ts), adapt schema/queries (UUID generation, NUMERIC/decimal handling, TIMESTAMPTZ, RETURNING) to SQLite equivalents, remove the postgres service from docker-compose, add a bind-mounted ./data directory for the sqlite file, and update the project constitution and README to reflect SQLite as the new ratified database choice instead of PostgreSQL."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Self-host the stack on a single-file database (Priority: P1)

As the operator of a self-hosted deployment (e.g. a NAS running Portainer), I want to run the whole application as a single `docker compose up` with one lightweight, file-based database, so that I don't need to operate a separate database server/container, and so that all of the application's persisted data (holdings, etc.) lives in one file I can see, back up, and restore directly from the host disk.

**Why this priority**: This is the entire point of the migration — without it, nothing else in this feature has value. It's also the smallest change that already delivers the full benefit (no more separate DB container to manage).

**Independent Test**: Run `docker compose up` on a fresh host, create a holding through the app, tear the stack down (`docker compose down`, containers removed), bring it back up, and confirm the holding is still there — backed only by a file under `./data` on the host.

**Acceptance Scenarios**:

1. **Given** a fresh checkout with no prior containers, **When** the operator runs `docker compose up`, **Then** the stack starts successfully with no separate database service/container required.
2. **Given** the stack is running and a user has created data through the app, **When** the operator stops and removes the containers (`docker compose down`) and starts them again, **Then** previously created data is still present.
3. **Given** the stack is running, **When** the operator inspects the host filesystem, **Then** they find the database persisted as a file (or files) under the repository's `./data` directory.

---

### User Story 2 - Existing functionality keeps working unchanged (Priority: P2)

As an existing user of the app (e.g. the manual holdings feature), I want all current functionality — creating, listing, editing, and deleting holdings, and the health check — to keep working exactly as before, so that the database migration is invisible to me apart from how it's deployed.

**Why this priority**: The migration is worthless if it silently breaks existing behavior (in particular the exactness of monetary/quantity values, which the project treats as non-negotiable). This depends on User Story 1's plumbing being in place but is independently verifiable via the existing test suite and app flows.

**Independent Test**: Run the existing backend end-to-end tests (health + holdings) against the new database, and manually exercise create/list/edit/delete of each asset type (ETF, Share, Gold, Bitcoin) through the running app.

**Acceptance Scenarios**:

1. **Given** the migrated backend is running, **When** a client calls the health endpoint, **Then** it reports the database as connected, exactly as it did against the previous database.
2. **Given** the migrated backend is running, **When** a user creates a holding of any supported asset type with a monetary/quantity value containing decimal places, **Then** the value is stored and returned with no loss of precision (no floating-point rounding drift).
3. **Given** an existing ETF or Gold holding, **When** a user submits data that should match and update it (per the existing upsert-matching rules), **Then** the same holding is updated in place rather than a duplicate being created — matching prior behavior.
4. **Given** the migrated backend is running, **When** a user edits or deletes a holding, **Then** the change is reflected immediately and persists across a restart.

---

### User Story 3 - Project documentation reflects the new database choice (Priority: P3)

As a developer or contributor reading the project's constitution and README, I want the documented database choice to say SQLite (not PostgreSQL), so that future decisions and onboarding aren't based on stale, incorrect information.

**Why this priority**: Important for long-term project health and to avoid confusing future contributors, but has no effect on runtime behavior or end users, so it's the lowest priority slice.

**Independent Test**: Read the constitution and README after the change; confirm no remaining references present PostgreSQL as the current/ratified database choice.

**Acceptance Scenarios**:

1. **Given** the migration is complete, **When** a contributor reads the project constitution, **Then** it documents SQLite (with a bind-mounted on-disk file) as the ratified database choice, with the change recorded in the constitution's amendment history.
2. **Given** the migration is complete, **When** a contributor reads the README's setup/deployment instructions, **Then** they describe the docker-compose stack with no separate database container and mention the `./data` directory as where persisted data lives.

---

### Edge Cases

- What happens when the `./data` directory (or the file within it) doesn't exist yet on first startup? The system must create it automatically rather than failing to start.
- What happens if the backend container doesn't have write permission to the mounted `./data` directory? Startup must fail loudly (surfaced via logs and the health check reporting the database as unreachable), not silently drop to an in-memory/ephemeral state.
- What happens to previously-created PostgreSQL data during this migration? Out of scope — no automated data migration from the old PostgreSQL volume is required (see Assumptions).
- What happens if two processes/containers try to open the same database file at once (e.g. an old and new container overlapping during a redeploy)? The database must not become corrupted; concurrent access must be handled safely (readers/writers do not corrupt the file), even if a brief write-lock wait is required.
- What happens to the exact-decimal guarantee for monetary/quantity fields, given the new database's native numeric types differ from the old one's? Values must still round-trip exactly with no representation drift, verified for every existing monetary/quantity field.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST persist all application data (including the `holdings` table and any other existing tables) using a file-based, single-file database instead of a networked database server.
- **FR-002**: The system MUST store the database file(s) under a `./data` directory at the repository root, mounted into the backend container from the host filesystem, so the data survives container removal and recreation.
- **FR-003**: The system MUST automatically create the `./data` directory and the database file on first startup if they do not already exist.
- **FR-004**: The docker-compose configuration MUST no longer define or require a separate database server container/service.
- **FR-005**: The system MUST preserve exact-decimal precision for all monetary and quantity fields (no native floating-point storage), matching the project's existing decimal-handling guarantee.
- **FR-006**: The system MUST continue to enforce the existing data-shape rules per asset type (ETF, Share, Gold, Bitcoin) that are currently enforced at the database layer (required/forbidden fields per type, positive-value checks).
- **FR-007**: The system MUST continue to support the existing ETF/Gold upsert-matching lookup behavior unchanged.
- **FR-008**: The system MUST continue to expose the health check's ability to report the database as connected or unreachable.
- **FR-009**: The system's persistence layer MUST continue to be implemented without an ORM, consistent with the project's existing approach, using direct/raw queries against the new database.
- **FR-010**: All existing backend automated tests (health and holdings) MUST pass unmodified in behavior/intent against the new database.
- **FR-011**: The project's constitution and README MUST be updated to document the new database choice, replacing PostgreSQL-specific statements, with the change recorded through the project's standard governance/amendment process.
- **FR-012**: No automated migration of pre-existing PostgreSQL data is required as part of this feature (see Assumptions).

### Key Entities

- **Holding**: Unchanged in shape/meaning from the existing feature — an ETF, Share, Gold, or Bitcoin position with type-specific fields (quantity, purchase price/date, ISIN, name, weight in grams, current value). Only its storage mechanism changes.
- **Database file**: The new persisted artifact itself — a single on-disk file (plus any auxiliary journal/lock files the database engine creates) living under `./data`, replacing the previous database server's own managed storage volume.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The full application stack (frontend + backend) starts from a clean checkout with a single `docker compose up` command and no manual database provisioning step.
- **SC-002**: Data created through the app survives 100% of the time across a stop/remove/recreate cycle of the containers, verified by an explicit test of that cycle.
- **SC-003**: Zero separate database container/service appears in the running stack (down from one).
- **SC-004**: 100% of existing automated backend tests pass against the new database with no loss of test coverage.
- **SC-005**: 100% of monetary/quantity values round-trip through create/read with byte-for-byte exact decimal representation (no rounding drift), verified across all four asset types.
- **SC-006**: An operator can back up all application data by copying a single directory (`./data`) from the host, with no other host-side state required.

## Assumptions

- No migration path from an existing PostgreSQL deployment's data is required — this is treated as a pre-release/early-stage project where starting from an empty database on the new engine is acceptable. Anyone with existing PostgreSQL data is expected to re-enter it or handle a manual, one-off export/import outside the scope of this feature.
- Expected concurrent write load remains low (a single self-hosted user/household), so a file-based database's single-writer model is an acceptable trade-off against running a full database server.
- The backend remains a single container instance (no horizontal scaling of the backend across multiple containers sharing one database file) — consistent with the self-hosted, NAS-oriented deployment target described in the input.
- "Update the constitution" means following the project's existing governance process for amending `.specify/memory/constitution.md` (not hand-editing it outside that process).
