# Implementation Plan: Public Self-Service Sign-Up with Admin Approval

**Branch**: `007-self-service-signup` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-self-service-signup/spec.md`

## Summary

Add a public, unauthenticated sign-up path alongside the existing admin-driven invitation flow
(006): a visitor submits email + password, verifies via a single-use emailed link, and lands in a
dedicated admin review queue where an admin approves (creates an active account) or rejects (with
optional reason, blacklisting the address). Built as a new `signups/` NestJS feature module that
extends the existing per-feature-folder pattern from `invitations/`, extracting the currently
private `checkEmailAvailable` logic in `InvitationsService` into a shared `EmailAvailabilityService`
so account/invitation/sign-up/blacklist state is checked as one source of truth, per the spec's own
edge-case requirement.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling), `nodemailer`
(already used by `invitations/email.service.ts`, extended with new message types), `bcrypt`
(already used for password hashing in `auth/`) — no new runtime dependencies required.

**Storage**: SQLite, embedded in the backend process at `DATABASE_PATH` (Constitution Stack
Decision) — a new `signup_requests` table plus an `email_blacklist` table (or a status column
distinguishing "rejected/blacklisted" rows within `signup_requests`, decided in research.md),
managed via the same raw `better-sqlite3` migration pattern as `database.service.ts`.

**Testing**: Jest; unit tests for `SignupsService`/`EmailAvailabilityService`/expiry-sweep logic,
integration tests against a real temp-file SQLite (Principle IV, mirroring
`retention-sweep.service.spec.ts`), controller tests for the public + admin routes.

**Target Platform**: Linux server (backend + embedded SQLite file), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (existing `apps/backend`, `apps/frontend`,
`libs/api-contract`)

**Performance Goals**: No new performance targets beyond existing auth/invitation flows (low
request volume, single-instance backend).

**Constraints**: Verification-link expiry duration and public-sign-up-enabled toggle are
configuration values (env vars), not hardcoded — consistent with `SMTP_*`/`APP_BASE_URL` handling
in `.env.example`. No feature-flag/settings infrastructure exists yet (research.md #5), so the
toggle is a bare `PUBLIC_SIGNUP_ENABLED` env var, not a new generic mechanism.

**Scale/Scope**: Single new backend feature module (`signups/`), one new Angular public page
(sign-up form + verify-link landing) and one new admin queue view/table, one shared refactor
(`EmailAvailabilityService`) extracted out of `invitations/`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: Sign-up/approval logic has no finance-domain content (no money, no
  valuation) — it is account-lifecycle logic, appropriately implemented as a NestJS feature module
  (`signups/`) alongside `invitations/`/`accounts/`, not a standalone Nx domain library. Consistent
  with how 005/006 (also non-finance, account-lifecycle features) were structured. **PASS**.
- **II. API-First Interface**: New capabilities (submit sign-up, verify token, admin list/approve/
  reject/delete) are exposed only via a new `SignupsController` REST surface, documented in
  `contracts/`, matching the `InvitationsController`'s public+admin-mixed-controller shape and
  `XErrorResponse` discriminated-union error convention. Frontend calls only this API. **PASS**.
- **III. Test-First**: This feature touches no monetary/financial values — Principle III's
  exact-value mandate does not apply, but TDD is still followed for the new service/repository
  logic per standard practice on this codebase (see `invitations.service.spec.ts` precedent).
  **PASS** (no exception needed).
- **IV. Integration Testing**: New `signup_requests`/blacklist schema and the
  `EmailAvailabilityService` refactor are both integration-tested against a real temp-file SQLite
  (mirroring `retention-sweep.service.spec.ts`), and the verification/notification/welcome/
  rejection email sends are tested against the real `EmailService` transport-construction path
  (mocked SMTP transport, not just in-memory stubs), consistent with existing `invitations/`
  tests. **PASS**.
- **V. Observability, Versioning & Simplicity**: Reuses the existing `Logger`-based structured
  logging pattern; extracting `EmailAvailabilityService` is the only new abstraction, and it is
  justified because the spec explicitly requires "one check, not several that can disagree" across
  four states (account/invitation/sign-up/blacklist) that would otherwise be duplicated between
  `InvitationsService` and the new `SignupsService`. **PASS**.

No violations — Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-self-service-signup/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── signups/                      # NEW feature module (this spec)
│       │   ├── signups.module.ts
│       │   ├── signups.controller.ts     # @Public() submit/verify + @Roles('ADMIN') queue/resolve
│       │   ├── signups.service.ts
│       │   ├── signups.repository.ts     # signup_requests table, status-guarded UPDATEs
│       │   ├── signup-expiry-sweep.service.ts  # setInterval sweep, mirrors accounts/retention-sweep.service.ts
│       │   └── email.service.ts          # verification/admin-notify/welcome/rejection sends
│       ├── invitations/
│       │   └── invitations.service.ts    # MODIFIED: checkEmailAvailable() extracted out
│       ├── shared/                       # NEW (or wherever cross-feature services live)
│       │   └── email-availability.service.ts  # extracted shared lookup (accounts+invitations+signups+blacklist)
│       ├── database/
│       │   └── database.service.ts       # MODIFIED: migrateSignups() adds signup_requests (+blacklist) tables
│       └── auth/                         # unchanged, reused (UsersRepository, session helpers)
└── frontend/
    └── src/app/
        ├── signup/                       # NEW public pages: sign-up form, verify-link landing
        └── admin/signups/                # NEW admin queue view (mirrors admin/invitations)

libs/
└── api-contract/src/lib/
    └── signups.ts                        # NEW shared DTOs/error-response types for /signups
```

**Structure Decision**: Extends the existing per-feature-folder NestJS convention with a new
`signups/` module (mirroring `invitations/`'s controller/service/repository/email-service shape)
and a small new `shared/email-availability.service.ts` extracted from `InvitationsService` so
`InvitationsService` and `SignupsService` both depend on one lookup, per the spec's single-source-
of-truth requirement. No new Nx libraries are introduced — this is account-lifecycle logic, not
finance-domain logic, so it stays in `apps/backend/src` alongside `accounts/`/`invitations/`. Only
`libs/api-contract` gains a new file (`signups.ts`) for the shared request/response/error types.

## Complexity Tracking

_No violations — table intentionally omitted._
