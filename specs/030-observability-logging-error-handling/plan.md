# Implementation Plan: Observability — Structured Logging & Consistent Error Handling

**Branch**: `030-observability-logging-error-handling` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-observability-logging-error-handling/spec.md`

## Summary

Give every backend request a correlation ID that ties its error response to its own log entry
(US1), add consistent request-lifecycle logging with severity that separates routine client
failures from real system failures (US2), add a frontend safety net that shows a generic toast for
any backend or in-app error a screen doesn't already handle (US3), and introduce a small, shared
set of categorized business exceptions so every backend feature reports the same six failure kinds
the same way (US4) — all additive to the existing `{ error, message }` response shape so no
existing frontend `catchError` check breaks.

Technical approach: a new `libs/observability` Nx library provides an `APP_INTERCEPTOR`
(`RequestLoggingInterceptor`) and `APP_FILTER` (`GlobalExceptionFilter`), wired once into
`AppModule`, backed by an `AsyncLocalStorage`-based `RequestContextService` for correlation
ID/user propagation, and a `BusinessException` hierarchy (six subclasses). The existing
`JsonLoggerService` is extended, not replaced. On the frontend, a new `httpErrorInterceptor` and a
`GlobalErrorHandler` (`ErrorHandler`) are added alongside the existing `authInterceptor` and
`provideBrowserGlobalErrorListeners()` registration in `app.config.ts`.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling) — per the
constitution's Stack Decision. No new runtime dependency is introduced: correlation context uses
Node's built-in `AsyncLocalStorage`; the frontend fallback notification reuses the PrimeNG
`MessageService`/`Toast` already used by `profile.component.ts`, `accounts.component.ts`, etc.

**Storage**: SQLite, embedded in the backend process (constitution Stack Decision). Not used by
this feature — no new persisted entities; logs are written to stdout via `JsonLoggerService`, not
to the database.

**Testing**: Jest (Nx default for both NestJS and Angular projects); unit tests per new file in
`libs/observability`, plus one backend integration test asserting the `ErrorResponse` shape and
`X-Correlation-Id` round-trip, plus a `verify-ui` pass for the frontend fallback toast.

**Target Platform**: Linux server (backend container), modern evergreen browsers (Angular
frontend) — unchanged by this feature.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: No new perceptible latency — the interceptor adds only in-process timing
capture and a structured log write per request; no new I/O, network calls, or blocking work is
introduced on the request path.

**Constraints**: Every new/changed response field is additive only (constitution-adjacent
requirement carried over from FR-008); the existing flat `{ error: string, message: string }`
shape and every existing per-domain `error:` string union in `libs/api-contract` MUST NOT change
shape. No stack trace or raw internal/third-party error text may ever reach a response body
(FR-006). Sensitive values (credentials, session/auth tokens, full request bodies) MUST NEVER be
logged (FR-010). A failure in the error-handling or logging path itself MUST NOT prevent the
original request from getting a response (FR-015).

**Scale/Scope**: Single PR-sized rollout across one backend app and one frontend app — one new
library (`libs/observability`), two migrated throw sites (`turnstile.service.ts`,
`roles.guard.ts`), one additive `libs/api-contract` interface change, two new frontend files
(`http-error.interceptor.ts`, `global-error-handler.ts`), and two `app.module.ts`/`app.config.ts`
wiring changes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS. Observability logic (interceptor, filter, exceptions, context
  service, sanitisers) is isolated in a new standalone `libs/observability` library with a
  coherent single responsibility, independently unit-testable without the HTTP layer wired up
  (each exception class, the sanitisers, and `RequestContextService` are plain TypeScript, testable
  in isolation).
- **II. API-First Interface**: PASS — this feature strengthens this principle rather than risking
  it. Errors already use structured `{ error, message }` responses; this feature makes that
  consistent everywhere (FR-007) and adds a correlation ID (FR-002/FR-003) without changing the
  contract shape (FR-008). No direct DB access or bypass of the API is introduced.
  `libs/api-contract`'s existing per-domain error unions are extended additively, not replaced.
- **III. Test Coverage**: PASS. This feature touches no monetary/date/currency logic — the
  exact-value assertion requirement does not apply. Normal implement-then-test ordering is used
  per this principle, with unit tests per new file plus one integration test (Principle IV below).
- **IV. Integration Testing**: PASS (planned in Phase 1). One integration test exercises the real
  HTTP boundary (an unhandled exception → `ErrorResponse` shape + `X-Correlation-Id` header
  round-trip), per this principle's requirement that new library contracts get integration
  coverage, not just unit tests.
- **V. Observability, Versioning & Simplicity**: PASS — this feature _is_ the direct
  implementation of this principle's "structured logging required throughout" and "debuggable from
  logs alone" mandate, extending the existing `JsonLoggerService` (built for this principle)
  instead of introducing a new logging dependency (YAGNI). No new external dependency is added.
- **Product Scope / Technology Constraints**: PASS — no change to domain boundaries, the SQLite
  storage model, or any external integration; `turnstile.service.ts`'s existing Cloudflare
  siteverify call is the only outside-service call this feature touches, and only to reclassify its
  existing failure paths through `ExternalServiceException` (no new external call is added).

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/030-observability-logging-error-handling/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── error-response.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── app/
│       │   └── app.module.ts               # +ObservabilityModule import
│       ├── main.ts                         # +process-level unhandledRejection/uncaughtException handlers
│       ├── turnstile/
│       │   └── turnstile.service.ts        # migrate 3 raw HttpException throws → ExternalServiceException/ValidationException
│       └── auth/
│           └── roles.guard.ts              # migrate ForbiddenException → AccessDeniedException
└── frontend/
    └── src/app/
        ├── app.config.ts                   # +httpErrorInterceptor, +GlobalErrorHandler provider
        └── core/
            ├── http-error.interceptor.ts   # NEW — fallback toast for unhandled HTTP errors
            └── global-error-handler.ts     # NEW — Angular ErrorHandler for uncaught client errors

libs/
├── observability/                          # NEW library (this feature)
│   └── src/lib/
│       ├── interceptors/
│       │   ├── request-logging.interceptor.ts
│       │   └── request-logging.interceptor.spec.ts
│       ├── filters/
│       │   ├── global-exception.filter.ts
│       │   └── global-exception.filter.spec.ts
│       ├── exceptions/
│       │   ├── business.exception.ts
│       │   ├── resource-not-found.exception.ts
│       │   ├── validation.exception.ts
│       │   ├── conflict.exception.ts
│       │   ├── access-denied.exception.ts
│       │   ├── external-service.exception.ts
│       │   └── rate-limit.exception.ts
│       ├── interfaces/
│       │   └── error-response.interface.ts
│       ├── context/
│       │   ├── request-context.service.ts
│       │   └── correlation-id.util.ts
│       ├── utils/
│       │   ├── log-value-sanitiser.ts
│       │   └── sensitive-data-sanitiser.ts
│       ├── decorators/
│       │   └── suppress-request-logging.decorator.ts
│       ├── observability.module.ts
│       └── index.ts
└── api-contract/
    └── src/lib/
        └── error-response.ts                # NEW — additive ErrorResponse extension (correlationId, details)
```

**Structure Decision**: One new Nx library, `libs/observability`, following the repo's existing
per-concern library convention (`libs/domain`, `libs/export`, `libs/notifications`) rather than an
app-local `shared/` folder — this is the only new library this feature introduces. It is consumed
solely by `apps/backend` (wired once via `ObservabilityModule` in `app.module.ts`); it depends on
nothing beyond `libs/api-contract` (for the additive `ErrorResponse` type) and framework/Node
built-ins, keeping it swappable/testable in isolation per Principle I. No new frontend library is
introduced — the two new frontend files are small, app-local, and follow the existing pattern of
`auth.interceptor.ts` living under `apps/frontend/src/app/core|auth`.

## Complexity Tracking

_Not applicable — no Constitution Check violations._
