# TDR-004: ST011 Security Compliance in the Shared Observability Module

## Decision Record

**Status**: ✅ ACCEPTED  
**Date**: 2026-04-01  
**Deciders**: Development Team  
**Supersedes**: N/A  
**Superseded by**: N/A  
**Implements SDR**: N/A

## Context

### Current State

ADR-003 defines a shared `ObservabilityModule` in `libs/shared` (or `libs/observability`) that provides `RequestLoggingInterceptor`, `GlobalExceptionFilter`, business exception classes, and a request correlation strategy. A cross-reference review of the ADR against the Siemens **ST011 — Secure Software Development** policy (v1.1.1, retrieved from SFeRA) identified eight compliance gaps across four ST011 rule groups.

### Problem Statement

ADR-003 defines the structure of the observability module but does not address the specific ST011 security requirements the module implementation must satisfy. Without a dedicated record, developers implementing the module may unknowingly leave security-relevant behaviour incomplete — leading to audit failures, log data leakage, or undetected authentication anomalies in production.

### Constraints

- All mitigations must be implemented inside `libs/shared` or `libs/observability` per the enforced module boundary rules; no per-service duplication is permitted
- The implementation must remain NestJS-idiomatic (interceptors, filters, providers, middleware)
- Changes must not alter the external API contract for successful responses (ADR-003 constraint)
- Reference implementations are in TypeScript; no additional runtime dependencies may be introduced unless explicitly justified
- The `process.on` bootstrap handlers for ST011:2025 are an exception: they must be added per-service in `main.ts`

## Options

### Option A: Centralised — all ST011 gaps addressed inside the shared ObservabilityModule

Implement every ST011 mitigation as an integral part of the shared `ObservabilityModule`. Services receive full compliance automatically by importing the module.

#### Pros

| #   | Pro                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------- |
| A1  | **Zero per-service effort** — Once the module is updated, every service that imports it automatically gains compliance |
| A2  | **Single enforcement point** — ST011 controls cannot be accidentally omitted by individual developers                  |
| A3  | **Consistent audit surface** — All services produce identically structured, compliant log entries                      |
| A4  | **Aligned with ADR-003** — No new structural decisions required; extends the already-approved design                   |
| A5  | **Single test suite** — ST011 behaviour is unit-tested once in the shared library, not duplicated across services      |

#### Cons

| #   | Con                                                                                                |
| --- | -------------------------------------------------------------------------------------------------- |
| A6  | **Shared library update required** — All services must consume the updated module version          |
| A7  | **Wider blast radius** — A defect in the shared implementation affects all services simultaneously |

### Option B: Per-service — each team applies ST011 mitigations independently

Each service owner reads the ST011 gaps and applies mitigations locally, without centralising them in the shared library.

#### Pros

| #   | Pro                                                                                              |
| --- | ------------------------------------------------------------------------------------------------ |
| B1  | **No shared library coupling** — Services are independently responsible for their own compliance |
| B2  | **No coordinated release required** — Teams can apply at their own pace                          |

#### Cons

| #   | Con                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| B3  | **Violates ADR-003** — ADR-003 explicitly rejects per-service copy-paste (Alternative 4); this option directly contradicts the accepted ADR |
| B4  | **Compliance drift guaranteed** — Implementation quality will vary across teams; some services will miss rules                              |
| B5  | **No audit guarantee** — No single test demonstrates that all services satisfy ST011 requirements                                           |
| B6  | **Multiplied maintenance cost** — Bug fixes must be replicated manually across all services                                                 |

## Comparison

| Criterion                    | Option A: Centralised            | Option B: Per-service           |
| ---------------------------- | -------------------------------- | ------------------------------- |
| ST011 compliance guarantee   | ✅ Enforced by module            | ❌ Best-effort per team         |
| Alignment with ADR-003       | ✅ Fully aligned                 | ❌ Contradicts ADR-003          |
| Developer effort per service | ✅ None — module import only     | ❌ High — per-service work      |
| Blast radius of a bug        | ⚠️ All services simultaneously   | ✅ Isolated to one service      |
| Test coverage                | ✅ Centralised in shared library | ❌ Must be repeated per service |
| Auditability                 | ✅ Single source of truth        | ❌ Fragmented                   |

## Decision

> **Option A is adopted. All eight ST011 compliance gaps are implemented centrally inside the shared ObservabilityModule.**

**Recommendation:** Implement all mitigations in the next iteration of `libs/shared/src/lib/observability` (or `libs/observability`) as part of the ADR-003 rollout. Each rule gap is detailed below with its reference implementation.

## ST011 Rule Gap Analysis and Reference Implementations

### Rule ST011:2010 — Fail Secure

| Field                   | Detail                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Fail secure.                                                                                                                                                                                                                                               |
| **Coverage in ADR-003** | Partial — the try/catch fallback for `GlobalExceptionFilter` is mentioned only in the Risks table, not as a first-class design requirement.                                                                                                                |
| **Gap**                 | If `GlobalExceptionFilter.catch()` itself throws, no response is sent to the client (hanging request or crash). `RequestLoggingInterceptor` is also silent on what occurs if its logging call fails.                                                       |
| **Recommendation**      | Wrap the entire body of `GlobalExceptionFilter.catch()` in a try/catch; on inner failure write a plain 500 immediately. In `RequestLoggingInterceptor`, wrap logging calls in a silent try/catch so logging failures never interrupt the request pipeline. |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/filters/global-exception.filter.ts

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      this.handleException(exception, host);
    } catch {
      // ST011:2010 — Fail secure: if error handling itself throws, return a plain 500
      const response = host.switchToHttp().getResponse<Response>();
      if (!response.headersSent) {
        response.status(500).json({ statusCode: 500, message: 'An unexpected error occurred' });
      }
    }
  }

  private handleException(exception: unknown, host: ArgumentsHost): void {
    // ... main implementation
  }
}
```

```typescript
// libs/shared/src/lib/observability/interceptors/request-logging.interceptor.ts

/**
 * Safe logging wrapper — a logging failure must never interrupt the request pipeline.
 * ST011:2010 — Fail secure.
 */
private safeLog(level: 'log' | 'warn' | 'error', message: string, context?: object): void {
  try {
    this.logger[level](message, context ? JSON.stringify(context) : '');
  } catch {
    // Suppress silently — logging errors must not propagate to the caller
  }
}
```

### Rule ST011:2016 — Prevent Disclosure of Internal Information Through Error or Debug Messages

| Field                   | Detail                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Prevent disclosure of internal information through error or debug messages.                                                                                                                                                                  |
| **Coverage in ADR-003** | Well addressed for HTTP error responses (`stack` and `originalError` stripped in production). One gap remains in usage guidelines.                                                                                                           |
| **Gap**                 | The `ExternalServiceException` usage example passes `error.message` directly from a caught upstream exception. Raw upstream messages can contain internal hostnames, connection strings, database names, or query fragments.                 |
| **Recommendation**      | Document and enforce in the class JSDoc that the `safeReason` parameter must be a consumer-safe string — never the raw upstream `error.message`. Log the raw error server-side at `ERROR` level; expose only a sanitised summary externally. |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/exceptions/external-service.exception.ts

/**
 * Thrown when an upstream or external service call fails.
 *
 * @param serviceName - The name of the external service (safe to expose externally).
 * @param safeReason  - A consumer-safe description of the failure.
 *                      NEVER pass raw `error.message` from a caught upstream error —
 *                      it may contain internal hostnames, query strings, or credentials.
 *                      Log the raw error server-side; pass only a sanitised summary here.
 *                      ST011:2016 — Prevent disclosure of internal information.
 */
export class ExternalServiceException extends BusinessException {
  constructor(serviceName: string, safeReason: string) {
    super(`External service '${serviceName}' failed: ${safeReason}`, HttpStatus.BAD_GATEWAY);
  }
}
```

```typescript
// Correct usage pattern in a service

try {
  await this.paymentApi.charge(payload);
} catch (error) {
  // Log the raw upstream error internally — never forward to the client
  this.logger.error('PaymentApi call failed', { raw: (error as Error).message });

  // Pass only a sanitised, consumer-safe reason to the exception
  throw new ExternalServiceException('PaymentApi', 'Payment processing unavailable');
}
```

### Rule ST011:2020 — Ensure That All Required Security Information Is Included in the Logs

| Field                   | Detail                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Ensure that all required security information is included in the logs.                                                                                                                                                      |
| **Coverage in ADR-003** | Partial — method, URL, IP, user-agent, timestamp, and correlation ID are logged. Authenticated user identity and security-event differentiation are absent.                                                                 |
| **Gap 1**               | No `userId` is captured. Logs cannot answer "who did what" — a fundamental requirement for security audit trails.                                                                                                           |
| **Gap 2**               | `AccessDeniedException` (403) and authentication failures log at `WARN` with no differentiation from standard validation errors. Security tooling cannot alert specifically on authorisation anomalies.                     |
| **Recommendation**      | Add `userId` (from `request.user?.sub`, defaulting to `'anonymous'`) to all structured log entries. Add an `eventCategory` field distinguishing `SECURITY_EVENT` (403, 401) from `CLIENT_ERROR` and `SERVER_ERROR` entries. |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/interceptors/request-logging.interceptor.ts

intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  const request = context.switchToHttp().getRequest<Request>();

  // ST011:2020 — authenticated user identity must appear in every log entry
  const userId = (request as { user?: { sub?: string } }).user?.sub ?? 'anonymous';
  const requestId =
    (request.headers['x-request-id'] as string | undefined) ?? this.generateRequestId();

  const logContext = {
    requestId,
    userId,   // ← who made the request
    method: request.method,
    url: request.url,
    ip: request.ip,
    timestamp: new Date().toISOString(),
  };

  this.safeLog('log', `Incoming Request: ${request.method} ${request.url}`, logContext);
  // ...
}
```

```typescript
// libs/shared/src/lib/observability/filters/global-exception.filter.ts

// ST011:2020 — differentiate security events from generic client errors
private resolveEventCategory(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
    return 'SECURITY_EVENT';
  }
  if (status < 500) {
    return 'CLIENT_ERROR';
  }
  return 'SERVER_ERROR';
}
```

### Rule ST011:2025 — Catch All Error Conditions and Exceptions and Handle Them Appropriately

| Field                   | Detail                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Catch all error conditions and exceptions and handle them appropriately.                                                                                                                                                                |
| **Coverage in ADR-003** | Well addressed for the NestJS HTTP pipeline. Async errors outside the pipeline are not covered.                                                                                                                                         |
| **Gap**                 | Unhandled `Promise` rejections and uncaught exceptions from Kafka consumer callbacks, MongoDB event handlers, or bootstrap errors in `main.ts` bypass `GlobalExceptionFilter` entirely and may crash the process without any log entry. |
| **Recommendation**      | Each service's `main.ts` must register `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers that log at `ERROR` level before the process exits. These cannot be centralised in the shared module.          |

**Reference Implementation:**

```typescript
// apps/services/<service-name>/src/main.ts

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // ... app setup

  // ST011:2025 — catch errors that bypass the NestJS HTTP pipeline
  process.on('uncaughtException', (error: Error) => {
    console.error(
      JSON.stringify({
        event: 'UNCAUGHT_EXCEPTION',
        outcome: 'FAILURE',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error(
      JSON.stringify({
        event: 'UNHANDLED_REJECTION',
        outcome: 'FAILURE',
        reason: String(reason),
        timestamp: new Date().toISOString(),
      }),
    );
    process.exit(1);
  });

  await app.listen(3000);
}

bootstrap();
```

### Rule ST011:2030 — Ensure Logging Data Is Classified and Protected Appropriately

| Field                   | Detail                                                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Ensure logging data is classified and protected appropriately.                                                                                                                                                                                                                    |
| **Coverage in ADR-003** | Not addressed.                                                                                                                                                                                                                                                                    |
| **Gap**                 | The `RequestLoggingInterceptor` has no mechanism to prevent logging of `Authorization` headers, `Cookie` headers, request bodies, or fields matching sensitive patterns (`password`, `token`, `secret`, `apiKey`). PII such as email addresses may also appear in URL parameters. |
| **Recommendation**      | Add a `SensitiveDataSanitiser` utility to the observability module. Pass all loggable header maps through it before emission. Never log request bodies. Maintain an explicit denylist of header names and a pattern-based denylist for field names.                               |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/utils/sensitive-data-sanitiser.ts

const REDACTED = '[REDACTED]';

/**
 * HTTP headers that must never appear in log output.
 * ST011:2030 — Ensure logging data is classified and protected appropriately.
 */
const BLOCKED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

/**
 * Field name pattern identifying sensitive values (case-insensitive).
 * Matches common patterns: password, secret, token, apiKey, api_key, credential, private.
 */
const SENSITIVE_FIELD_PATTERN = /password|secret|token|apikey|api_key|credential|private/i;

/**
 * Returns a copy of a headers object with sensitive entries replaced by '[REDACTED]'.
 * Apply before logging any incoming or outgoing headers.
 *
 * @param headers - Raw headers object from the incoming request.
 * @returns A safe copy with blocked headers redacted.
 */
export function sanitiseHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      BLOCKED_HEADERS.has(key.toLowerCase()) ? REDACTED : value,
    ]),
  );
}

/**
 * Returns a copy of a plain object with values for sensitive keys replaced by '[REDACTED]'.
 * Apply before logging any request payload or query parameters.
 *
 * @param obj - The object to sanitise.
 * @returns A safe copy with sensitive fields redacted.
 */
export function sanitiseObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? REDACTED : value,
    ]),
  );
}
```

```typescript
// Usage inside RequestLoggingInterceptor
import { sanitiseHeaders } from '../utils/sensitive-data-sanitiser';

const logContext = {
  requestId,
  userId,
  method: request.method,
  url: request.url,
  ip: request.ip,
  // ST011:2030 — sanitise headers before logging; never include request.body
  headers: sanitiseHeaders(request.headers as Record<string, unknown>),
  timestamp: new Date().toISOString(),
};
```

### Rule ST011:2035 — Ensure Logging Data Is Protected Against Modification

| Field                   | Detail                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Ensure logging data is protected against modification.                                                                                                                                                                                                |
| **Coverage in ADR-003** | Not addressed.                                                                                                                                                                                                                                        |
| **Gap**                 | Log output transport security and write-access controls on the log store are not specified. Logs shipped over an unsecured channel to a centralised aggregator could be intercepted or altered.                                                       |
| **Recommendation**      | This is primarily an infrastructure concern that must be flag-raised at architecture level. The `ObservabilityModule` JSDoc should carry an explicit ST011:2035 note listing the infrastructure requirements that must be verified during deployment. |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/observability.module.ts

/**
 * ObservabilityModule — provides centralised request logging,
 * exception handling, and correlation ID management for all NestJS services.
 *
 * ## ST011:2035 Infrastructure Requirements
 *
 * The following must be verified and enforced at infrastructure level
 * before this module is considered fully ST011:2035 compliant:
 *
 * - Log transport from service to aggregation platform (CloudWatch, ELK, etc.)
 *   must use TLS — plaintext syslog or unencrypted UDP is not acceptable.
 * - The service IAM / RBAC role must have **write-only** access to the log stream.
 * - Log streams must be configured with retention locks or immutability policies
 *   to prevent retroactive modification or deletion.
 * - No application-level role may delete, modify, or truncate emitted log entries.
 */
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class ObservabilityModule {}
```

### Rule ST011:3010 — Determine Trust Boundaries and Entry Points of Data

| Field                   | Detail                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**                | Determine trust boundaries and entry points of data.                                                                                                                                                                                                                                |
| **Coverage in ADR-003** | Partial — accepting vs. regenerating correlation IDs from untrusted sources is mentioned only in the Risks table; it is not a Component 4 design requirement.                                                                                                                       |
| **Gap**                 | The Component 4 design accepts `x-request-id` and `x-correlation-id` from any client. A malicious actor submitting a crafted correlation ID could pollute log traces or link their request to an unrelated trace (trace poisoning).                                                 |
| **Recommendation**      | Elevate the trust boundary check to a first-class design requirement in Component 4. For public-facing endpoints always regenerate the ID; only propagate incoming IDs from requests carrying a verified internal service token. Validate the format of any accepted ID before use. |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/utils/correlation-id.util.ts

/**
 * Header name used by internal services to identify themselves as trusted callers.
 * Only requests carrying this header may propagate an incoming correlation ID.
 * ST011:3010 — Trust boundary for request correlation.
 */
const INTERNAL_SERVICE_TOKEN_HEADER = 'x-internal-service-token';

/** Safe format for auto-generated correlation IDs. */
const CORRELATION_ID_PATTERN = /^req_\d{13}_[a-z0-9]{1,12}$/;

/**
 * Resolves the correlation ID to attach to an incoming request.
 *
 * Trust boundary (ST011:3010):
 * - Only propagate `x-request-id` / `x-correlation-id` from requests that carry
 *   a valid internal service token header, preventing trace poisoning by external clients.
 * - All other requests receive a freshly generated ID unconditionally.
 *
 * @param request - The incoming HTTP request.
 * @returns A safe correlation ID for use throughout the request lifecycle.
 */
export function resolveCorrelationId(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const isInternalRequest = Boolean(request.headers[INTERNAL_SERVICE_TOKEN_HEADER]);

  if (isInternalRequest) {
    const incoming =
      (request.headers['x-request-id'] as string | undefined) ??
      (request.headers['x-correlation-id'] as string | undefined);

    if (incoming && CORRELATION_ID_PATTERN.test(incoming)) {
      return incoming;
    }
  }

  return generateCorrelationId();
}

/** Generates a unique correlation ID in the format `req_{epochMs}_{randomBase36}`. */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
```

### Rule ST011:4010 — Validate Data from Untrusted Sources (Log Injection Prevention)

| Field                   | Detail                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Rule**                | Validate data from untrusted sources.                                                                                                                                                                                                                                                                        |
| **Coverage in ADR-003** | Not addressed.                                                                                                                                                                                                                                                                                               |
| **Gap**                 | The interceptor embeds `user-agent`, `x-request-id`, and URL values directly into structured log entries without sanitisation. A client supplying values containing newline characters (`\n`, `\r`) or oversized strings can inject false log lines or cause downstream log parsers to misinterpret entries. |
| **Recommendation**      | Add a `sanitiseLogValue` utility that strips newline and carriage-return characters and enforces a maximum length before any externally sourced string is embedded in a log entry. Apply to all header values, URL, and IP before logging.                                                                   |

**Reference Implementation:**

```typescript
// libs/shared/src/lib/observability/utils/log-value-sanitiser.ts

/** Maximum permitted length for any externally sourced string in a log entry. */
const MAX_LOG_VALUE_LENGTH = 512;

/** Characters that could split a log line and enable log injection. */
const NEWLINE_PATTERN = /[\n\r]/g;

/**
 * Sanitises a string value sourced from an untrusted HTTP header, URL, or IP field
 * before it is embedded in a structured log entry.
 *
 * Prevents log injection attacks (ST011:4010) by:
 * - Stripping `\n` and `\r` characters that could split a single log line into multiple entries
 * - Truncating values that exceed {@link MAX_LOG_VALUE_LENGTH} to prevent log flooding
 *
 * @param value - The raw string from the untrusted source (header, URL, etc.).
 * @returns A safe, length-bounded string suitable for log embedding.
 */
export function sanitiseLogValue(value: string | undefined | null): string {
  if (value == null) return '';
  return value.replace(NEWLINE_PATTERN, ' ').slice(0, MAX_LOG_VALUE_LENGTH);
}
```

```typescript
// Usage inside RequestLoggingInterceptor
import { sanitiseLogValue } from '../utils/log-value-sanitiser';

const logContext = {
  // ST011:4010 — all externally sourced values sanitised before embedding in log
  requestId: sanitiseLogValue(request.headers['x-request-id'] as string),
  userId,
  method: request.method,
  url: sanitiseLogValue(request.url),
  ip: sanitiseLogValue(request.ip),
  userAgent: sanitiseLogValue(request.headers['user-agent'] as string),
  timestamp: new Date().toISOString(),
};
```

## Consequences

### If Option A is Accepted

#### Positive

- ✅ **Full ST011 Compliance** — All eight gaps are closed in one shared implementation, eliminating manual compliance review per service
- ✅ **Audit-Ready Logs** — Every log entry contains `userId`, `eventCategory`, `requestId`, and sanitised values, satisfying ST011:2020 audit trail requirements
- ✅ **PII and Credential Protection** — `SensitiveDataSanitiser` prevents credential or personal data leakage into log output (ST011:2030)
- ✅ **Log Injection Prevention** — Newline sanitisation and length truncation block log injection via crafted header values (ST011:4010)
- ✅ **Fail Secure Guarantee** — Filter and interceptor errors never leave requests hanging or expose unhandled exceptions (ST011:2010)
- ✅ **Trust Boundary Enforced** — Correlation ID propagation is restricted to verified internal service requests, preventing trace poisoning (ST011:3010)
- ✅ **No Per-Service Compliance Effort** — Services gain all ST011 controls automatically on next shared library version adoption

#### Negative

- ⚠️ **Coordinated Library Release Required** — All services must adopt the updated shared module version within the same sprint to ensure uniform compliance across the platform
- ⚠️ **Wider Blast Radius** — A defect in the shared sanitisation utilities affects all services simultaneously; thorough unit testing of `libs/shared` is non-negotiable before release
- ⚠️ **Infrastructure Action Required for ST011:2035** — Log transport security (TLS, write-only IAM role, immutability policy) must be verified and documented separately from code changes; this TDR does not substitute for that infrastructure review

#### Neutral

- ℹ️ **Bootstrap Handlers Are Per-Service** — `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers must be added to each service's `main.ts` individually; they cannot be centralised in the shared module
- ℹ️ **Internal Token Strategy TBD** — The `x-internal-service-token` trust boundary header requires a separate decision on token issuance and rotation; candidates include mTLS, a shared JWT signed by a service identity, or a sidecar proxy injection
- ℹ️ **Test Coverage Required** — `sensitive-data-sanitiser.ts`, `log-value-sanitiser.ts`, and `correlation-id.util.ts` each require dedicated unit tests as part of this implementation sprint

## Related Documentation

- [ADR-003: Logging, Error & Exception Handling Strategy](../architecture/003-logging-error-exception-handling.md)
- [Module Boundary Rules](../../../.github/instructions/frameworks/module-boundaries.md)
- [NestJS Instructions](../../../.github/instructions/frameworks/nestjs.instructions.md)
- [Security Standards](../../../.github/instructions/standards/security-standards.md)
- [Unit Test Standards](../../../.github/instructions/standards/unit-test-standards.md)

## References

- [Siemens ST011 — Secure Software Development v1.1.1 (SFeRA)](https://sfera.siemens.com)
- [OWASP Log Injection](https://owasp.org/www-community/attacks/Log_Injection)
- [OWASP Sensitive Data Exposure](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
