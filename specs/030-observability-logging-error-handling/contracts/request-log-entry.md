# Contract: Request Log Entry (stdout, JSON lines)

This is the interface the backend exposes to whoever reads its logs (an engineer, a log
aggregator) — not an HTTP contract, but a stable, documented output shape per constitution
Principle V ("debuggable from logs alone").

## Emitted by

`RequestLoggingInterceptor` (via `JsonLoggerService`), for every request reaching the backend,
with the sole exception of any route explicitly annotated `@SuppressRequestLogging()` (none by
default — see [data-model.md](../data-model.md#requestlogentry)). `GET /health` is emitted like any
other request (it is a normal request from the interceptor's point of view; only
`GlobalExceptionFilter` treats it specially, and it never fires here since `/health` never throws).

## Lines per request

Exactly one of each, in order:

1. `"Incoming Request"` — at request entry, before the handler runs.
2. Exactly one of:
   - `"Request Completed"` — handler returned normally.
   - `"Request Failed"` — handler threw; also logged by `GlobalExceptionFilter` with full
     server-side-only detail (stack trace / raw upstream error), see
     [error-response.md](./error-response.md).

## Shape

One JSON object per line (matches `JsonLoggerService`'s existing per-line format):

```json
{
  "timestamp": "2026-09-13T12:34:56.789Z",
  "level": "log",
  "context": "RequestLoggingInterceptor",
  "correlationId": "b3b3f5b2-3e0a-4c1a-9c1a-2f7e2b6a9d10",
  "method": "POST",
  "path": "/api/signups",
  "durationMs": 42,
  "statusCode": 201,
  "userId": "usr_01hxyz",
  "outcome": "completed"
}
```

- `level` is `"log"` for the lifecycle start/completion lines. On failure, the paired
  `GlobalExceptionFilter` line uses `"warn"` or `"error"` per the severity mapping in
  [data-model.md](../data-model.md#categorizedfailure-businessexception-hierarchy).
- `userId` is omitted entirely (not `null`, not `""`) when the caller is unauthenticated.
- `path` and any other externally-sourced string embedded in the line is run through
  `log-value-sanitiser.ts` first (strip newlines/control characters, cap length) so it cannot be
  used to forge or corrupt additional log lines (FR-009).
- No line emitted under this contract ever contains an `Authorization`/`Cookie` header value, a
  session/auth token, or a request body — `sensitive-data-sanitiser.ts` redacts these before any
  log call (FR-010).

## Failure isolation

A failure inside the logging call itself (e.g., a serialization error) MUST NOT propagate and MUST
NOT prevent the request/response cycle from completing normally (FR-015) — the interceptor wraps
its log calls so a logging failure is swallowed (and, where possible, logged as its own best-effort
error line) rather than surfacing to the caller.

## Verification

- SC-003 (spec.md): 100% of requests reaching the backend produce a logged outcome with a severity
  that correctly distinguishes routine client-caused failures from unexpected system failures.
- SC-007 (spec.md): no credential, session/auth token, or full request body ever appears in a log
  entry, verified by inspecting logs generated from a representative set of test requests including
  authenticated calls.
