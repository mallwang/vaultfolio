# Implementation Plan: Authentication, Sessions & Per-User Data Isolation

**Branch**: `005-auth-sessions-isolation` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-auth-sessions-isolation/spec.md`

## Summary

Add session-based authentication (email + password, server-side session table, httpOnly cookie)
and strict per-user data isolation to Vaultfolio. Every route/API requires an authenticated
session except sign-in and health check; a global NestJS guard enforces this by default. Passwords
are hashed with Argon2id; repeated failed logins trigger an escalating per-account lockout.
Existing `holdings` rows are scoped to a new `owner_id` column and migrated in place to a
bootstrap admin account created from environment variables on first startup. The frontend gains a
sign-in page, an Angular route guard, and a 401 interceptor; it never handles the session token
directly (httpOnly cookie only).

## Technical Context

**Language/Version**: TypeScript (Node.js 24 runtime for the backend, per installed `node -v`)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. Feature-specific additions: `argon2` (password hashing),
`@nestjs/throttler` (secondary, IP-based login rate limit — see research.md #3). No session-store
or JWT library is added; sessions are a plain SQLite table read through the existing
`DatabaseService` (research.md #1).

**Storage**: SQLite via the existing `DatabaseService` (`better-sqlite3`, no ORM), accessed only
from the backend (Principle II). New tables: `users`, `sessions`; `holdings` gains an `owner_id`
column.

**Testing**: Jest (Nx default for both NestJS and Angular projects); contract/integration tests per
Principle IV — session-cookie round-trips and cross-account isolation are integration-tested
against a real (temp-file) SQLite database, not mocks.

**Target Platform**: Linux server (backend + embedded SQLite, in Docker), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No new goal beyond existing baseline; session lookup is a single indexed
primary-key `SELECT` added to the request path, negligible relative to existing handlers.

**Constraints**: Session validation must add no perceptible latency (single indexed lookup);
lockout state must not be resettable by restarting the process (persisted in `users`, not memory).

**Scale/Scope**: Household-scale (spec's own framing) — a handful of accounts, not a multi-tenant
SaaS scale concern.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: Session/auth logic that is pure domain logic (password-policy validation,
  lockout-delay calculation) goes in a new `libs/domain/auth` library, independently unit-testable
  without NestJS or the database — mirroring `libs/domain/holdings`. Framework glue (guards,
  controllers, the `users`/`sessions` repositories) stays in `apps/backend/src/auth/`, same split
  `holdings` already uses (`libs/domain/holdings` + `apps/backend/src/holdings`). **PASS**.
- **II. API-First Interface**: New endpoints (`POST /api/auth/sign-in`, `POST /api/auth/sign-out`,
  `GET /api/auth/session`) are documented as contracts before implementation (`contracts/`) and
  shared DTOs land in `libs/api-contract`, matching the existing `health`/`holdings` pattern. The
  frontend calls only this API, never touches SQLite. **PASS**.
- **III. Test-First (NON-NEGOTIABLE)**: This feature touches account-security logic, not monetary
  values, so the exact-decimal-assertion clause doesn't apply directly — but lockout-delay
  calculation and password-policy validation are still deterministic domain logic and MUST follow
  Red-Green-Refactor with tests written first, per the general Test-First mandate. **PASS**
  (enforced during `/speckit-tasks` + implementation, not a design-time artifact).
- **IV. Integration Testing**: Required and planned: (a) sign-in → session-cookie → protected-route
  round trip against a real temp-file SQLite DB; (b) cross-account isolation (User A's holdings
  invisible to User B) as an integration test, per the spec's own "Independent Test" for User Story
  2; (c) lockout-threshold behavior across repeated real requests. **PASS**.
- **V. Observability, Versioning & Simplicity**: Failed/locked-out sign-in attempts are logged
  (email hash or account id, not the password) via the existing `JsonLoggerService`. No new
  abstraction beyond one new Nx lib + one new backend module — matches the `holdings` precedent
  exactly, no ORM, no session-store package (research.md #1). **PASS**.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-auth-sessions-isolation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── auth-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── auth/                     # NEW — controllers, guards, decorators, repositories
│       │   ├── auth.controller.ts    # POST sign-in/sign-out, GET session
│       │   ├── auth.module.ts
│       │   ├── auth.guard.ts         # global AuthGuard (APP_GUARD) + @Public() opt-out
│       │   ├── roles.guard.ts        # @Roles('ADMIN') check, request.user.role
│       │   ├── public.decorator.ts
│       │   ├── roles.decorator.ts
│       │   ├── current-user.decorator.ts
│       │   ├── users.repository.ts   # users table CRUD, lockout counters
│       │   └── sessions.repository.ts# sessions table CRUD, deleteAllForUser()
│       ├── database/
│       │   └── database.service.ts   # EXTENDED: users/sessions tables, holdings.owner_id
│       │                             # migration + backfill, bootstrap-admin seed
│       └── holdings/
│           ├── holdings.repository.ts# EXTENDED: every query scoped by owner_id
│           └── holdings.controller.ts# EXTENDED: owner_id set from request.user on writes
└── frontend/
    └── src/app/
        ├── auth/                     # NEW
        │   ├── sign-in/sign-in.component.ts
        │   ├── auth.guard.ts         # functional route guard, calls GET /api/auth/session
        │   ├── auth.service.ts       # sign-in/sign-out/session calls
        │   └── auth.interceptor.ts   # redirects to /sign-in on 401
        └── app.routes.ts             # EXTENDED: authGuard on protected routes

libs/
├── domain/
│   └── auth/                         # NEW — framework-independent domain logic
│       └── src/lib/
│           ├── password-policy.ts    # 8–200 char validation (spec Assumptions)
│           └── lockout-policy.ts     # escalating-delay calculation (research.md #3)
└── api-contract/
    └── src/lib/
        └── auth.ts                   # NEW — shared DTOs: SignInRequest, SessionResponse, etc.
```

**Structure Decision**: Follows the existing `holdings` precedent exactly: one new
`libs/domain/auth` for pure policy logic, one new `apps/backend/src/auth` module for
controllers/guards/repositories, one new `libs/api-contract` file for shared DTOs, and one new
`apps/frontend/src/app/auth` folder. No new Nx apps. The only _extended_ (not new) pieces are
`DatabaseService` (new tables + migration) and the `holdings` module (owner-scoped queries).

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
