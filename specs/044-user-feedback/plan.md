# Implementation Plan: User Feedback

**Branch**: `044-user-feedback` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/044-user-feedback/spec.md`; approved mockup in [mockup.html](./mockup.html) (design.md follows after implementation)

## Summary

A signed-in member opens a feedback dialog from a new header icon, sends category + subject + message, and the dialog closes only after the backend confirmed delivery. A new NestJS module `feedback` verifies the Turnstile token, enforces 5 delivered feedbacks per rolling 24 h per user, sends one mail per admin (each in the admin's language), then stores the row with subject and message encrypted via the 040 keyring (new encryption domain `feedback`). The client sends a generated attempt id which makes retries idempotent. On failure the frontend keeps a per-user local draft and contributes a hint to the notification center (043) that reopens the dialog. No admin UI for stored feedback.

## Technical Context

**Language/Version**: TypeScript (NestJS backend, Angular ~22.1 frontend, Nx monorepo)

**Primary Dependencies**: Existing only: `MailerService` (nodemailer), `@vaultfolio/notifications` templates, `TurnstileGuard`, `DomainKeyringService`, `@vaultfolio/frontend-hints`, PrimeNG `p-dialog`/`p-confirmdialog`-style confirm, `app-turnstile`. No new third-party dependency.

**Storage**: SQLite via `better-sqlite3` (`DatabaseService`, `CREATE TABLE IF NOT EXISTS`, no migration files for new tables); browser `localStorage` for the draft.

**Testing**: Jest for backend and `libs/*`; Vitest for Angular. Backend integration/e2e specs for the endpoints (limit, idempotency, delivery failure, challenge rejection, ciphertext at rest). Playwright via `verify-ui`.

**Target Platform**: Linux server, modern browsers, desktop and mobile.

**Project Type**: web-service + frontend (Nx monorepo).

**Performance Goals**: Not critical; one SMTP round trip per admin per feedback, bounded by the 5/24 h limit.

**Constraints**: Subject/message never logged and never in plain text in the DB. Dialog closes only after confirmed delivery. Single-instance SQLite, so an in-process per-user lock is sufficient for quota/idempotency races.

**Scale/Scope**: Members x 5 feedbacks/day at most; a handful of admins.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                     | Assessment                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                     | PASS. Shared contract (categories, limits, DTOs, error codes) in `libs/api-contract`; mail template in `libs/notifications`. The small frontend draft logic stays in the app shell next to `core/hints` (see research 9). |
| II. API-First                        | PASS. Two documented endpoints, OpenAPI DTOs, structured error bodies with machine codes.                                                                                                                                 |
| III. Test Coverage                   | PASS. No monetary logic. Exact-value tests for quota window arithmetic (boundary at exactly 24 h) and limits.                                                                                                             |
| IV. Integration Testing              | PASS. e2e for contract and module-to-module flow (feedback -> turnstile, mailer, keyring, users).                                                                                                                         |
| V. Observability, Simplicity         | PASS. Structured events with ids and category only; simplest mechanism (one table, one lock map, one endpoint pair).                                                                                                      |
| Sensitive Personal Data              | PASS. Text encrypted at rest (040), absent from logs, mail bodies only to admins; draft in `localStorage` per user (user's own text on their own device).                                                                 |
| Encryption (040)                     | PASS with wiring. New domain id `feedback` registered in the keyring registry, rotation, startup check and admin encryption UI.                                                                                           |
| Stack: Material Icons only           | PASS. Adds a `feedback` icon to the icon map.                                                                                                                                                                             |
| Stack: Nx tags / frontend boundaries | PASS. Shell feature under `apps/frontend/src/app/core/feedback`; contributes to the hints registry (no `domainId`).                                                                                                       |

Re-check after Phase 1 design: no violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/044-user-feedback/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── mockup.html
├── contracts/
│   └── feedback-api.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
libs/api-contract/src/lib/feedback.ts          # NEW: categories, limits, request/response/quota types, error codes
libs/api-contract/src/lib/encryption.ts        # + 'feedback' in ENCRYPTION_DOMAIN_IDS
libs/notifications/src/lib/                    # + type 'feedback-admin-notice', templates/feedback-admin-notice/ (en, de)

apps/backend/src/feedback/                     # NEW
├── feedback.module.ts  feedback.controller.ts  feedback.service.ts
├── feedback.repository.ts  feedback-crypto.service.ts  feedback-email.service.ts
├── feedback-available.guard.ts  feedback.exceptions.ts  *.spec.ts  feedback.e2e-spec.ts
apps/backend/src/database/database.service.ts  # + feedback_submissions table and indexes
apps/backend/src/encryption/domain-encryption.registry.ts  # + feedback domain (payloadTable)
apps/backend/src/openapi/dto/feedback.ts       # Swagger DTOs; re-export in dto/index.ts
apps/backend/src/app/app.module.ts             # + FeedbackModule

apps/frontend/src/app/core/feedback/           # NEW
├── feedback-button/        # header icon
├── feedback-dialog/        # form, quota footer, banners, cancel confirm, turnstile row
├── feedback.store.ts       # open state, quota, send, draft
├── feedback-draft.ts       # pure parse/serialize/isEmpty (+ spec)
├── feedback-draft-storage.ts  # per-user localStorage (best effort)
└── feedback-hint-provider.ts  # HintProvider (draft exists)
apps/frontend/src/app/core/hints/hint-providers.registry.ts  # + feedback entry
apps/frontend/src/app/core/layout/app-header/  # + feedback button left of the hints bell
libs/frontend/shared-ui/src/lib/icon/icon-name.map.ts        # + 'feedback'
libs/frontend/shared-ui/src/lib/i18n/translations/           # feedback.{en,de}.ts, hints.* for the draft hint, encryption.* for the new domain
libs/frontend/admin/                           # encryption screen label for the 'feedback' domain
```

**Structure Decision**: Feedback is cross-cutting, not a domain, so it lives in the shell (`core/feedback`) and a new backend feature module; the contract is shared via `@vaultfolio/api-contract`. No new Nx library: the only pure frontend logic is a ~30-line draft serializer, tested next to the shell code.

## Complexity Tracking

No constitution violations.
