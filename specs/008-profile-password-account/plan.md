# Implementation Plan: Profile, Password & Account Self-Service

**Branch**: `008-profile-password-account` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-profile-password-account/spec.md`

## Summary

Adds self-service account management for every signed-in user: display-name update (immediate),
email-change (verified via a single-use 24h token, old address stays active), password change
(current-password-gated, invalidates other sessions), forgot/reset password (uniform response,
1h token), and self-account deletion (reusing 006's last-admin invariant and session-invalidation
primitive). Backend adds one new table (`account_action_tokens`) generalizing 006/007's per-purpose
token pattern with a `purpose` discriminator (`EMAIL_CHANGE` | `PASSWORD_RESET`), a new
`ProfileController`/`ProfileService` (`/api/profile`, no role restriction — the gap this closes:
`AccountsService.deleteSelf` already existed but its only route was `@Roles('ADMIN')`-gated,
unreachable by a `MEMBER`), extends `UsersRepository` with display-name/email/password-hash
mutators and `SessionsRepository` with a same-user-except-this-session invalidation variant, and
adds a third `EmailService` (mirroring 006/007's, not shared — see research.md #4). Frontend adds a
new **Profile** sub-tab (first, non-admin-gated) to the existing Settings area, a header role badge,
and four shell-less signed-out pages, per design.md.

## Technical Context

**Language/Version**: TypeScript (Node.js 24 runtime for the backend, matching specs 005–007)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. Reuses `argon2` (password hashing, same as 005), `nodemailer` (SMTP,
same as 006/007), and the existing `AuthGuard`/`CurrentUser`/`Public` primitives — no new
dependency.

**Storage**: SQLite via the existing `DatabaseService` (`better-sqlite3`, no ORM). Extends `users`
(new `display_name`/`email`/`password_hash` mutators — no new columns needed, all three already
exist per spec 005; adds `pending_email` per data-model.md). New table: `account_action_tokens`.

**Testing**: Jest (Nx default); integration tests against a real temp-file SQLite DB per Principle
IV — email-change supersede/conflict, password-change session invalidation (other sessions only,
current survives), forgot-password response-uniformity (including a timing-variance assertion),
reset/verify token expiry/reuse rejection, and the last-admin-blocked self-delete path reusing
006's fixture pattern.

**Target Platform**: Linux server (backend + embedded SQLite, in Docker), modern evergreen browsers
(Angular frontend) — unchanged from specs 005–007.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No new goal beyond spec 005's baseline; household scale.

**Constraints**: Forgot-password MUST respond in constant time regardless of account existence
(Edge Cases) — achieved by always performing an equivalent-cost operation (a dummy argon2-shaped
delay is unnecessary since no password comparison happens on this path; instead both branches
perform the same DB read + token-table write shape, see research.md #3) before responding. Email
delivery MUST NOT block longer than a short timeout and a failure MUST be a reported error, never
silent (same rule as 006/007).

**Scale/Scope**: Household-scale (unchanged) — a handful of accounts, no new scaling concern.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: The one new piece of pure domain logic — token purpose validation/expiry
  windows — is small enough to live as an addition to the existing `libs/domain/auth` (it operates
  on the same token/expiry shape 006 already modeled there via `invitation-token.ts`'s sibling
  pattern) rather than a new library, per Principle V/YAGNI (a whole new lib for one function would
  be an organizational-only library, which the constitution explicitly disallows). Framework glue
  (controller, service, repository, email adapter) stays in `apps/backend/src/profile/`, mirroring
  the `accounts`/`invitations`/`signups` split. **PASS**.
- **II. API-First Interface**: New endpoints under `/api/profile` (documented in `contracts/` before
  implementation) plus shared DTOs in `libs/api-contract`. The frontend calls only this API — no
  direct DB access. **PASS**.
- **III. Test-First (NON-NEGOTIABLE)**: Not monetary values, but security-sensitive deterministic
  logic (session invalidation, token expiry/purpose isolation, last-admin invariant) MUST follow
  Red-Green-Refactor with tests written first, enforced during `/speckit-tasks` + implementation.
  **PASS**.
- **IV. Integration Testing**: Required and planned: (a) email-change request → verify → old
  sessions untouched, new email active, prior pending token invalidated; (b) a `PASSWORD_RESET`
  token never satisfies an `EMAIL_CHANGE` lookup and vice versa (purpose isolation, Edge Cases);
  (c) password change invalidates every _other_ session but not the one that made the request; (d)
  forgot-password for an existing vs. nonexistent address produces byte-identical responses; (e)
  self-delete blocked while sole active admin, reusing 006's `canRemoveLastAdmin` fixture. **PASS**.
- **V. Observability, Versioning & Simplicity**: All profile actions (name change, email-change
  request/confirm, password change/reset, self-delete) logged via `JsonLoggerService` with actor and
  outcome — never a password, token value, or token hash. No new dependency introduced. A third
  `EmailService` (not a shared one) is a deliberate, justified repeat of an existing pattern rather
  than a new abstraction — see research.md #4 for why extracting a shared one is deferred. **PASS**.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-profile-password-account/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── profile-api.md
├── design.md             # Approved UI layout/states (already present)
├── mockup.html           # Approved static mockup (already present)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── profile/                   # NEW — self-service module, every signed-in user
│       │   ├── profile.controller.ts  # /api/profile — mostly authenticated-only (no @Roles()),
│       │   │                          # plus @Public() forgot/reset/verify-email routes
│       │   ├── profile.module.ts
│       │   ├── profile.service.ts     # display name, email-change, password change/reset,
│       │   │                          # self-delete (delegates to AccountsService.deleteSelf,
│       │   │                          # research.md #1 — no duplicated last-admin logic)
│       │   ├── account-action-tokens.repository.ts  # NEW — generic token table, purpose-scoped
│       │   └── email.service.ts       # NEW — third EmailService instance, research.md #4
│       ├── accounts/
│       │   └── accounts.service.ts    # UNCHANGED — deleteSelf() reused as-is by ProfileService
│       ├── auth/
│       │   ├── users.repository.ts    # EXTENDED: updateDisplayName, updateEmail, updatePasswordHash,
│       │   │                          # pending_email column + setters
│       │   └── sessions.repository.ts # EXTENDED: deleteAllForUserExcept(userId, exceptSessionId)
│       └── database/
│           └── database.service.ts    # EXTENDED: users.pending_email column, account_action_tokens table
└── frontend/
    └── src/app/
        ├── settings/
        │   ├── settings.component.html # EXTENDED: new "Profile" tab, positioned first
        │   └── profile/                 # NEW — Profile sub-tab (design.md)
        ├── core/layout/app-header/      # EXTENDED: role badge (design.md)
        ├── account/                     # NEW — shell-less signed-out pages (design.md)
        │   ├── forgot-password/
        │   ├── reset-password/          # /account/reset-password/:token
        │   ├── verify-email/            # /account/verify-email/:token
        │   └── link-invalid/            # shared expired/used page
        └── app.routes.ts                # EXTENDED: 4 new public routes under /account

libs/
├── domain/
│   └── auth/
│       └── src/lib/
│           └── account-action-token.ts  # NEW — pure expiry/purpose helpers, sibling to
│                                         # invitation-token.ts's pattern
└── api-contract/
    └── src/lib/
        └── profile.ts                   # NEW — shared DTOs
```

**Structure Decision**: Follows the `accounts`/`invitations`/`signups` precedent from specs
005–007 exactly: one new backend module (`profile`), a small addition to the existing
`libs/domain/auth` (not a new lib — Principle I/V), one new `libs/api-contract` file, and new
frontend routes nested under the existing `settings` area plus a new shell-less `account` area. No
new Nx apps. `AccountsService.deleteSelf` and `EmailAvailabilityService` (extended for email-change
conflict checks) are reused, not duplicated — see research.md #1 and #2.

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
