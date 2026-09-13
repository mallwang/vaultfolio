# ADR-003: Logging, Error & Exception Handling Strategy for Backend Services

## Decision Record

**Status**: ✅ ACCEPTED  
**Date**: 2026-04-01  
**Deciders**: Development Team, Architecture Review  
**Supersedes**: [ADR-045 (Logging Concept)](./045-logging-concept.md)  
**Superseded by**: N/A  
**Implements SDR**: N/A

> **Amended** — March 26, 2026: Updated to incorporate compliance findings from [TDR-004 (ST011 Security Compliance)](../technical/004-sfera-st011-observability-compliance.md) and [TDR-005 (REST API Guidelines Compliance)](../technical/005-rest-api-guidelines-observability-compliance.md). The error response contract, correlation ID strategy, stack trace suppression policy, and log field names have been revised to meet Siemens Xcelerator REST API Guidelines v2.5.1 (Rules [303], [304], [305]) and ST011 security requirements.

> **Amended** — April 1, 2026: Implementation decisions deferred by this ADR have been resolved by [TDR-006 (Observability Module — Open Implementation Decisions)](../technical/006-observability-module-open-decisions.md). Accepted outcomes: correlation ID propagation via `nestjs-cls` (T1), hybrid endpoint suppression with `@SuppressRequestLogging()` (T2), format-per-environment JSON logging via Pino transport (T3), Pino/`nestjs-pino` as logging library (T4), `userId` bound in `pino-http` serializer alongside `correlationId` (T5), `ClassName.methodName` context string convention (T6), outgoing failure-only logging in proxy/connector services (T7).

## Context

The Battery Passport platform comprises ten or more NestJS backend microservices that have grown independently with no shared standards for request logging, exception handling, or error response formatting.

### Current State

- Each service handles errors ad hoc — some throw raw `Error` objects, others use NestJS built-in `HttpException` directly, and some return unformatted responses inconsistently
- No shared exception hierarchy exists; semantic exceptions such as "resource not found" or "access denied" are expressed differently across services
- No request correlation IDs propagate through service calls, making distributed debugging and log aggregation impractical
- Error response shapes vary per service — consumers cannot rely on a consistent contract
- Log severity is misused (some services log all errors at `ERROR`, regardless of whether the cause is a client mistake or a server fault)

### Problem Statement

How do we provide consistent, observable, and maintainable logging and error handling across all NestJS backend microservices without duplicating implementation in every service?

Specifically:

1. How are HTTP request lifecycles logged uniformly — including timing, method, path, and correlation?
2. How are exceptions classified (business / system) and their log severity assigned appropriately?
3. How is a stable, contract-based error response format enforced across services?
4. How are correlation IDs generated, accepted, and propagated through the service mesh?

### Technical Constraints

- All backend services use NestJS; solutions must integrate with its interceptor and exception filter pipeline
- Shared cross-cutting infrastructure must live in `libs/` per the enforced module boundary rules
- Services must run independently; the shared library must introduce no runtime coupling between services
- The solution must be consumable as a NestJS module that services register in their `AppModule`
- No changes to the external API contract for successful responses; only error response shapes are standardised

## Decision

We will implement a **shared observability module** in `libs/shared` (or a dedicated `libs/observability` library) and register it across all NestJS backend microservices. The module provides four architecture components:

### Component 1 — RequestLoggingInterceptor

**Purpose**: Request lifecycle logging and performance metrics.

**Responsibilities**:

- Attach a correlation ID to every incoming request (see Component 4)
- Log each incoming request at `LOG` level with method, URL, user-agent, IP, and timestamp
- Log completed requests at `LOG` level with duration, response size, and HTTP status
- Log failed requests at `LOG` level with duration and status code (exception details are handled by the filter, not the interceptor, to prevent duplicate log entries)

**Log format** (structured JSON after the human-readable prefix):

```
[LOG] Incoming Request: GET /api/users | {"correlationId":"fe8793b2-1bf0-4d29-bf10-adcf72640ec5","userId":"user-abc","method":"GET","url":"/api/users","userAgent":"...","ip":"127.0.0.1","timestamp":"..."}
[LOG] Request Completed: GET /api/users - 45ms | {"correlationId":"fe8793b2-1bf0-4d29-bf10-adcf72640ec5","userId":"user-abc","method":"GET","url":"/api/users","duration":45,"responseSize":1024,"timestamp":"..."}
[LOG] Request Failed: POST /api/users - 12ms - 400 | {"correlationId":"fe8793b2-1bf0-4d29-bf10-adcf72640ec5","userId":"user-abc","method":"POST","url":"/api/users","duration":12,"statusCode":400,"timestamp":"..."}
```

> All externally sourced header values, URLs, and IP addresses are sanitised before being embedded in log entries (newline stripping and length capping) to prevent log injection (ST011:4010). Sensitive headers (`Authorization`, `Cookie`, etc.) are redacted (ST011:2030). Both `correlationId` and `userId` appear in every entry.

### Component 2 — GlobalExceptionFilter

**Purpose**: Exception handling, error response formatting, and severity-appropriate logging.

**Responsibilities**:

- Catch all unhandled exceptions in the NestJS pipeline
- Classify exceptions and assign log severity:
  - `HttpException` with `status < 500` → `WARN` (client error, expected)
  - `HttpException` with `status >= 500` → `ERROR` (server error, unexpected)
  - Any non-`HttpException` (unhandled) → `ERROR` (unexpected)
- Include the stack trace in `ERROR`-level log entries; omit it from `WARN`-level entries
- Return a consistent `ErrorResponse` JSON body (see Error Response Contract below)
- **Never** expose stack traces or internal error details in API responses, regardless of environment — Rule [303] makes no exception for non-production (ST011:2016)
- Include an `eventCategory` field (`SECURITY_EVENT` for 401/403, `CLIENT_ERROR` for other 4xx, `SERVER_ERROR` for 5xx) in structured log entries to enable targeted security alerting (ST011:2020)

> **Exception — `/health` endpoint:** The aggregated health controller (`GET /{service}/health`) intentionally bypasses this filter by using `@Res({passthrough: true})` to set the 503 status code directly on the Express `Response` object rather than throwing. This preserves the `HealthResponse` body — which ALB health checks and monitoring tools depend on — that the filter would otherwise replace with an `{ errors: [...] }` wrapper. See [Health Check Architecture — `/health` endpoint behaviour](../../../docs/health-check-architecture.md#get-servicehealth--aggregated-dependency-health) for the full rationale.

**Log format**:

```
[WARN]  Client Error: POST /api/users - 400 - Validation failed | {"correlationId":"fe8793b2-1bf0-4d29-bf10-adcf72640ec5","eventCategory":"CLIENT_ERROR","statusCode":400,...}
[ERROR] Server Error: GET /api/users/123 - 500 - Database connection timeout | {"correlationId":"b3cd1e90-...","eventCategory":"SERVER_ERROR","statusCode":500,...}
    at DatabaseService.connect (...)
[ERROR] Unhandled Exception: GET /api/users - 500 - Cannot read property 'id' of undefined | {"correlationId":"a1f2e3d4-...","eventCategory":"SERVER_ERROR",...}
    at UserController.getUser (...)
```

> Stack traces appear **only** in server-side log entries at `ERROR` level (never in API response bodies).

**Error Response Contract** (per Siemens REST API Guidelines Rules [304] & [305]):

```typescript
// libs/shared/src/lib/observability/interfaces/error-response.interface.ts

/** Source information for an error, identifying the erroneous field, parameter, or header. */
export interface ErrorSource {
  /** RFC 6901 JSON Pointer to the erroneous field in the request body (e.g. '/data/email'). */
  pointer?: string;
  /** Query parameter that caused the error. */
  parameter?: string;
  /** Request header that caused the error. */
  header?: string;
}

/** A single error object per Siemens REST API Guidelines Rule [305]. */
export interface SiemensErrorObject {
  /** UUID uniquely identifying this specific occurrence of the error. */
  id?: string;
  /** Application-specific error code (e.g. '0x80003033'). */
  code?: string;
  /** HTTP status code, mirroring the response status. */
  status: number;
  /** Short, stable, human-readable summary. Must not change across occurrences. */
  title: string;
  /** Human-readable description specific to this occurrence. */
  detail: string;
  /** Source information identifying the erroneous field, parameter, or header. */
  source?: ErrorSource;
  /** Links to further information about this error type. */
  links?: { about?: string };
  /** UUID for end-to-end request tracing (was 'requestId'). */
  correlationId?: string;
}

/**
 * Root error response wrapper per Siemens REST API Guidelines Rule [304].
 * The `errors` array MUST NOT be empty.
 * Fields `timestamp`, `path`, and `method` belong in server-side logs, not in API responses.
 */
export interface ErrorResponse {
  errors: SiemensErrorObject[];
}
```

Example responses:

```json
// 404 Not Found
{
  "errors": [
    {
      "status": 404,
      "title": "Not Found",
      "detail": "User with identifier '123' not found",
      "correlationId": "fe8793b2-1bf0-4d29-bf10-adcf72640ec5"
    }
  ]
}

// 400 Validation Error (one object per field — RFC 6901 JSON Pointer in source.pointer)
{
  "errors": [
    {
      "status": 400,
      "title": "Validation Error",
      "detail": "must be a valid email address",
      "source": { "pointer": "/data/email" },
      "correlationId": "fe8793b2-1bf0-4d29-bf10-adcf72640ec5"
    },
    {
      "status": 400,
      "title": "Validation Error",
      "detail": "must be at least 8 characters long",
      "source": { "pointer": "/data/password" },
      "correlationId": "fe8793b2-1bf0-4d29-bf10-adcf72640ec5"
    }
  ]
}

// 500 Server Error
{
  "errors": [
    {
      "status": 500,
      "title": "Internal Server Error",
      "detail": "An unexpected error occurred",
      "correlationId": "fe8793b2-1bf0-4d29-bf10-adcf72640ec5"
    }
  ]
}
```

### Component 3 — Custom Business Exception Classes

**Purpose**: Semantic exception types for common business scenarios that avoid raw `throw new Error()` usage.

**Available classes** (exported from the shared module):

| Class                       | HTTP Status | Use For                                               |
| --------------------------- | ----------- | ----------------------------------------------------- |
| `ResourceNotFoundException` | 404         | Entity not found by identifier                        |
| `ValidationException`       | 400         | Business-rule validation failure (not DTO validation) |
| `ConflictException`         | 409         | Unique-constraint or state-conflict violation         |
| `AccessDeniedException`     | 403         | Authorization failure                                 |
| `ExternalServiceException`  | 502         | Upstream service returned an error or timed out       |
| `RateLimitException`        | 429         | Request rate exceeded                                 |

All classes extend a common abstract `BusinessException` (which extends NestJS `HttpException`) to allow the filter to identify and handle them uniformly.

**Usage guidelines**:

```typescript
// ✅ Use semantic exception classes
throw new ResourceNotFoundException('User', userId);
throw new ValidationException('Invalid email format', ['email: must be valid']);
throw new ConflictException('User with this email already exists');
throw new AccessDeniedException('Insufficient permissions for this resource');

// Wrap external service failures
try {
  await this.externalApi.call(data);
} catch (error) {
  // Log the raw upstream error internally — never forward to the client (ST011:2016)
  this.logger.error('ExternalApiService call failed', {
    raw: (error as Error).message,
  });
  // Pass only a safe, consumer-facing reason — never raw error.message
  throw new ExternalServiceException('ExternalApiService', 'Service temporarily unavailable');
}

// ❌ Never use raw errors for business logic
throw new Error('Something went wrong');
throw new Error('Database connection failed on db-prod-01'); // exposes internals
```

**Extending for domain-specific exceptions**:

```typescript
export class PaymentProcessingException extends BusinessException {
  constructor(paymentId: string, reason: string) {
    super(`Payment ${paymentId} failed: ${reason}`, HttpStatus.PAYMENT_REQUIRED);
  }
}
```

### Component 4 — Request Correlation Strategy

**Purpose**: Assign a traceable correlation ID to every request and propagate it through logs, responses, and downstream service calls.

**ID generation priority**:

1. Accept `X-Correlation-Id` header from incoming request (primary — per Siemens REST API Guidelines)
2. Accept `x-request-id` header as legacy fallback (lower priority; retained for backward compatibility with older callers)
3. Auto-generate UUID (RFC 4122) using `crypto.randomUUID()` — no external dependency (Node.js ≥14.17)

**Propagation**:

- Attach to the request object as `request.correlationId`
- Echo back in every response via the `X-Correlation-Id` response header
- Include in every structured log entry as `correlationId` (field renamed from `requestId`)
- Include in every error object in the `errors` array as the `correlationId` field
- Propagate to downstream service calls via the `X-Correlation-Id` outbound header
- Only propagate an incoming correlation ID from requests carrying a verified internal service token; auto-generate a fresh UUID for all requests from public clients (trust boundary — ST011:3010)

### Log Level Assignment

| Level   | Use For                                                      | Alerting Strategy                                   |
| ------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `LOG`   | Normal request lifecycle (start, completion, failure timing) | Metrics / throughput dashboards only                |
| `WARN`  | Client-caused errors (4xx) including validation failures     | Pattern-based — alert if 4xx rate exceeds threshold |
| `ERROR` | Server-side errors (5xx) and unhandled exceptions            | Immediate alert to on-call                          |

### Module Registration

Each service registers the shared module in its `AppModule`:

```typescript
@Module({
  imports: [ObservabilityModule], // or SharedModule with observability feature
})
export class AppModule {}
```

The module globally applies `RequestLoggingInterceptor` via `APP_INTERCEPTOR` and `GlobalExceptionFilter` via `APP_FILTER`, so no per-controller decoration is required.

## Consequences

### Positive

- ✅ **Consistent Observability** — All services emit identically structured log entries, enabling unified log aggregation and querying
- ✅ **Distributed Tracing** — UUID correlation IDs (RFC 4122) allow end-to-end request tracing across all microservices and are natively compatible with API gateways, distributed tracing systems (e.g. AWS X-Ray, OpenTelemetry), and centralized log aggregators
- ✅ **Single Responsibility** — Request lifecycle logging and exception handling are strictly separated; no duplicate log entries
- ✅ **Appropriate Severity** — Client errors (WARN) and server errors (ERROR) are correctly classified, reducing alert noise
- ✅ **Stable API Contract** — Consumers can rely on a consistent Siemens-guideline-compliant `{ errors: [...] }` response shape from any service, with `source.pointer` for field-level validation errors
- ✅ **Semantic Exceptions** — Developers express domain intent clearly with named exception classes instead of raw errors
- ✅ **Security by Default** — Stack traces and internal error details are unconditionally suppressed in API responses regardless of environment, per Siemens REST API Guidelines Rule [303] and ST011:2016
- ✅ **Zero Service Coupling** — The shared library is consumed as a module; services remain independently deployable
- ✅ **Single Implementation** — Bug fixes in the interceptor or filter propagate to all services through the shared module

### Negative

- ⚠️ **Refactoring Effort** — All backend microservices must register the module and migrate existing ad-hoc error handling; work should be tracked per service
- ⚠️ **Shared Library Dependency** — All services take a dependency on the shared module; a breaking change to its public API requires coordinated updates
- ⚠️ **Error Response Contract Change** — The contract is a **breaking change** from the original flat shape: the new `{ errors: [...] }` structure with `SiemensErrorObject` fields (`status`, `title`, `detail`, `correlationId`, `source.pointer`) replaces all prior fields (`statusCode`, `error`, `message`, `requestId`, `details`, `timestamp`, `path`, `method`). Consumers must migrate during service rollout
- ⚠️ **NestJS Pipeline Dependency** — The interceptor relies on NestJS observables; tests that bypass the NestJS pipeline will not exercise it

### Neutral

- ℹ️ **Backward Compatibility for Successes** — Only error response shapes change; successful response bodies are untouched
- ℹ️ **Test Coverage Required** — Each service migration should include integration tests verifying the correlation ID and error response contract
- ℹ️ **Monitoring Threshold Tuning** — Alert thresholds for WARN/ERROR rates will require calibration per service after rollout
- ℹ️ **Library Placement TBD** — The exact home (`libs/shared` extension vs. new `libs/observability`) is an implementation decision deferred to the first migration

### Risks and Mitigations

| Risk                                                     | Impact                                         | Mitigation                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interceptor or filter throws during error handling       | Error swallowed, no response                   | Wrap the entire `GlobalExceptionFilter.catch()` body in a nested `try/catch`; on inner failure write a plain 500 with a compliant `{ errors: [...] }` body (ST011:2010). Wrap `RequestLoggingInterceptor` log calls in `safeLog()` so logging failures never interrupt the pipeline |
| Correlation ID header spoofed by external clients        | Misleading trace attribution (trace poisoning) | Only propagate an incoming `X-Correlation-Id` from requests carrying a verified internal service token; auto-generate a fresh UUID for all public-client requests (ST011:3010)                                                                                                      |
| Log injection via crafted header or URL values           | False log entries; broken log parsers          | Sanitise all externally sourced strings (newline strip + length cap) before embedding in log entries — `log-value-sanitiser.ts` (ST011:4010)                                                                                                                                        |
| Sensitive data leakage into logs                         | PII or credential exposure                     | Pass all loggable header maps through `sensitive-data-sanitiser.ts` before emission; never log request bodies (ST011:2030)                                                                                                                                                          |
| Performance overhead of JSON.stringify per request       | Increased latency at high throughput           | Async logging; limit payload size; consider high-volume endpoint sampling                                                                                                                                                                                                           |
| Service migrated partially (interceptor only, no filter) | Inconsistent error responses                   | Track migration per service in a Jira epic; enforce via PR checklist                                                                                                                                                                                                                |
| Consumer breaks on new error response shape              | Integration failures downstream                | The new `{ errors: [...] }` `SiemensErrorObject` shape is a breaking change from the original flat contract; publish in release notes and offer a compatibility period per consumer                                                                                                 |

## Implementation Details

The following files are expected to be created or modified when implementing this ADR (exact paths subject to the library placement decision):

### Files to Create

- `libs/shared/src/lib/observability/interceptors/request-logging.interceptor.ts` — `RequestLoggingInterceptor` implementation
- `libs/shared/src/lib/observability/interceptors/request-logging.interceptor.spec.ts` — unit tests
- `libs/shared/src/lib/observability/filters/global-exception.filter.ts` — `GlobalExceptionFilter` implementation
- `libs/shared/src/lib/observability/filters/global-exception.filter.spec.ts` — unit tests
- `libs/shared/src/lib/observability/exceptions/business.exception.ts` — abstract base class (with `title` and optional `code` fields per Rule [305])
- `libs/shared/src/lib/observability/exceptions/resource-not-found.exception.ts`
- `libs/shared/src/lib/observability/exceptions/validation.exception.ts`
- `libs/shared/src/lib/observability/exceptions/conflict.exception.ts`
- `libs/shared/src/lib/observability/exceptions/access-denied.exception.ts`
- `libs/shared/src/lib/observability/exceptions/external-service.exception.ts`
- `libs/shared/src/lib/observability/exceptions/rate-limit.exception.ts`
- `libs/shared/src/lib/observability/interfaces/error-response.interface.ts` — `ErrorSource`, `SiemensErrorObject`, and `ErrorResponse` interfaces (Rules [304] & [305] — TDR-004)
- `libs/shared/src/lib/observability/utils/correlation-id.util.ts` — UUID generation and trust-boundary-aware resolution (RFC 4122, ST011:3010 — TDR-003)
- `libs/shared/src/lib/observability/utils/sensitive-data-sanitiser.ts` — header and field redaction utilities (ST011:2030 — TDR-003)
- `libs/shared/src/lib/observability/utils/log-value-sanitiser.ts` — log injection prevention for externally sourced strings (ST011:4010 — TDR-003)
- `libs/shared/src/lib/observability/observability.module.ts` — NestJS module wiring `APP_INTERCEPTOR` and `APP_FILTER`; ST011:2035 infrastructure note in JSDoc
- `libs/shared/src/lib/observability/index.ts` — public exports

### Files to Modify (per service)

- `apps/services/<service-name>/src/app/app.module.ts` — register `ObservabilityModule`
- `apps/services/<service-name>/src/app/app.module.spec.ts` — add integration test for error response contract and correlation ID
- `apps/services/<service-name>/src/main.ts` — add `process.on('unhandledRejection')` and `process.on('uncaughtException')` bootstrap handlers (ST011:2025; cannot be centralised in the shared module)
- Remove any service-local ad-hoc error handling that is superseded by the shared module

## Alternatives Considered

### Alternative 1: No Shared Standard

**Description**: Each service continues implementing its own logging and error handling independently.

**Rejected Because**:

- Inconsistent log structures prevent unified aggregation and alerting
- No distributed tracing across services
- Every developer rediscovers the same patterns and makes different trade-offs
- Observability gaps increase as the number of services grows

### Alternative 2: APM Agent Only (Sentry / Datadog / New Relic)

**Description**: Install an application performance monitoring agent in each service and rely entirely on the APM tool for error capture and correlation, with no code changes.

**Rejected Because**:

- APM agents capture errors but do not provide a consistent HTTP error response contract for API consumers
- No semantic exception hierarchy — service code still uses raw `Error` or ad-hoc `HttpException`
- Correlation IDs are proprietary to the APM vendor, not included in response headers or bodies
- Creates vendor lock-in for observability infrastructure
- Does not address the inconsistent logging severity problem

### Alternative 3: NestJS Built-in Logger and Exception Handling Only

**Description**: Use NestJS's built-in `Logger` class and default `BaseExceptionFilter` in every service without a custom implementation.

**Rejected Because**:

- NestJS's default exception filter does not attach correlation IDs to responses or logs
- No request timing or lifecycle logging out of the box
- No semantic business exception classes — raw `HttpException` usage remains inconsistent
- Log severity is not differentiated between client errors and server errors by default
- Cannot enforce a stable error response contract without customisation anyway

### Alternative 4: Per-Service Copy-Paste Implementation

**Description**: Implement the interceptor, filter, and exception classes once in `product-passport-backend` and copy the code into each service.

**Rejected Because**:

- Bug fixes and improvements must be replicated manually across all services
- Drift between service implementations will occur over time
- Violates DRY (Don't Repeat Yourself) and the project's shared-library-first philosophy
- Module boundary rules are designed specifically to prevent this pattern

## Related Documentation

- [TDR-004: ST011 Security Compliance in the Shared Observability Module](../technical/004-sfera-st011-observability-compliance.md) — eight ST011 compliance gaps and reference implementations for the module defined by this ADR
- [TDR-005: Siemens REST API Guidelines Compliance for the Shared Observability Module](../technical/005-rest-api-guidelines-observability-compliance.md) — seven REST API guideline gaps and the compliant error contract adopted above
- [TDR-006: Observability Module — Open Implementation Decisions](../technical/006-observability-module-open-decisions.md) — resolved implementation decisions (logging library, correlation ID propagation, log format, endpoint suppression, user identity, source location, outgoing request logging)
- [Technical Decision Records](../technical/README.md)
- [Module Boundary Rules](../../../.github/instructions/frameworks/module-boundaries.md)
- [NestJS Instructions](../../../.github/instructions/frameworks/nestjs.instructions.md)
- [Coding Standards](../../../.github/instructions/standards/coding-standards.md)
- [Unit Test Standards](../../../.github/instructions/standards/unit-test-standards.md)
- [Security Standards](../../../.github/instructions/standards/security-standards.md)

## References

- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Custom Providers (APP_FILTER, APP_INTERCEPTOR)](https://docs.nestjs.com/fundamentals/custom-providers)
- [Siemens Xcelerator REST API Guidelines v2.5.1 — Error Reporting](https://developer.siemens.com/guidelines/api-guidelines/rest/error.html) — Rules [301], [303], [304], [305]
- [Siemens Xcelerator REST API Guidelines v2.5.1 — Best Practices: Correlation IDs](https://developer.siemens.com/guidelines/api-guidelines/rest/best-practices.html#generating-correlation-ids)
- [Siemens ST011 — Secure Software Development v1.1.1 (SFeRA)](https://sfera.siemens.com)
- [RFC 6901 — JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901) — `source.pointer` format
- [RFC 4122 — UUID](https://www.rfc-editor.org/rfc/rfc4122) — correlation ID format
- [Structured Logging Best Practices — Datadog](https://www.datadoghq.com/blog/structured-logging/)
- [W3C Trace Context — Correlation Headers](https://www.w3.org/TR/trace-context/)
- [OWASP Log Injection](https://owasp.org/www-community/attacks/Log_Injection)
