# @vaultfolio/observability

NestJS backend library providing correlation IDs, structured request lifecycle
logging, and a categorized `BusinessException` hierarchy, wired in once via
`ObservabilityModule` in `apps/backend/src/app/app.module.ts`. See
[specs/030-observability-logging-error-handling](../../specs/030-observability-logging-error-handling/contracts/)
for the full contract.

## What it does

- **Correlation IDs**: `CorrelationIdMiddleware` reads `X-Correlation-Id` (or
  falls back to `x-request-id`) if present and a valid UUID, else generates
  one, and stores it in `RequestContextService` (`AsyncLocalStorage`-backed)
  for the lifetime of the request. It runs as Express middleware — before
  Guards — so it's populated even when a Guard rejects the request.
- **Request lifecycle logging**: `RequestLoggingMiddleware` logs one
  `"Incoming Request"` line on entry and exactly one `"Request Completed"` /
  `"Request Failed"` line on exit (via `res.on('finish')`, so it fires
  regardless of which layer — Guard, pipe, handler, or `GlobalExceptionFilter`
  — produced the response), including method, path, duration, status code,
  correlation ID, and `userId` when authenticated (omitted entirely when not).
- **Error responses**: `GlobalExceptionFilter` catches every thrown error and
  returns the additive `ErrorResponse` shape (`error`, `message`,
  `correlationId`, optional `details`) from `@vaultfolio/api-contract`,
  setting the `X-Correlation-Id` response header. Severity is classified as
  WARN for any `HttpException` with status < 500, ERROR (with full stack
  trace, server-side only) for status ≥ 500 or a non-`HttpException`.
- **`BusinessException` hierarchy**: `ResourceNotFoundException` (404),
  `ValidationException` (400), `ConflictException` (409),
  `AccessDeniedException` (403), `ExternalServiceException` (502), and
  `RateLimitException` (429) — throw the one matching the failure instead of
  a raw `HttpException`, passing `{ error, message, details? }`.
- **Sanitisers**: `sanitiseLogValue` (strips newlines/control characters and
  caps length on any externally sourced string before logging) and
  `sanitiseHeaders` (redacts `Authorization`, `Cookie`, and other configured
  sensitive headers) — request bodies are never passed to a log call at all.

## Adding a new categorized exception at a throw site

Throw the matching `BusinessException` subclass instead of a NestJS
`HttpException`/`Error`, e.g.:

```ts
throw new ValidationException({ error: 'invalid_token', message: 'Token expired.' });
```

The existing `error`/`message` values callers already rely on are preserved
byte-for-byte; `correlationId` is added automatically by
`GlobalExceptionFilter`.

## Note on `@SuppressRequestLogging()`

`suppress-request-logging.decorator.ts` exists but isn't wired into anything
yet — `RequestLoggingMiddleware` runs before Nest resolves the matched route
handler, so it can't read handler-level `Reflector` metadata the way an
interceptor could. See its doc comment for the two ways to wire it up for a
future route.
