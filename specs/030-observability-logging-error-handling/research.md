# Phase 0 Research: Observability — Structured Logging & Consistent Error Handling

All Technical Context items were resolvable from in-repo evidence; there are no outstanding
`NEEDS CLARIFICATION` markers. Findings below are grouped by decision area.

## Current-state gaps (verified in-repo)

- No global exception filter or `APP_FILTER` anywhere in `apps/backend/src` — errors are ad hoc:
  [turnstile.service.ts](../../apps/backend/src/turnstile/turnstile.service.ts) throws raw
  `HttpException` three times with a hand-rolled body; [roles.guard.ts:24](../../apps/backend/src/auth/roles.guard.ts#L24)
  throws NestJS's built-in `ForbiddenException` directly.
- No correlation ID anywhere — `X-Correlation-Id`/`x-request-id` are not read, generated, or
  echoed.
- [json-logger.service.ts](../../apps/backend/src/logger/json-logger.service.ts) already gives
  vaultfolio structured JSON logging (built for FR-010/constitution Principle V) but has no request
  lifecycle logging, no correlation/user fields, and no severity-by-exception-class policy.
- No semantic business-exception hierarchy — every service throws NestJS built-ins or raw objects.
- Frontend has no centralized HTTP-error handling: each component (`accounts.component.ts`,
  `invite-dialog.component.ts`, `signup.component.ts`, …) does its own inline
  `catchError`/`httpError.error?.error === '...'` string check.
  `provideBrowserGlobalErrorListeners()` is registered in
  [app.config.ts](../../apps/frontend/src/app/app.config.ts) but nothing consumes uncaught errors
  meaningfully — it only logs to the console.

## Already correctly in place (no work needed)

- `/health` already sets its status directly rather than throwing:
  [health.controller.ts](../../apps/backend/src/health/health.controller.ts) uses
  `@Res({ passthrough: true })`, preserving `HealthStatus`. The new global filter never touches
  this controller, since nothing is ever thrown there (verified — FR-017).

## Decision: Correlation-context propagation mechanism

- **Decision**: Node's built-in `AsyncLocalStorage`, wrapped in a small `RequestContextService`.
- **Rationale**: Zero new dependency; a single-backend app has no cross-team DI-ergonomics pressure
  that would justify a request-context library (e.g., `nestjs-cls`). `AsyncLocalStorage` is part of
  Node's standard library and already the idiomatic NestJS pattern for per-request context without
  parameter threading.
- **Alternatives considered**: A DI-scoped (`REQUEST`-scoped) provider — rejected because
  request-scoped providers force the entire injection graph touching them into request scope,
  which measurably hurts NestJS startup/DI performance; `AsyncLocalStorage` avoids this entirely.
  A dedicated request-context npm package — rejected as an unjustified dependency for a
  single-instance app (Principle V: YAGNI).

## Decision: Logging mechanism

- **Decision**: Extend the existing `JsonLoggerService` rather than introducing a new logging
  library (e.g., Pino, Winston).
- **Rationale**: It already gives structured JSON output to stdout and was purpose-built for this
  repo (constitution Principle V / FR-010). Replacing it would add a dependency and serializer
  configuration for a single-instance app where raw log throughput is not a bottleneck.
- **Alternatives considered**: Pino (fastest JSON logger, but adds a dependency and a
  NestJS-adapter layer for no measurable benefit at this app's scale); Winston (heavier, more
  configuration surface than needed). Both rejected per Principle V's simplicity mandate.

## Decision: Error-response contract shape

- **Decision**: Keep the existing flat error contract `{ error: string, message: string }`;
  additively extend it with `correlationId: string` and, only where a service needs field-level
  validation errors, `details?: { field: string; message: string }[]`.
- **Rationale**: This flat shape is already live in `libs/api-contract` (`auth.ts`, `signups.ts`,
  `profile.ts`, `accounts.ts`, `invitations.ts`, `holdings.ts`, `account-overview.ts`) and is
  pattern-matched by exact string in 6+ frontend components today (e.g.
  `accounts.component.ts:418`, `signup.component.ts:99`). A nested/wrapped error shape (e.g.
  RFC 7807 `application/problem+json`) would silently break every one of those
  `httpError.error?.error === '...'` checks — the single biggest risk to avoid, and directly
  prohibited by FR-008.
- **Alternatives considered**: RFC 7807 Problem Details — rejected as a breaking shape change for
  this codebase's existing callers, even though it's a common industry convention; NestJS's default
  `{ statusCode, message, error }` shape — rejected, it's what the app already deviates from
  intentionally to keep a stable `error` code field.

## Decision: Correlation ID acceptance policy

- **Decision**: Always accept an inbound `X-Correlation-Id` (primary) or `x-request-id` (fallback)
  header if present and a syntactically valid UUID; otherwise generate one with
  `crypto.randomUUID()`. No trust-boundary/internal-service-token check.
- **Rationale**: There is no internal service mesh or internal-service-token concept in this
  single-backend system; a lightweight format/length sanity check covers log-injection hygiene
  (FR-009) without needing trust arbitration between "internal" and "external" callers.
- **Alternatives considered**: Trusting the header unconditionally — rejected, violates FR-009 (a
  malformed/oversized header could otherwise be logged verbatim, enabling log forgery). Rejecting
  the request outright on a malformed ID — rejected, spec's Edge Cases explicitly call for silently
  generating a new one instead of surfacing an error to the caller.

## Decision: Frontend fallback error handling architecture

- **Decision**: A new `httpErrorInterceptor` (Angular `HttpInterceptorFn`, registered after
  `authInterceptor`) as a _fallback_ for HTTP errors no component's own `catchError` consumes, plus
  a `GlobalErrorHandler` (`ErrorHandler`) for in-app uncaught exceptions, both showing a PrimeNG
  `MessageService` toast.
- **Rationale**: Angular interceptors observe every response including ones a component later
  handles with `catchError`; ordering an interceptor as a fallback (rather than a replacement) for
  component-level handling requires per-response tracking of whether a component's own
  `catchError` will run. The design here relies on Angular's `HttpClient` error propagation: a
  component's `catchError` that fully handles an error (i.e., does not re-throw) prevents that
  error from ever reaching global subscribers of the same observable chain, so the interceptor only
  ever sees errors a component did _not_ itself resolve into a handled UI branch — no explicit
  "already handled" flag is needed. This matches the existing PrimeNG `MessageService`/`Toast`
  pattern already standard in this app (`profile.component.ts`, `accounts.component.ts`), so no new
  UI library is introduced.
- **Alternatives considered**: A shared `catchError` operator that components must opt into —
  rejected, requires every existing component to be touched (violates the "no code change required
  to keep working" requirement, FR-008/FR-012). RxJS `retry`/global `HttpClient` config hacks to
  detect "unhandled" status — rejected as unnecessarily complex; Angular's normal
  subscribe/`catchError` semantics already provide the needed behavior for free.

## Decision: Business exception set and severity mapping

- **Decision**: Six `BusinessException` subclasses (`ResourceNotFoundException` 404,
  `ValidationException` 400, `ConflictException` 409, `AccessDeniedException` 403,
  `ExternalServiceException` 502, `RateLimitException` 429). Severity: any `HttpException` with
  status < 500 → WARN; status ≥ 500 or a non-`HttpException` (unhandled) → ERROR.
- **Rationale**: Matches FR-007's required set exactly (not found, validation, conflict, access
  denied, external service, rate limit) and FR-005's requirement that expected/client-caused
  failures log at lower severity than unexpected ones — a pure status-code-driven rule is the
  simplest and most auditable way to satisfy that without per-exception-type special-casing.
- **Alternatives considered**: A severity field explicitly set per exception instance — rejected as
  redundant complexity; HTTP status code already unambiguously encodes "expected client failure"
  vs. "unexpected system failure" for every case in scope.

## Open item carried forward (non-blocking)

- Whether other outbound integrations besides `turnstile.service.ts` (Cloudflare siteverify) and
  `mail/mailer.service.ts` would benefit from the same "external-service failure" categorization is
  explicitly out of the fixed scope of this feature (per spec Assumptions) and is left for
  discovery during implementation — it does not block Phase 1 design, since `ExternalServiceException`
  is a general-purpose class any future call site can adopt without further design work.
