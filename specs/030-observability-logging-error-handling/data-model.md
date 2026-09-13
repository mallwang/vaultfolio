# Phase 1 Data Model: Observability — Structured Logging & Consistent Error Handling

No persisted entities are introduced — nothing here is stored in SQLite. These are in-flight
(request-scoped or log-line) shapes only, defined as TypeScript interfaces/classes in
`libs/observability` and `libs/api-contract`.

## ErrorResponse

What a caller receives when a request fails. Additive extension of the existing shape already
live in `libs/api-contract` — no existing field is renamed, removed, or reshaped (FR-008).

| Field           | Type                                   | Required          | Notes                                                                                                                                                   |
| --------------- | -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error`         | `string`                               | yes               | Existing stable machine-readable code, unchanged (e.g. `'bot_protection_failed'`). Per-domain unions in `libs/api-contract/src/lib/*.ts` are untouched. |
| `message`       | `string`                               | yes               | Existing human-readable message, unchanged.                                                                                                             |
| `correlationId` | `string` (UUID)                        | **new**           | Populated by `GlobalExceptionFilter` on every error response (FR-002). Additive — safe for existing consumers to ignore.                                |
| `details`       | `{ field: string; message: string }[]` | **new**, optional | Only populated for field-level validation errors (e.g. DTO `class-validator` failures surfaced via `BadRequestException`/`ValidationException`).        |

Validation rules:

- `correlationId` MUST always be present and MUST be a valid UUID (either the accepted inbound
  value or a freshly generated one — see Correlation/Reference Identifier below).
- `details`, when present, MUST be non-empty; omit the field entirely rather than sending `[]`.

## RequestLogEntry

A structured record of one request's lifecycle (start, completion, or failure), written via
`JsonLoggerService`. Not persisted to a database — this is the shape of one JSON line to stdout.

| Field           | Type                         | Required | Notes                                                                                                                               |
| --------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp`     | ISO-8601 string              | yes      | Already produced by `JsonLoggerService`.                                                                                            |
| `level`         | `'log' \| 'warn' \| 'error'` | yes      | Severity — see Categorized Failure severity mapping below.                                                                          |
| `context`       | `string`                     | yes      | Existing `JsonLoggerService` context (e.g. `'RequestLoggingInterceptor'`).                                                          |
| `correlationId` | `string` (UUID)              | yes      | Shared with the matching `ErrorResponse` (FR-002); present even for successful requests.                                            |
| `method`        | `string`                     | yes      | HTTP method.                                                                                                                        |
| `path`          | `string`                     | yes      | Request path (sanitised — see `log-value-sanitiser.ts`).                                                                            |
| `durationMs`    | `number`                     | yes      | Wall-clock time from request entry to response/error.                                                                               |
| `statusCode`    | `number`                     | yes      | Final HTTP status.                                                                                                                  |
| `userId`        | `string`                     | no       | Present only when the caller is authenticated (FR-004, spec Edge Cases). Absent for anonymous requests — never a placeholder value. |
| `outcome`       | `'completed' \| 'failed'`    | yes      | Distinguishes the "Request Completed" vs. "Request Failed" log lines.                                                               |

Lifecycle: exactly one "Incoming Request" line at entry, and exactly one of "Request Completed" /
"Request Failed" at exit, per request (FR-004). A `@SuppressRequestLogging()` decorator exists to
opt a specific route out of the lifecycle lines (e.g. a high-frequency health/metrics endpoint)
without touching the interceptor itself — not applied anywhere by this feature (FR-017 keeps
`/health` untouched by not being intercepted at all, not via suppression), but available for a
future need without further design work.

## CategorizedFailure (BusinessException hierarchy)

An abstract `BusinessException` base (extends Nest's `HttpException`), with six concrete
subclasses. Each maps to a fixed HTTP status and log severity.

| Class                       | HTTP Status | Log Severity | FR-007 category                   |
| --------------------------- | ----------- | ------------ | --------------------------------- |
| `ResourceNotFoundException` | 404         | WARN         | resource not found                |
| `ValidationException`       | 400         | WARN         | business-rule validation failure  |
| `ConflictException`         | 409         | WARN         | conflicting state                 |
| `AccessDeniedException`     | 403         | WARN         | access denied                     |
| `ExternalServiceException`  | 502         | ERROR        | dependent outside-service failure |
| `RateLimitException`        | 429         | WARN         | rate limiting                     |

Each subclass's constructor accepts the existing `{ error, message }` body fields (so migrated
throw sites like `turnstile.service.ts`'s `bot_protection_failed` keep their existing `error` code
string verbatim) and optionally `details`. `ExternalServiceException` is marked ERROR (not WARN)
despite representing a "client-visible categorized failure," because its root cause is a system
dependency failing, not caller misuse — consistent with FR-005's WARN/ERROR split being about
_whose fault_ the failure is, and with FR-007's requirement that the caller still receives a safe,
generic message while full detail (the raw upstream error) stays server-side only.

General severity rule applied by `GlobalExceptionFilter` (covers built-in exceptions not yet
migrated to a `BusinessException` subclass, and any truly unhandled error):

- `HttpException` with status `< 500` → WARN.
- `HttpException` with status `>= 500`, or a non-`HttpException` (unhandled) → ERROR.

## Correlation/Reference Identifier

A UUID shared by a request's `ErrorResponse.correlationId`, its `X-Correlation-Id` response
header, and every `RequestLogEntry` line for that request.

State/derivation (not a stored entity — computed once per request by
`context/correlation-id.util.ts` and held for the request's lifetime by `RequestContextService`,
an `AsyncLocalStorage` wrapper):

1. If the inbound request carries `X-Correlation-Id` and it is a syntactically valid UUID, reuse
   it verbatim.
2. Else if it carries `x-request-id` and it is a syntactically valid UUID, reuse that.
3. Else generate a new one via `crypto.randomUUID()`.

A malformed or oversized inbound value is never trusted as-is (FR-009, spec Edge Cases) — it falls
through to generation rather than being rejected or echoed back unsanitised.

## RequestContext

Ambient per-request state, held in `AsyncLocalStorage`, populated by `RequestLoggingInterceptor`
at request entry and read by `GlobalExceptionFilter` and any service that needs it (e.g. for
logging) without explicit parameter threading.

| Field           | Type                  | Notes                                                             |
| --------------- | --------------------- | ----------------------------------------------------------------- |
| `correlationId` | `string`              | Set once per request, per Correlation/Reference Identifier above. |
| `userId`        | `string \| undefined` | Set from the authenticated request user, when present.            |

## Relationships

```text
Incoming Request
      │
      ▼
RequestContext (AsyncLocalStorage) ──sets──▶ correlationId, userId
      │
      ├──▶ RequestLogEntry ("Incoming Request")
      │
      ▼
  handler runs
      │
   ┌──┴───────────────┐
   ▼                  ▼
success            throws (BusinessException | HttpException | unhandled Error)
   │                  │
   ▼                  ▼
RequestLogEntry    GlobalExceptionFilter
("Request            │  ├─▶ classifies severity (table above)
Completed")          │  ├─▶ builds ErrorResponse { error, message, correlationId, details? }
                      │  ├─▶ RequestLogEntry ("Request Failed", full stack trace server-side only)
                      │  └─▶ sets X-Correlation-Id response header
                      ▼
                 caller receives ErrorResponse + header
```
