# Implementation Plan: Admin Account Management & Invitations

**Branch**: `006-admin-accounts-invitations` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-admin-accounts-invitations/spec.md`

## Summary

Extend the `users` table/module from spec 005 with an admin-facing account lifecycle (list, role
change, archive/reactivate, last-admin invariant) and an email-invitation flow (admin invites by
email only; invitee sets their own password via a single-use, time-limited token link). Backend
adds an `accounts` module (admin-only, `@Roles('ADMIN')`) and an `invitations` module/table plus a
`libs/domain/invitations` lib for pure token/expiry/state-machine logic; an `EmailService`
abstraction wraps SMTP delivery (nodemailer) so the provider stays swappable and failures surface
as reported errors, never silent drops. Frontend adds two new sub-tabs under the existing Settings
area (Accounts, Invitations) plus two invitee-facing, shell-less pages (`/invite/:token` accept and
expired/used states) per design.md.

## Technical Context

**Language/Version**: TypeScript (Node.js 24 runtime for the backend, matching spec 005)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. Feature-specific addition: `nodemailer` (SMTP email delivery,
research.md #1). Reuses `argon2` (invitee password hashing, same policy as spec 005) and the
existing `AuthGuard`/`RolesGuard`/`@Roles()` primitives — no new auth library.

**Storage**: SQLite via the existing `DatabaseService` (`better-sqlite3`, no ORM). Extends `users`
(adds `archived_at`, `retention_expires_at` — `status` and the archived-can't-sign-in behavior
already exist per spec 005). New table: `invitations`.

**Testing**: Jest (Nx default); integration tests against a real temp-file SQLite DB per Principle
IV — last-admin invariant across all three action paths, session invalidation on archive, full
invite→accept round trip, token reuse/expiry rejection, and race-condition resolution (Edge Cases).

**Target Platform**: Linux server (backend + embedded SQLite, in Docker), modern evergreen browsers
(Angular frontend) — unchanged from spec 005.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No new goal beyond spec 005's baseline; account list/invitation list are
single indexed-table scans at household scale (a handful to dozens of rows).

**Constraints**: Email delivery is out-of-process (SMTP) and MUST NOT block the HTTP response
longer than a short timeout; a delivery failure MUST be reported to the admin (FR per spec
Assumptions), not swallowed. The retention sweep (permanent deletion past the retention window)
runs on an interval timer within the backend process — no external scheduler, per Principle
V/YAGNI at this scale.

**Scale/Scope**: Household-scale (unchanged from spec 005) — a handful of accounts and invitations,
not a multi-tenant SaaS concern.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: Pure domain logic — invitation-token state machine (pending → accepted /
  expired / cancelled / superseded), expiry calculation, last-admin-invariant predicate — goes in a
  new `libs/domain/invitations` (invitation logic) and an addition to `libs/domain/auth`
  (last-admin predicate, since it operates on the same `User`/role shape spec 005 already modeled
  there), independently unit-testable without NestJS or the database. Framework glue (controllers,
  guards, repositories, the email adapter) stays in `apps/backend/src/accounts/` and
  `apps/backend/src/invitations/`, mirroring the `auth`/`holdings` split. **PASS**.
- **II. API-First Interface**: New endpoints (`GET/PATCH /api/accounts`, `POST
/api/accounts/:id/archive`, `POST /api/accounts/:id/reactivate`, `POST /api/invitations`,
  `GET /api/invitations`, `POST /api/invitations/:id/cancel`, `POST /api/invitations/:id/resend`,
  `GET /api/invitations/token/:token`, `POST /api/invitations/token/:token/accept`) are documented
  in `contracts/` before implementation; shared DTOs land in `libs/api-contract`. The frontend calls
  only this API. **PASS**.
- **III. Test-First (NON-NEGOTIABLE)**: Account-security and invitation-token logic, not monetary
  values, so the exact-decimal clause doesn't apply — but the last-admin invariant, token
  state-machine transitions, and expiry math are deterministic domain logic and MUST follow
  Red-Green-Refactor with tests written first, enforced during `/speckit-tasks` + implementation.
  **PASS**.
- **IV. Integration Testing**: Required and planned: (a) archive → session invalidation → 401 on
  next request, against a real temp-file SQLite DB; (b) last-admin invariant rejected on all three
  paths (archive, demote, self-delete); (c) full invite → accept → sign-in round trip; (d) reuse of
  a completed/expired/cancelled/superseded token rejected with no state change; (e) two concurrent
  archive/reactivate or cancel/resend requests on the same row resolve deterministically (Edge
  Cases). **PASS**.
- **V. Observability, Versioning & Simplicity**: Account-lifecycle actions (archive, reactivate,
  role change) and invitation actions (send, cancel, resend, accept) are logged via the existing
  `JsonLoggerService` with actor, target, and outcome — no password or token value ever logged. One
  new dependency (`nodemailer`) is justified: SMTP delivery is a hard requirement (spec
  Assumptions) with no simpler in-house alternative; isolated behind a single `EmailService`
  interface so the provider stays swappable, matching the External Market Data isolation pattern
  already established in the constitution for outbound integrations. **PASS**.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-accounts-invitations/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── accounts-api.md
│   └── invitations-api.md
├── design.md             # Approved UI layout/states (already present)
├── mockup.html           # Approved static mockup (already present)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── accounts/                  # NEW — admin account-lifecycle module
│       │   ├── accounts.controller.ts # GET list, PATCH role, POST archive/reactivate — @Roles('ADMIN')
│       │   ├── accounts.module.ts
│       │   └── accounts.service.ts    # last-admin-invariant check + session invalidation call
│       ├── invitations/               # NEW — invitation module (admin side + invitee-facing)
│       │   ├── invitations.controller.ts # admin: POST/GET/cancel/resend; public: token lookup + accept
│       │   ├── invitations.module.ts
│       │   ├── invitations.service.ts
│       │   ├── invitations.repository.ts # invitations table CRUD
│       │   └── email.service.ts       # NEW — nodemailer adapter, isolated per Principle I
│       ├── auth/
│       │   └── users.repository.ts    # EXTENDED: list-all, archive/reactivate, role update,
│       │                               # archived_at/retention_expires_at columns
│       └── database/
│           └── database.service.ts    # EXTENDED: users archival columns, invitations table
└── frontend/
    └── src/app/
        ├── settings/
        │   ├── accounts/               # NEW — Accounts sub-tab (design.md)
        │   └── invitations/            # NEW — Invitations sub-tab (design.md)
        ├── invite/                     # NEW — invitee-facing, no app shell (design.md)
        │   ├── accept/                 # accept-invite page
        │   └── expired/                # expired/used page
        └── app.routes.ts               # EXTENDED: /invite/:token public routes

libs/
├── domain/
│   ├── auth/
│   │   └── src/lib/
│   │       └── last-admin.ts          # NEW — pure predicate, shared by all 3 enforcement points
│   └── invitations/                    # NEW
│       └── src/lib/
│           ├── invitation-token.ts     # token generation/expiry
│           └── invitation-state.ts     # pending/accepted/expired/cancelled/superseded transitions
└── api-contract/
    └── src/lib/
        ├── accounts.ts                 # NEW — shared DTOs
        └── invitations.ts              # NEW — shared DTOs
```

**Structure Decision**: Follows the `auth`/`holdings` precedent from spec 005 exactly: two new
backend modules (`accounts`, `invitations`), one extension to the existing `libs/domain/auth` (the
last-admin predicate belongs next to the `User`/role model it already owns) plus one new
`libs/domain/invitations` for token/state-machine logic, two new `libs/api-contract` files, and new
frontend routes nested under the existing `settings` area plus a new shell-less `invite` area. No
new Nx apps. Extended (not new): `DatabaseService`, `UsersRepository` (spec 005's own extension
point, per its data-model.md's "out of scope for 005, owned by companion admin-management spec"
note).

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
