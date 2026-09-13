# Contract: Backend Error Response & Correlation Header

This is the interface the backend exposes to every caller (the frontend, and any future API
consumer) for a failed request. It is an additive extension of the API contract already in force
across every endpoint in `apps/backend` — no existing endpoint's success-path contract changes.

## Applies to

Every backend endpoint that can return an error, with one explicit exception: `GET /health`, which
never throws and is therefore never touched by `GlobalExceptionFilter` (FR-017) — its contract is
unchanged and out of scope here.

## Response headers (all responses, success or failure)

| Header             | Value                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Correlation-Id` | The request's correlation ID (UUID) — either the inbound value that was accepted, or a freshly generated one. Present on every response, not only error responses, so client tooling can capture it unconditionally. |

## Error response body

On any failure, the response body is JSON matching:

```typescript
interface ErrorResponse {
  /** Existing stable machine-readable code — unchanged shape, e.g. 'bot_protection_failed'. */
  error: string;
  /** Existing human-readable message — unchanged. */
  message: string;
  /** UUID for end-to-end tracing; matches X-Correlation-Id and the backend's own log entry. */
  correlationId: string;
  /** Present only for field-level validation errors. */
  details?: { field: string; message: string }[];
}
```

- HTTP status code follows the categorized failure's fixed mapping (see
  [data-model.md](../data-model.md#categorizedfailure-businessexception-hierarchy)), or the
  original framework-assigned status for anything not yet migrated to a `BusinessException`
  subclass.
- `error` and `message` retain every value already relied on by existing frontend code today —
  this contract adds fields, it does not rename, remove, or restructure any existing one (FR-008).
  Every existing per-domain error union in `libs/api-contract/src/lib/*.ts` (e.g. `'account_exists'`,
  `'bot_protection_failed'`) stays exactly as-is.
- `correlationId` is always present and always a valid UUID — this is the one field every existing
  consumer gains "for free" without needing a code change to keep working.
- The response body NEVER contains a stack trace, a raw internal exception message, or raw
  third-party (e.g. Cloudflare Turnstile) error text (FR-006, FR-007). That detail is written only
  to the matching server-side log entry, findable via the same `correlationId`.

## Request header accepted (optional, client → backend)

| Header                                                    | Accepted format | Behavior                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `X-Correlation-Id` (primary) or `x-request-id` (fallback) | UUID            | If present and a syntactically valid UUID, reused verbatim as the response's `correlationId`/`X-Correlation-Id`. If absent, malformed, or otherwise not a valid UUID, it is ignored and the backend generates a new UUID instead — never rejected as an error, never echoed back unsanitised (FR-009). |

## Compatibility guarantee

- Every field name and meaning already used by an existing caller is preserved (FR-008); this
  contract change requires no update to any existing frontend `catchError`/`httpError.error?.error
=== '...'` check to keep working.
- New fields (`correlationId`, `details`) are additive only and MAY be safely ignored by any caller
  that does not yet read them.

## Verification

- One backend integration test (Phase 2/implementation) exercises this contract end-to-end: an
  unhandled exception produces a body matching `ErrorResponse` with a `correlationId`, and the
  `X-Correlation-Id` header round-trips (an inbound valid UUID comes back unchanged; an absent one
  comes back as a freshly generated UUID).
- SC-001 and SC-004 (spec.md) are the acceptance-level statements of this contract: every error
  response across 100% of endpoints carries a matching `correlationId`, and no response body ever
  contains internal/third-party technical detail.
