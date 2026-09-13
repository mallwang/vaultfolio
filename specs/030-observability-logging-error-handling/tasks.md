---
description: 'Task list template for feature implementation'
---

# Tasks: Observability — Structured Logging & Consistent Error Handling

**Input**: Design documents from `/specs/030-observability-logging-error-handling/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in the feature specification beyond the integration test called
out in plan.md's Testing section and Constitution Check (Principle IV); unit tests are included
per-file per the constitution's normal implement-then-test approach (Principle III), and the one
integration test required by Principle IV/plan.md is included as its own task.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/backend/src/` (NestJS), `apps/frontend/src/app/` (Angular),
`libs/observability/src/lib/` (new library, this feature), `libs/api-contract/src/lib/` (shared
DTOs/types).

---

## Phase 1: Setup

**Purpose**: Scaffold the new `libs/observability` library so subsequent phases have somewhere to
add files.

- [ ] T001 Generate the `observability` Nx library via `npm exec nx g @nx/js:lib observability --directory=libs/observability --unitTestRunner=jest --bundler=none` (or the workspace's standard lib generator per the `nx-generate` skill), then delete its generated placeholder source file, keeping only `project.json`, `tsconfig*.json`, `jest.config.ts`, and an empty `src/index.ts`
- [ ] T002 Confirm the new library resolves as `@vaultfolio/observability` (check `tsconfig.base.json`'s path mapping, matching the convention used by `@vaultfolio/domain`, `@vaultfolio/export`) and add it to `apps/backend`'s `tsconfig.app.json`/`project.json` implicit dependencies if the generator didn't wire it automatically

**Checkpoint**: `npm exec nx build observability` succeeds on an empty library before any feature code is added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The additive contract type, the correlation/context primitives, and the sanitisers
that every user story's interceptor/filter/exception code depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Add the additive `ErrorResponse` interface (`error`, `message`, `correlationId`, optional `details`) in `libs/api-contract/src/lib/error-response.ts` per [contracts/error-response.md](./contracts/error-response.md), and export it from `libs/api-contract/src/index.ts`
- [ ] T004 [P] Implement `correlation-id.util.ts` in `libs/observability/src/lib/context/correlation-id.util.ts`: accept `X-Correlation-Id` (primary) or `x-request-id` (fallback) if present and a syntactically valid UUID, else generate one via `crypto.randomUUID()`, per [data-model.md](./data-model.md#correlationreference-identifier)
- [ ] T005 [P] Implement `request-context.service.ts` in `libs/observability/src/lib/context/request-context.service.ts`: an `AsyncLocalStorage`-backed `RequestContextService` exposing `run(context, callback)`, `getCorrelationId()`, and `getUserId()`, per [research.md](./research.md#decision-correlation-context-propagation-mechanism)
- [ ] T006 [P] Implement `log-value-sanitiser.ts` in `libs/observability/src/lib/utils/log-value-sanitiser.ts`: strip newlines/control characters and cap length on any externally sourced string before it is logged (FR-009)
- [ ] T007 [P] Implement `sensitive-data-sanitiser.ts` in `libs/observability/src/lib/utils/sensitive-data-sanitiser.ts`: redact `Authorization`, `Cookie`, and other configured sensitive headers, and ensure request bodies are never passed through to a log call (FR-010)
- [ ] T008 [P] Implement the abstract `business.exception.ts` base class in `libs/observability/src/lib/exceptions/business.exception.ts` (extends `HttpException`, accepts `{ error, message, details? }` and a fixed HTTP status per subclass)
- [ ] T009 [P] Unit test `correlation-id.util.spec.ts` alongside T004: valid inbound UUID reused, malformed/absent → generated, `x-request-id` fallback used only when `X-Correlation-Id` is absent
- [ ] T010 [P] Unit test `request-context.service.spec.ts` alongside T005: context values are isolated per async execution and unset outside `run()`
- [ ] T011 [P] Unit test `log-value-sanitiser.spec.ts` alongside T006: newline/control-char stripping and length capping
- [ ] T012 [P] Unit test `sensitive-data-sanitiser.spec.ts` alongside T007: `Authorization`/`Cookie` redaction, request body never included

**Checkpoint**: Foundation ready — `libs/api-contract`'s additive type exists, and every primitive
the interceptor/filter/exception classes need (T013+) is implemented and unit-tested.

---

## Phase 3: User Story 1 - Trace a reported error back to its cause (Priority: P1) 🎯 MVP

**Goal**: Every backend error response carries a reference identifier (correlation ID) that also
appears on the matching backend log entry, reusing a client-supplied tracing header when valid.

**Independent Test**: Trigger any backend error and confirm the error response carries a reference
identifier that also appears on the corresponding backend log entry, matchable without any other
information (see [quickstart.md](./quickstart.md#scenario-1--correlation-id-round-trip-and-log-lookup-us1-sc-001-sc-002)).

### Implementation for User Story 1

- [ ] T013 [US1] Implement `global-exception.filter.ts` in `libs/observability/src/lib/filters/global-exception.filter.ts`: catch every thrown error, build the `ErrorResponse` body (`error`, `message`, `correlationId` from `RequestContextService`, optional `details`), set the `X-Correlation-Id` response header, and wrap its own body in a `try/catch` so a bug in the filter itself falls back to a plain 500 `ErrorResponse` (FR-002, FR-003, FR-015; per [contracts/error-response.md](./contracts/error-response.md))
- [ ] T014 [US1] Unit test `global-exception.filter.spec.ts` alongside T013: correlation ID present on every error response and matches what was set on the request context; malformed inbound header never reflected back; a thrown error inside the filter's own body-building logic still yields a valid generic `ErrorResponse`
- [ ] T015 [US1] Implement `request-logging.interceptor.ts` in `libs/observability/src/lib/interceptors/request-logging.interceptor.ts`: on request entry, generate/accept the correlation ID (T004) and populate `RequestContextService` (T005) with correlation ID and, when authenticated, `userId`, before the handler runs (FR-001)
- [ ] T016 [US1] Implement `observability.module.ts` in `libs/observability/src/lib/observability.module.ts`: register `RequestLoggingInterceptor` via `APP_INTERCEPTOR` and `GlobalExceptionFilter` via `APP_FILTER`, and export it plus every public exception/interface from `libs/observability/src/index.ts`
- [ ] T017 [US1] Wire `ObservabilityModule` into `apps/backend/src/app/app.module.ts`'s `imports` array
- [ ] T018 [US1] Integration test in `apps/backend/src/tests/` (matching this app's existing e2e/integration test location) asserting: an unhandled exception on any real endpoint produces an `ErrorResponse` body with a `correlationId`, the `X-Correlation-Id` response header round-trips a supplied valid UUID unchanged, and a malformed supplied header results in a freshly generated (different) UUID rather than being reflected back — per [contracts/error-response.md](./contracts/error-response.md) and [quickstart.md](./quickstart.md#scenario-1--correlation-id-round-trip-and-log-lookup-us1-sc-001-sc-002)
- [ ] T019 [US1] Confirm `GET /health` (`apps/backend/src/health/health.controller.ts`) is unaffected — it never throws, so `GlobalExceptionFilter` never intercepts it; add/verify a test asserting its response shape is unchanged after `ObservabilityModule` is wired in (FR-017)

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — every
error response carries a correlation ID that also appears in the matching log entry.

---

## Phase 4: User Story 2 - Diagnose and monitor system health from logs alone (Priority: P1)

**Goal**: Every request produces structured lifecycle log lines with severity that distinguishes
routine client-caused failures from unexpected system failures, and process-level failures outside
any request are also captured.

**Independent Test**: Send a mix of successful requests, expected client-caused failures, and a
forced unexpected server failure, then confirm the logs alone show outcome, timing, and a severity
level that correctly separates routine from unexpected failures (see
[quickstart.md](./quickstart.md#scenario-2--lifecycle-logging-and-severity-classification-us2-sc-003)).

### Implementation for User Story 2

- [ ] T020 [US2] Extend `request-logging.interceptor.ts` (`libs/observability/src/lib/interceptors/request-logging.interceptor.ts`, built in T015) to log `"Incoming Request"` on entry and exactly one of `"Request Completed"` / `"Request Failed"` on exit via the injected `JsonLoggerService`, including method, path (sanitised via T006), duration, status code, correlation ID, and `userId` when authenticated — omitted entirely when not (FR-004; per [data-model.md](./data-model.md#requestlogentry))
- [ ] T021 [US2] Wrap the interceptor's logging calls (T020) in their own `try/catch` so a logging failure never breaks the request/response cycle (FR-015)
- [ ] T022 [US2] Implement the severity classification rule in `global-exception.filter.ts` (built in T013): any `HttpException` with status < 500 → WARN, status ≥ 500 or a non-`HttpException` (unhandled) → ERROR, and log the failure (including full stack trace, server-side only) via `JsonLoggerService` at that severity (FR-005, FR-006; per [data-model.md](./data-model.md#categorizedfailure-businessexception-hierarchy))
- [ ] T023 [P] [US2] Implement `suppress-request-logging.decorator.ts` in `libs/observability/src/lib/decorators/suppress-request-logging.decorator.ts` (`@SuppressRequestLogging()`), read by the interceptor (T020) to skip lifecycle logging for an annotated route — not applied to any route by this feature, but available without further design work (per [data-model.md](./data-model.md#requestlogentry))
- [ ] T024 [US2] Unit test `request-logging.interceptor.spec.ts` alongside T020: one `"Incoming Request"` and exactly one `"Request Completed"`/`"Request Failed"` line per request; `userId` present only when authenticated; a forced logging failure does not propagate to the caller
- [ ] T025 [US2] Add process-level handlers in `apps/backend/src/main.ts`: `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)`, each logging via the bootstrap `JsonLoggerService` instance so background/process-level failures are captured rather than silently lost (FR-016)
- [ ] T026 [US2] Integration test extending T018's suite (or a new test in `apps/backend/src/tests/`) asserting: a successful request logs at `"log"` severity, a client-caused failure (e.g. invalid input) logs at `"warn"`, and a forced unexpected server error logs at `"error"` with a stack trace present in the log line but absent from the response body — per [quickstart.md](./quickstart.md#scenario-2--lifecycle-logging-and-severity-classification-us2-sc-003)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — every request is
logged with correct severity, and process-level failures are captured.

---

## Phase 5: User Story 3 - See a helpful message instead of a broken screen (Priority: P2)

**Goal**: The frontend shows a generic, non-blocking notification (with the correlation ID) for
any backend or in-app error a screen doesn't already handle specifically, without altering any
existing specific error handling.

**Independent Test**: Force an error no part of the app currently handles explicitly and confirm a
generic, dismissible notification appears, while existing handled error cases continue to show
their existing specific messages unaffected (see
[quickstart.md](./quickstart.md#scenario-3--frontend-fallback-notification-us3-sc-006)).

### Implementation for User Story 3

- [ ] T027 [US3] Implement `http-error.interceptor.ts` in `apps/frontend/src/app/core/http-error.interceptor.ts`: an `HttpInterceptorFn` registered after `authInterceptor` that, for any HTTP error not already resolved by a component's own `catchError`, reads `correlationId` off the `ErrorResponse` body (when present) and shows a generic PrimeNG `MessageService` toast (e.g. "Something went wrong (ref: …)") (FR-011, FR-013; per [research.md](./research.md#decision-frontend-fallback-error-handling-architecture))
- [ ] T028 [US3] Implement `global-error-handler.ts` in `apps/frontend/src/app/core/global-error-handler.ts`: an Angular `ErrorHandler` implementation (`GlobalErrorHandler`) that catches uncaught in-app exceptions, logs them in a structured shape to `console.error`, and shows a non-blocking `MessageService` toast rather than leaving the page unresponsive (FR-014)
- [ ] T029 [US3] Register both in `apps/frontend/src/app/app.config.ts`: add `httpErrorInterceptor` to `withInterceptors([authInterceptor, httpErrorInterceptor])`, and add `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` to the `providers` array
- [ ] T030 [P] [US3] Unit test `http-error.interceptor.spec.ts` alongside T027: an error already handled by a component's own `catchError` never reaches the toast; an unhandled error shows the toast with the response's `correlationId`; an error response with no `correlationId` still shows the generic toast without it
- [ ] T031 [P] [US3] Unit test `global-error-handler.spec.ts` alongside T028: an uncaught error is logged and triggers a toast rather than propagating further
- [ ] T032 [US3] `verify-ui` pass (per the `verify-ui` skill) driving the running frontend with Playwright: force an unhandled backend failure and confirm the fallback toast renders with the correlation ID; trigger an existing specifically-handled failure (e.g. invalid invite code on the signup screen) and confirm only its existing specific message shows, not the fallback toast; force an in-app script error and confirm a non-blocking toast appears instead of a frozen/blank screen — per [quickstart.md](./quickstart.md#scenario-3--frontend-fallback-notification-us3-sc-006)

**Checkpoint**: All of User Stories 1, 2, and 3 are independently functional — the frontend safety
net is in place without touching any existing component's own error handling.

---

## Phase 6: User Story 4 - Consistent, categorized failures across every feature (Priority: P3)

**Goal**: A small, consistent set of categorized business exceptions (not found, validation
failure, conflict, access denied, external service failure, rate limit) is available and adopted
by at least the two existing ad hoc throw sites identified in research.md, with no change to
existing error information the app already relies on.

**Independent Test**: Pick two existing features that currently fail in ad hoc ways (Turnstile
bot-verification failure, the `RolesGuard` permission check) and confirm both now report through
the same categorized failure types, with no change to the error information already relied on by
the app (see
[quickstart.md](./quickstart.md#scenario-4--categorized-failures-are-consistent-across-features-us4)).

### Implementation for User Story 4

- [ ] T033 [P] [US4] Implement `resource-not-found.exception.ts` in `libs/observability/src/lib/exceptions/resource-not-found.exception.ts` (extends `BusinessException` from T008, HTTP 404)
- [ ] T034 [P] [US4] Implement `validation.exception.ts` in `libs/observability/src/lib/exceptions/validation.exception.ts` (extends `BusinessException`, HTTP 400, accepts optional `details: { field, message }[]`)
- [ ] T035 [P] [US4] Implement `conflict.exception.ts` in `libs/observability/src/lib/exceptions/conflict.exception.ts` (extends `BusinessException`, HTTP 409)
- [ ] T036 [P] [US4] Implement `access-denied.exception.ts` in `libs/observability/src/lib/exceptions/access-denied.exception.ts` (extends `BusinessException`, HTTP 403)
- [ ] T037 [P] [US4] Implement `external-service.exception.ts` in `libs/observability/src/lib/exceptions/external-service.exception.ts` (extends `BusinessException`, HTTP 502; severity ERROR per [data-model.md](./data-model.md#categorizedfailure-businessexception-hierarchy))
- [ ] T038 [P] [US4] Implement `rate-limit.exception.ts` in `libs/observability/src/lib/exceptions/rate-limit.exception.ts` (extends `BusinessException`, HTTP 429)
- [ ] T039 [P] [US4] Unit tests for each of T033–T038 (one spec file per exception class, alongside its implementation): correct HTTP status, correct severity classification when passed through `global-exception.filter.ts`'s rule (T022), and that the existing `error`/`message` fields pass through unchanged
- [ ] T040 [US4] Migrate `apps/backend/src/turnstile/turnstile.service.ts`'s three raw `HttpException` throws: the malformed/missing-token check and the siteverify-failed check → `ValidationException`/`ExternalServiceException` as appropriate (keeping the existing `bot_protection_failed` error code string via the exception's constructor), and the network/timeout catch block → `ExternalServiceException` (logging the raw upstream error internally via the existing `this.logger.error(...)` call, throwing only the safe categorized exception to the caller) — per [research.md](./research.md#current-state-gaps-verified-in-repo)
- [ ] T041 [US4] Migrate `apps/backend/src/auth/roles.guard.ts:24`'s `ForbiddenException` throw to `AccessDeniedException`, preserving the existing `{ error: 'forbidden', message: '...' }` body
- [ ] T042 [US4] Sweep `apps/backend/src/**/*.service.ts` and `apps/backend/src/**/*.guard.ts` for any other raw `throw new Error(...)` or built-in NestJS `HttpException` usage introduced since the plan was written, and convert each to the matching `BusinessException` subclass
- [ ] T043 [US4] Update/add tests for `turnstile.service.ts` and `roles.guard.ts` (T040, T041) confirming the existing `error`/`message` response values are byte-for-byte unchanged for existing callers, and that the response now additionally carries a `correlationId`

**Checkpoint**: All four user stories are independently functional. The categorized exception set
is adopted at the two known ad hoc throw sites, with existing error behavior fully preserved.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories; no new user-facing behavior.

- [ ] T044 [P] Run the full [quickstart.md](./quickstart.md) validation guide end-to-end (all four scenarios) against the running app
- [ ] T045 [P] Verify SC-007 by inspecting logs from a representative set of test requests (including at least one authenticated call with an `Authorization` header) and confirming no credential, session/auth token, or full request body ever appears in a log entry
- [ ] T046 Verify SC-005 by re-running (or spot-checking) existing frontend component tests that key off a specific known `error` code (e.g. `accounts.component.ts`, `signup.component.ts`) and confirming none required a code change to keep passing
- [ ] T047 Update the workspace's `README.md`/relevant docs (only if they document backend error-response shapes or logging conventions) to mention the new `correlationId` field and categorized exception set, via the `speckit-docs-update` skill's selective-update approach

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US1 (Phase 3) and US2 (Phase 4) share the same two files
    (`request-logging.interceptor.ts`, `global-exception.filter.ts`) — implement US1 first, since
    US2's tasks (T020–T022) extend the same files US1 creates (T013, T015). They are not
    file-parallel with each other, but US2 does not block US1's independent testability.
  - US3 (Phase 5) touches only frontend files and has no dependency on US2's or US4's tasks — it
    can start any time after Foundational + US1 (needs `correlationId` to exist in `ErrorResponse`,
    from T003).
  - US4 (Phase 6) depends on `BusinessException` (T008, Foundational) and the severity rule (T022,
    US2) to be meaningful end-to-end, but its exception classes (T033–T038) can be implemented in
    parallel with US2/US3 — only the throw-site migrations (T040–T041) benefit from T022 already
    existing so severity classification is verifiable immediately.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only. No dependency on other stories. MVP.
- **User Story 2 (P1)**: Foundational + extends US1's two files (T013, T015) in place — sequence
  after US1, but independently testable/verifiable once its own tasks land.
- **User Story 3 (P2)**: Foundational (needs `correlationId` in the `ErrorResponse` contract, T003)
  - US1 (needs a real `correlationId` on error responses to display). Frontend-only otherwise —
    fully independent of US2/US4.
- **User Story 4 (P3)**: Foundational (`BusinessException`, T008) for its own exception classes;
  benefits from, but does not strictly require, US2's severity rule (T022) to already exist before
  its throw-site migrations (T040–T041) are verified end-to-end.

### Within Each User Story

- Implementation tasks before their accompanying unit tests are written against them (Principle
  III: implement-then-test — tests are not required to precede or fail before implementation).
- Interceptor/filter/module wiring (US1) before anything that depends on `RequestContextService`
  being populated (US2's logging, US3's `correlationId` display).
- Exception classes (US4) before their throw-site migrations.

### Parallel Opportunities

- All Setup tasks (Phase 1) run sequentially (T002 depends on T001's generator output) — no [P].
- All Foundational tasks marked [P] (T003–T012) touch different files and can run in parallel.
- Once Foundational completes, US3 (Phase 5, frontend-only) can be worked in parallel with
  US2/US4 backend work by a different contributor, since it touches no backend file.
- Within US4, the six exception classes (T033–T038) and their tests (T039) are all [P] — different
  files, no dependencies among them.

---

## Parallel Example: Foundational Phase

```bash
# Launch all Foundational primitives together (different files, no dependencies):
Task: "Add the additive ErrorResponse interface in libs/api-contract/src/lib/error-response.ts"
Task: "Implement correlation-id.util.ts in libs/observability/src/lib/context/correlation-id.util.ts"
Task: "Implement request-context.service.ts in libs/observability/src/lib/context/request-context.service.ts"
Task: "Implement log-value-sanitiser.ts in libs/observability/src/lib/utils/log-value-sanitiser.ts"
Task: "Implement sensitive-data-sanitiser.ts in libs/observability/src/lib/utils/sensitive-data-sanitiser.ts"
Task: "Implement the abstract business.exception.ts base class in libs/observability/src/lib/exceptions/business.exception.ts"
```

## Parallel Example: User Story 4 exception classes

```bash
Task: "Implement resource-not-found.exception.ts (404)"
Task: "Implement validation.exception.ts (400)"
Task: "Implement conflict.exception.ts (409)"
Task: "Implement access-denied.exception.ts (403)"
Task: "Implement external-service.exception.ts (502)"
Task: "Implement rate-limit.exception.ts (429)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run [quickstart.md](./quickstart.md) Scenario 1 independently.
5. This already delivers SC-001/SC-002 — every error response is traceable to its log entry.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → validate via quickstart Scenario 1 → MVP.
3. Add User Story 2 → validate via quickstart Scenario 2 (adds full lifecycle logging/severity).
4. Add User Story 3 → validate via quickstart Scenario 3 (adds the frontend safety net).
5. Add User Story 4 → validate via quickstart Scenario 4 (adds consistent categorized failures).
6. Phase 7 Polish confirms all success criteria (SC-001–SC-008) together.

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: User Story 1 → then User Story 2 (same backend files, sequenced).
- Developer B: User Story 3 (frontend-only, independent of A's backend work once T003 lands).
- Developer C: User Story 4's exception classes (T033–T038, parallel with A/B), then the throw-site
  migrations (T040–T041) once T022 (US2) is available for verification.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- US1 and US2 share two files (`request-logging.interceptor.ts`, `global-exception.filter.ts`) by
  design — the interceptor/filter are built once and each story adds its own concern to them, per
  plan.md's single-PR-sized rollout; this is a deliberate exception to "different files" for [P],
  not an oversight.
- Every task that changes an existing throw site (T040, T041) MUST preserve the exact `error`/
  `message` values already relied on by existing frontend checks (FR-008) — verified by T043.
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently.
