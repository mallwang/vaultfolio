# Integration Plan: Logging, Error & Exception Handling for Vaultfolio

**Status**: Draft — for review before `speckit-plan` formalization.

## 1. Current-state gaps (verified in-repo)

- No global exception filter or `APP_FILTER` anywhere in `apps/backend/src` — errors are ad hoc: [turnstile.service.ts](../../apps/backend/src/turnstile/turnstile.service.ts) throws raw `HttpException` three times with a hand-rolled body; [roles.guard.ts:24](../../apps/backend/src/auth/roles.guard.ts#L24) throws NestJS's built-in `ForbiddenException` directly.
- No correlation ID anywhere — `X-Correlation-Id`/`x-request-id` are not read, generated, or echoed.
- [json-logger.service.ts](../../apps/backend/src/logger/json-logger.service.ts) already gives vaultfolio structured JSON logging (built for FR-010 / constitution Principle V) but has no request lifecycle logging, no correlation/user fields, and no severity-by-exception-class policy.
- No semantic business-exception hierarchy — every service throws NestJS built-ins or raw objects.
- Frontend has no centralized HTTP-error handling: each component (`accounts.component.ts`, `invite-dialog.component.ts`, `signup.component.ts`, …) does its own inline `catchError`/`httpError.error?.error === '...'` string check. `provideBrowserGlobalErrorListeners()` is registered in [app.config.ts](../../apps/frontend/src/app/app.config.ts) but nothing consumes uncaught errors meaningfully.

## What's already correctly in place (no work needed)

- `/health` already sets its status directly rather than throwing: [health.controller.ts](../../apps/backend/src/health/health.controller.ts) uses `@Res({passthrough:true})`, preserving `HealthStatus`. The new global filter must not touch this controller — it won't, since nothing is thrown.

## 2. Key design decisions

Vaultfolio is a **single NestJS backend + single Angular app** Nx monorepo with no internal service mesh. That shapes a few choices worth calling out up front:

| Decision                                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correlation context via Node's built-in `AsyncLocalStorage`, wrapped in a small `RequestContextService`                                                                                                     | Zero new dependency; a single app has no cross-team DI-ergonomics pressure that would justify a request-context library.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Extend the existing `JsonLoggerService` rather than swapping in a new logging library                                                                                                                       | It already gives structured JSON output and was purpose-built for this repo; replacing it would add a dependency and serializer config for a single-instance app where raw log throughput isn't a bottleneck.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Keep the existing flat error contract** `{ error: string, message: string }`, additively extend it with `correlationId` (and `details`/`source` only where a service needs field-level validation errors) | This flat shape is already live in `libs/api-contract` (`auth.ts`, `signups.ts`, `profile.ts`, `accounts.ts`, `invitations.ts`, `holdings.ts`, `account-overview.ts`) and is pattern-matched by exact string in ~6+ frontend components today (e.g. [accounts.component.ts:418](../../apps/frontend/src/app/../../libs/frontend/admin/src/lib/accounts/accounts.component.ts#L418), [signup.component.ts:99](../../apps/frontend/src/app/signup/signup.component.ts#L99)). A nested/wrapped error shape would silently break every one of those `httpError.error?.error === '...'` checks — the single biggest risk to avoid. |
| Always accept an inbound `X-Correlation-Id`/`x-request-id` if present and well-formed (UUID), else generate one; no trust-boundary check                                                                    | There is no internal service mesh or internal-service-token concept here; a lightweight format/length sanity check covers log-injection hygiene without needing trust arbitration.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Single PR-sized rollout, no per-service tracking                                                                                                                                                            | One backend app, one frontend app — no multi-service coordination needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Frontend centralized error handling                                                                                                                                                                         | Designed fresh for vaultfolio below — the backend-only gaps above are only half the picture, since the user asked for backend **and** frontend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## 3. Backend design

### 3.1 New library: `libs/observability`

Following the repo's existing per-concern lib convention (`libs/domain`, `libs/export`, `libs/notifications`) rather than an app-local `shared/` folder.

```
libs/observability/src/lib/
  interceptors/request-logging.interceptor.ts       # timing, method, path, correlation, user
  interceptors/request-logging.interceptor.spec.ts
  filters/global-exception.filter.ts                # classify + log + respond
  filters/global-exception.filter.spec.ts
  exceptions/business.exception.ts                  # abstract base (extends HttpException)
  exceptions/resource-not-found.exception.ts         # 404
  exceptions/validation.exception.ts                 # 400 (business-rule, not DTO validation)
  exceptions/conflict.exception.ts                   # 409
  exceptions/access-denied.exception.ts               # 403
  exceptions/external-service.exception.ts            # 502 (Turnstile siteverify, mailer, etc.)
  exceptions/rate-limit.exception.ts                  # 429
  interfaces/error-response.interface.ts             # ErrorResponse (flat, vaultfolio shape)
  context/request-context.service.ts                 # AsyncLocalStorage wrapper (correlationId, userId)
  context/correlation-id.util.ts                      # accept-or-generate UUID
  utils/log-value-sanitiser.ts                        # newline-strip + length-cap for header/URL values
  utils/sensitive-data-sanitiser.ts                    # redact Authorization/Cookie/etc. before logging
  decorators/suppress-request-logging.decorator.ts     # @SuppressRequestLogging()
  observability.module.ts                              # wires APP_INTERCEPTOR + APP_FILTER globally
  index.ts
```

### 3.2 Error response contract (additive, non-breaking)

```typescript
// libs/observability/src/lib/interfaces/error-response.interface.ts
export interface ErrorResponse {
  /** Existing stable machine-readable code — unchanged shape, e.g. 'bot_protection_failed'. */
  error: string;
  /** Existing human-readable message — unchanged. */
  message: string;
  /** NEW — UUID for end-to-end tracing; additive, safe for existing consumers to ignore. */
  correlationId: string;
  /** NEW, optional — only populated for field-level validation errors. */
  details?: { field: string; message: string }[];
}
```

- Existing per-domain `error:` string unions in `libs/api-contract/src/lib/*.ts` (e.g. `'bot_protection_failed' | 'account_exists' | ...`) are untouched.
- `GlobalExceptionFilter` populates `correlationId` on every error response — this is the one net-new field every existing frontend `catchError` block gains "for free," with no code change required to keep working.
- `details[]` is used only where a service currently has no structured way to report multiple field errors (e.g. DTO validation via `class-validator` `BadRequestException`).

### 3.3 Component mapping onto vaultfolio

| Component                   | Vaultfolio implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RequestLoggingInterceptor` | Logs via `JsonLoggerService` (injected as `LoggerService`), using `RequestContextService` for correlationId/userId. Three log lines per request: `Incoming Request` / `Request Completed` / `Request Failed`, each with a consistent field set (method, path, duration, correlationId, userId when authenticated).                                                                                                                                                                                                                                                                           |
| `GlobalExceptionFilter`     | Severity rule: `HttpException` with status < 500 → WARN, status ≥ 500 → ERROR, non-`HttpException` (unhandled) → ERROR. Stack traces only in server logs, never in the response body. `/health` untouched since it never throws.                                                                                                                                                                                                                                                                                                                                                             |
| Business exception classes  | Six classes (`ResourceNotFoundException`, `ValidationException`, `ConflictException`, `AccessDeniedException`, `ExternalServiceException`, `RateLimitException`), sharing an abstract `BusinessException` base. `ExternalServiceException` replaces the raw `HttpException` currently thrown in `turnstile.service.ts` for the siteverify-call-failed and timeout paths — matching the existing `this.logger.error('Turnstile siteverify network/timeout error', err)` pattern already there (log the raw upstream error internally, throw a safe external-service exception to the caller). |
| Correlation ID strategy     | `AsyncLocalStorage`-backed `RequestContextService`, populated by the interceptor at request entry. Accept `X-Correlation-Id` (primary) / `x-request-id` (fallback) if present and a valid UUID; else `crypto.randomUUID()`. Echo back via `X-Correlation-Id` response header.                                                                                                                                                                                                                                                                                                                |
| Log level assignment        | LOG (lifecycle), WARN (4xx), ERROR (5xx/unhandled).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 3.4 `main.ts` changes

Process-level handlers, since these can't be centralized in a shared module:

```typescript
process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection', reason as Error));
process.on('uncaughtException', (err) => logger.error('Uncaught Exception', err));
```

### 3.5 `app.module.ts` change

```typescript
@Module({ imports: [ObservabilityModule, DatabaseModule, ...] })
export class AppModule {}
```

`ObservabilityModule` registers `RequestLoggingInterceptor` via `APP_INTERCEPTOR` and `GlobalExceptionFilter` via `APP_FILTER` — no per-controller decoration, one line added to the existing module.

### 3.6 Migration of existing throw sites (small, since it's one app)

- `apps/backend/src/turnstile/turnstile.service.ts` — 3 raw `HttpException` throws → `ExternalServiceException`/`ValidationException` as appropriate; keeps the existing `bot_protection_failed` error code string via the exception's constructor.
- `apps/backend/src/auth/roles.guard.ts:24` — `ForbiddenException` → `AccessDeniedException`.
- Sweep the rest of `apps/backend/src/**/*.service.ts` for any other raw `throw new Error(...)` or built-in `HttpException` usage and convert (grep found none beyond these two files at the time of this plan, but re-check at implementation time since code changes between now and then).

## 4. Frontend design (vaultfolio-specific)

Goal: centralize what's currently duplicated inline in ~6+ components, without breaking their existing per-error-code branches.

### 4.1 `httpErrorInterceptor` (new, alongside existing `authInterceptor`)

`apps/frontend/src/app/core/http-error.interceptor.ts`:

- Runs **after** component-level `catchError` has a chance to handle a known error code (components already `catchError` before this would fire, since Angular interceptors wrap the whole chain — so this acts as a **fallback**, not a replacement, for unhandled/unexpected errors).
- Reads `correlationId` off the new `ErrorResponse` shape (if present) for display/telemetry (e.g. included in a generic "Something went wrong (ref: …)" toast) — makes support requests traceable back to a backend log line.
- For any error not already handled by the calling component (i.e. still propagating uncaught), shows a generic PrimeNG `MessageService` toast (matching the pattern already used in `profile.component.ts`, `accounts.component.ts`, etc.) rather than letting it vanish silently.
- Registered in `app.config.ts`: `withInterceptors([authInterceptor, httpErrorInterceptor])`.

### 4.2 `GlobalErrorHandler` (Angular `ErrorHandler`)

- Replaces/extends what `provideBrowserGlobalErrorListeners()` currently gives you (which just logs to console) — catches genuinely uncaught client-side exceptions (template errors, RxJS errors outside HTTP, etc.), logs them in a structured shape to `console.error` (or a future client-side log sink), and shows a non-blocking toast rather than a blank/broken page.
- Lives in `apps/frontend/src/app/core/global-error-handler.ts`, provided via `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` in `app.config.ts`.

### 4.3 What's explicitly _not_ built

- No frontend correlation-ID _generation_ — the backend always assigns one; the frontend only reads it back for display.
- No new toast/notification library — reuses the PrimeNG `MessageService`/`Toast` already standard in this app.

## 5. Security-hygiene pieces (general practice, kept regardless)

- `log-value-sanitiser.ts` — strip newlines/control chars and cap length on any externally sourced string (header, URL, query param) before it's embedded in a log line. Prevents log injection / forged log entries.
- `sensitive-data-sanitiser.ts` — redact `Authorization`, `Cookie`, and any configured sensitive headers before logging; never log request bodies.
- `GlobalExceptionFilter.catch()` wrapped in its own inner `try/catch` so a bug in the filter itself can't swallow the response entirely — falls back to a plain 500 with the standard `ErrorResponse` shape.
- `RequestLoggingInterceptor` log calls wrapped so a logging failure never breaks the request/response cycle.

## 6. Sequencing (single-PR-sized, since it's one app)

1. `libs/observability` — interceptor, filter, exceptions, context service, sanitisers, module. Unit tests per file.
2. Wire into `apps/backend/src/app/app.module.ts` and `main.ts`.
3. Migrate the ~2 existing raw-exception sites (`turnstile.service.ts`, `roles.guard.ts`).
4. Extend `libs/api-contract`'s error interfaces additively (`correlationId`, optional `details`) — no breaking changes to existing unions.
5. Frontend: `http-error.interceptor.ts`, `global-error-handler.ts`, register in `app.config.ts`.
6. Integration test: one end-to-end check that an unhandled exception produces the `ErrorResponse` shape with a `correlationId`, and that the header round-trips (`X-Correlation-Id` in → same value out, or a generated one if absent).
7. `verify-ui` pass on the frontend toast behavior for at least one error path (e.g. force a 500 and confirm the fallback toast renders).

## 7. Open questions for you before formalizing via speckit

- Do any _other_ apps/libs in this Nx workspace besides `apps/backend`/`apps/frontend` make outbound HTTP calls that would benefit from an "outgoing failure-only logging" pattern (i.e. logging only when a downstream call fails, not on every call)? From this scan, only `turnstile.service.ts` (Cloudflare siteverify) and `mail/mailer.service.ts` look like candidates — worth confirming before scoping that in or out.
