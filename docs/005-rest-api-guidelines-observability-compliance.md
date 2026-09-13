# TDR-005: Siemens REST API Guidelines Compliance for the Shared Observability Module

## Decision Record

**Status**: ✅ ACCEPTED  
**Date**: 2026-04-01  
**Deciders**: Development Team  
**Supersedes**: N/A  
**Superseded by**: N/A  
**Implements SDR**: N/A

## Context

### Current State

ADR-003 defines a shared `ObservabilityModule` in `libs/shared` (or `libs/observability`) providing `RequestLoggingInterceptor`, `GlobalExceptionFilter`, business exception classes, and a request correlation strategy. A cross-reference review of ADR-003 against the **Siemens Xcelerator REST API Guidelines v2.5.1** (sourced from [developer.siemens.com/guidelines/api-guidelines](https://developer.siemens.com/guidelines/api-guidelines/rest/index.html)) identified **seven compliance gaps** across four guideline sections.

The project's [REST API Design Standards](../../../.github/instructions/standards/rest-api-design.md) already encodes these guidelines; however, ADR-003 was drafted without explicitly cross-referencing them. The gap exists specifically in:

- The **error response body contract** (`ErrorResponse` interface and `GlobalExceptionFilter` output)
- The **correlation ID format and header name** (`RequestLoggingInterceptor` and Component 4)
- The **stack trace exposure policy** (`GlobalExceptionFilter` dev-mode behaviour)
- The **validation error representation** (`details?: string[]` in `ErrorResponse`)

### Problem Statement

ADR-003 is ready for implementation, but its core contracts diverge from the Siemens REST API Guidelines in ways that will produce non-compliant API error responses once deployed. Resolving these gaps before implementation avoids a costly second migration across all services.

Specifically, the following questions require a documented decision:

1. Should the error response body use the flat `ErrorResponse` shape from ADR-003 or the `{ errors: [...] }` array-wrapped structure required by the guidelines?
2. Should the correlation ID use the ADR-003 custom `req_{epochMillis}_{base36}` format and `x-request-id` header, or a UUID with `X-Correlation-Id` as the guidelines specify?
3. Should stack traces ever appear in error responses (even in development), or be suppressed completely per guideline rule [303]?
4. How should validation field errors be represented — as a flat `string[]` or as individual error objects with `source.pointer`?

### Constraints

- All changes must be confined to `libs/shared` or `libs/observability`; no per-service duplication (ADR-003 constraint)
- The `GlobalExceptionFilter` and `RequestLoggingInterceptor` must remain NestJS-idiomatic (interceptors, filters, global providers)
- The error response contract change is **breaking** for any existing consumers; migration communication is required
- No additional runtime dependencies beyond what is already available in Node.js (`crypto.randomUUID()`) and NestJS

## Guideline Overview

The following rules are sourced from the Siemens Xcelerator REST API Guidelines, retrieved via the Siemens Developer MCP server (`developer.siemens.com/guidelines/api-guidelines/rest/`). Convention terms follow RFC 2119: **MUST** = absolute requirement · **SHOULD** = strongly recommended.

### Error Reporting Rules

| Rule ID   | RFC Level  | Title                                                              | Impact on ADR-003                                             |
| --------- | ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `[301]`   | SHOULD     | Use only the most common HTTP status codes                         | Services must not invent non-standard codes                   |
| `[301.3]` | —          | Client Error 4xx semantics                                         | 400, 401, 403, 404, 409, 415, 429 — standard use confirmed    |
| `[301.4]` | —          | Server Error 5xx semantics — "do NOT expose stack traces"          | 500 must never include a stack trace in the response body     |
| `[303]`   | SHOULD NOT | Do not expose stack traces                                         | ADR-003 exposes `stack` + `originalError` when non-production |
| `[304]`   | SHOULD     | Report problems with an `errors` object (array, MUST not be empty) | ADR-003 emits a flat root object, not an `errors` array       |
| `[305]`   | SHOULD     | Error objects must use defined structure fields                    | ADR-003 uses non-standard fields (`requestId`, `error`, etc.) |
| `[305.3]` | SHOULD     | `title` and `detail` values SHOULD be in English                   | Confirmed — no change needed                                  |

**Guideline-compliant error object fields** (from Rule [305]):

| Field              | Type     | Description                                                               |
| ------------------ | -------- | ------------------------------------------------------------------------- |
| `id`               | `string` | UUID uniquely identifying this specific occurrence of the error           |
| `code`             | `string` | Application-specific error code (e.g. hex `0x80003033`)                   |
| `status`           | `number` | HTTP status code mirroring the response status                            |
| `title`            | `string` | Short, stable human-readable summary (does not change across occurrences) |
| `detail`           | `string` | Occurrence-specific human-readable description                            |
| `source.pointer`   | `string` | RFC 6901 JSON Pointer to the erroneous field (e.g. `/data/email`)         |
| `source.parameter` | `string` | Query parameter that caused the error                                     |
| `source.header`    | `string` | Request header that caused the error                                      |
| `links.about`      | `string` | URL to further information about this error type                          |
| `correlationId`    | `string` | UUID for end-to-end request tracing through the system                    |

### Correlation ID Best Practices

| Section                            | Guideline                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Generating correlation IDs         | Should be a **UUID** (RFC 4122). Generated by an API gateway or the initiating service.                               |
| Logging of correlation IDs         | Should be logged in **structured (JSON) log entries**; enables centralized indexing and cross-service query.          |
| Correlation IDs in error responses | Should be **included in each error object** as the `correlationId` field, not as a separate top-level response field. |

## Findings

Seven compliance gaps were identified. Each finding below includes the guideline rule violated, the current ADR-003 text, and the compliant alternative.

### Finding 1 — Error Response Root Shape (Rule [304])

**Rule**: API SHOULD report problems with an `errors` object. The `errors` collection MUST not be empty and must contain at least one error object.

**ADR-003 (non-compliant)**:

```json
{
  "statusCode": 404,
  "timestamp": "2026-03-26T10:30:00.000Z",
  "path": "/api/users/123",
  "method": "GET",
  "requestId": "req_1742984200000_abc123",
  "error": "Not Found",
  "message": "User with identifier '123' not found"
}
```

**Compliant alternative**:

```json
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
```

### Finding 2 — Error Object Field Names (Rule [305])

**Rule**: Error objects SHOULD use the defined structure: `id`, `code`, `status`, `title`, `detail`, `source`, `links`, `correlationId`.

**ADR-003 (non-compliant)**: Uses `error` (not `title`), `message` (not `detail`), `requestId` (not `correlationId`), `statusCode` (not `status`). No `id`, `code`, `source`, or `links` fields are defined.

**Compliant alternative**:

```typescript
interface SiemensErrorObject {
  id?: string; // UUID for this specific occurrence
  code?: string; // Application-specific hex code
  status: number; // HTTP status code
  title: string; // Stable, short error summary (was 'error')
  detail: string; // Occurrence-specific message (was 'message')
  source?: {
    pointer?: string; // RFC 6901 JSON Pointer (e.g. '/data/email')
    parameter?: string; // Erroneous query parameter name
    header?: string; // Erroneous request header name
  };
  links?: {
    about?: string; // URL to documentation for this error type
  };
  correlationId?: string; // UUID — traces this request (was 'requestId')
}

interface ErrorResponse {
  errors: SiemensErrorObject[];
}
```

> The top-level fields `timestamp`, `path`, and `method` are **not** part of the Siemens error object structure. These belong in structured server-side logs (emitted by the `RequestLoggingInterceptor`), not in the API response body.

### Finding 3 — Stack Trace Exposure (Rule [303] + [301.4])

**Rule**: API SHOULD NOT expose stack traces. Rule [301.4] explicitly references this prohibition when documenting the `500 Internal Server Error` status code.

**ADR-003 (non-compliant)**:

> "Expose full stack trace and original error message in the response body only when `NODE_ENV !== 'production'`"

The guideline makes no environment exception. Stack traces expose implementation internals and dependency information that partners and clients should never rely on. Suppression should be unconditional in API responses at all times.

**Compliant alternative**: Remove `stack?` and `originalError?` from the `ErrorResponse` interface entirely. If internal detail is needed during development, it is available in structured server-side log entries (which already include the stack trace for `ERROR`-level events per ADR-003 Component 2).

### Finding 4 — Validation Errors: `details` vs. `source.pointer` (Rule [305])

**Rule**: `source.pointer` (RFC 6901 JSON Pointer) should be used to reference the erroneous field in the request document. Multiple field errors should each appear as a separate object in the `errors` array.

**ADR-003 (non-compliant)**:

```json
{
  "details": [
    "email: must be a valid email address",
    "password: must be at least 8 characters long"
  ]
}
```

**Compliant alternative**: Each validation failure is a separate entry in the `errors` array with a `source.pointer` pointing to the offending field path:

```json
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
```

### Finding 5 — Correlation ID Format (Best Practice: Generating Correlation IDs)

**Guideline**: Correlation IDs should be a **UUID** (RFC 4122). The guideline example shows `X-Correlation-Id: fe8793b2-1bf0-4d29-bf10-adcf72640ec5`.

**ADR-003 (non-compliant)**: Auto-generates `req_{epochMillis}_{randomBase36}` (e.g. `req_1742984200000_k3mx9ab7f`). This format is not a UUID and is not parseable by standard UUID-aware tooling (API gateways, tracing systems, log aggregators).

**Compliant alternative**: Generate using `crypto.randomUUID()` (available natively in Node.js ≥ 14.17 without any dependency):

```typescript
import { randomUUID } from 'crypto';

const correlationId = randomUUID();
// → 'fe8793b2-1bf0-4d29-bf10-adcf72640ec5'
```

### Finding 6 — Correlation ID Header Name (Best Practice: Generating Correlation IDs)

**Guideline**: The header name used in examples throughout the guidelines is `X-Correlation-Id`.

**ADR-003 (partially non-compliant)**:

- **Priority 1**: `x-request-id` — not the canonical guideline header name
- **Priority 2**: `x-correlation-id` — correct header, but lower priority than the non-standard one
- **Echo**: `x-request-id` — should echo as `X-Correlation-Id`

**Compliant alternative**: Use `X-Correlation-Id` as the **single canonical header** for both inbound acceptance and outbound echo. The `x-request-id` header acceptance can be retained as a fallback for legacy callers, but must be lower priority than `X-Correlation-Id`.

**Revised priority order**:

1. Accept `X-Correlation-Id` from incoming request (primary — per guidelines)
2. Accept `x-request-id` as legacy fallback (optional, lower trust)
3. Auto-generate UUID if neither is present
4. Echo outbound as `X-Correlation-Id` response header

### Finding 7 — No Application Error Code (Rule [305])

**Guideline**: Error objects SHOULD include a `code` field with an application-specific identifier (guideline examples use hex format, e.g. `0x80003033`). Error codes should be unique and documented in the API specification.

**ADR-003 (gap)**: The `ErrorResponse` interface and all `BusinessException` subclasses define no `code` field. This is not a hard violation (the rule is SHOULD), but the interface design should accommodate it from the start to avoid a future breaking change.

**Compliant alternative**: Add an optional `code?: string` to `BusinessException` and to the `SiemensErrorObject` interface. Individual exception classes may set a default code or leave it for domain-level subclasses to provide.

## Options

### Option A: Align the ObservabilityModule with Siemens REST API Guidelines

Update the `ErrorResponse` interface, `GlobalExceptionFilter`, and correlation strategy in ADR-003 before implementation begins. The shared observability module is then implemented once, correctly.

#### Pros

| #   | Pro                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Guideline compliance from day one** — No second migration across all services once the module is rolled out                                                           |
| A2  | **Consistent with project standards** — The project's own [REST API Design Standards](../../../.github/instructions/standards/rest-api-design.md) require this contract |
| A3  | **Consumer trust** — API clients receive a predictable, documented error format from every service                                                                      |
| A4  | **Standards tooling compatibility** — UUID correlation IDs work with API gateways, distributed tracing systems, and log aggregators out of the box                      |
| A5  | **Security by default** — Stack traces are never exposed in API responses, regardless of environment                                                                    |
| A6  | **Pre-implementation change** — Only ADR-003 is updated; no source code migration is needed yet                                                                         |

#### Cons

| #   | Con                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A7  | **ADR-003 update required** — The error contract, correlation strategy, and filter behaviour sections must be revised before implementation starts                   |
| A8  | **Breaking contract** — Any existing consumers already relying on the flat `ErrorResponse` shape must migrate during the service rollout                             |
| A9  | **Validation error mapping complexity** — The `GlobalExceptionFilter` must parse NestJS `ValidationPipe` error payloads and convert them to `source.pointer` entries |

### Option B: Keep ADR-003 contract as-is (non-compliant)

Implement the observability module exactly as specified in ADR-003 without addressing the guideline gaps.

#### Pros

| #   | Pro                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------ |
| B1  | **No ADR update needed** — Implementation can begin immediately without revision                       |
| B2  | **Familiar flat shape** — The flat `ErrorResponse` is simpler for consumers not aware of the guideline |

#### Cons

| #   | Con                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| B3  | **Violates Siemens REST API Guidelines** — A project-wide requirement; non-compliance is an audit risk                         |
| B4  | **Contradicts REST API Design Standards** — The project's own `rest-api-design.md` mandates the `{ errors: [...] }` contract   |
| B5  | **Requires a second migration** — All services would need to be re-migrated when the non-compliance is later identified        |
| B6  | **Stack traces in responses** — Rule [303] is a SHOULD NOT; exposing them introduces a security risk regardless of environment |
| B7  | **No UUID for correlation IDs** — Custom format breaks compatibility with gateways and tracing infrastructure                  |
| B8  | **Multiplied migration cost** — Fixing the contract after all services are on-board is significantly more expensive than now   |

## Comparison

| Criterion                             | Option A: Guideline-aligned   | Option B: ADR-003 as-is        |
| ------------------------------------- | ----------------------------- | ------------------------------ |
| Siemens REST API Guideline compliance | ✅ Full compliance            | ❌ 7 gaps unresolved           |
| Alignment with `rest-api-design.md`   | ✅ Fully aligned              | ❌ Directly contradicted       |
| Implementation complexity             | ⚠️ Moderate (filter refactor) | ✅ Low (implement as written)  |
| Migration cost (future)               | ✅ None — correct from start  | ❌ High — second migration     |
| Consumer trust                        | ✅ Stable documented contract | ⚠️ Non-standard, undocumented  |
| Security (stack traces)               | ✅ Never exposed              | ❌ Exposed in non-production   |
| Distributed tracing compatibility     | ✅ UUID + standard header     | ❌ Custom format, non-standard |

## Decision

> **Adopt Option A: Align the `ObservabilityModule` with the Siemens REST API Guidelines across all seven findings before implementation of ADR-003 begins.**

**Recommendation**: Update ADR-003's `ErrorResponse` interface, `GlobalExceptionFilter` contract, and Component 4 (correlation strategy) to reflect the compliant design documented in this TDR. The shared module is then implemented once, correctly, eliminating the need for a future re-migration.

## Reference Implementations

The following TypeScript snippets are **non-normative reference implementations** illustrating how each finding should be addressed in the shared observability library. They are not final code; the implementation team should adapt them to the exact file structure and coding standards in `libs/shared` or `libs/observability`.

### RI-1 — Compliant Error Response Interfaces

**File**: `libs/shared/src/lib/observability/interfaces/error-response.interface.ts`

```typescript
/**
 * Source information for an error, per Siemens REST API Guidelines Rule [305].
 */
export interface ErrorSource {
  /** RFC 6901 JSON Pointer to the erroneous field in the request body. */
  pointer?: string;
  /** Query parameter that caused the error. */
  parameter?: string;
  /** Request header that caused the error. */
  header?: string;
}

/**
 * Links providing further information about an error, per Rule [305].
 */
export interface ErrorLinks {
  /** URL to further documentation for this error type. */
  about?: string;
}

/**
 * A single error object per Siemens REST API Guidelines Rule [305].
 * All errors are wrapped in the top-level `errors` array (Rule [304]).
 */
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
  /** Links to further information. */
  links?: ErrorLinks;
  /**
   * UUID for end-to-end request tracing.
   * Per best practices: Correlation IDs in error responses.
   */
  correlationId?: string;
}

/**
 * Root error response wrapper per Siemens REST API Guidelines Rule [304].
 * The `errors` array MUST NOT be empty and MUST NOT coexist with `data`.
 */
export interface ErrorResponse {
  errors: SiemensErrorObject[];
}
```

### RI-2 — Updated `BusinessException` Base Class

**File**: `libs/shared/src/lib/observability/exceptions/business.exception.ts`

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Abstract base class for all domain-level exceptions in the Battery Passport
 * platform. Extends NestJS HttpException to integrate with the exception
 * filter pipeline.
 *
 * Subclasses SHOULD set a stable `title` and MAY provide an application-specific
 * `code` per Siemens REST API Guidelines Rule [305].
 */
export abstract class BusinessException extends HttpException {
  /** Short, stable title for this exception type (maps to error object `title`). */
  abstract readonly title: string;

  /**
   * Optional application-specific error code (e.g. '0x80003033').
   * Per Siemens REST API Guidelines Rule [305]: SHOULD be unique per error type.
   */
  readonly code?: string;

  constructor(message: string, status: HttpStatus, code?: string) {
    super(message, status);
    this.code = code;
  }
}
```

### RI-3 — Compliant `GlobalExceptionFilter`

**File**: `libs/shared/src/lib/observability/filters/global-exception.filter.ts`

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { SiemensErrorObject, ErrorResponse } from '../interfaces/error-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // Wrap the entire handler in try/catch to prevent error swallowing.
    try {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest<Request>();
      const response = ctx.getResponse<Response>();

      const correlationId: string =
        (request as { correlationId?: string }).correlationId ??
        (request.headers['x-correlation-id'] as string | undefined) ??
        'unknown';

      const { status, errors } = this.resolveErrors(exception, correlationId);

      const logMeta = {
        correlationId,
        method: request.method,
        url: request.url,
        statusCode: status,
      };

      if (status < 500) {
        this.logger.warn(
          `Client Error: ${request.method} ${request.url} - ${status} - ${errors[0]?.detail}`,
          logMeta,
        );
      } else {
        this.logger.error(
          `Server Error: ${request.method} ${request.url} - ${status} - ${errors[0]?.detail}`,
          exception instanceof Error ? exception.stack : undefined,
          logMeta,
        );
      }

      const body: ErrorResponse = { errors };

      response.status(status).header('X-Correlation-Id', correlationId).json(body);
    } catch (filterError) {
      // Fallback: ensure a response is always sent even if the filter itself throws.
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      response.status(500).json({
        errors: [
          {
            status: 500,
            title: 'Internal Server Error',
            detail: 'An unexpected error occurred',
          },
        ],
      } satisfies ErrorResponse);
    }
  }

  private resolveErrors(
    exception: unknown,
    correlationId: string,
  ): { status: number; errors: SiemensErrorObject[] } {
    // --- NestJS ValidationPipe error (nested field-level messages) ---
    if (exception instanceof HttpException && exception.getStatus() === HttpStatus.BAD_REQUEST) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray((exceptionResponse as { message: unknown }).message)
      ) {
        return {
          status: HttpStatus.BAD_REQUEST,
          errors: this.mapValidationErrors(
            (exceptionResponse as { message: string[] }).message,
            correlationId,
          ),
        };
      }
    }

    // --- BusinessException (domain-semantic exceptions) ---
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        errors: [
          {
            code: exception.code,
            status: exception.getStatus(),
            title: exception.title,
            detail: exception.message,
            correlationId,
          },
        ],
      };
    }

    // --- Generic NestJS HttpException ---
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? exception.message);
      return {
        status,
        errors: [
          {
            status,
            title: this.statusToTitle(status),
            detail,
            correlationId,
          },
        ],
      };
    }

    // --- Unhandled / unexpected exceptions ---
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errors: [
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          title: 'Internal Server Error',
          // Do NOT expose internal error details or stack traces per Rule [303].
          detail: 'An unexpected error occurred',
          correlationId,
        },
      ],
    };
  }

  /**
   * Maps NestJS ValidationPipe field errors to individual SiemensErrorObjects
   * with RFC 6901 JSON Pointer in `source.pointer` per Rule [305].
   *
   * ValidationPipe messages have the format: 'fieldName: constraint message'.
   * Example: 'email: must be a valid email address'
   */
  private mapValidationErrors(messages: string[], correlationId: string): SiemensErrorObject[] {
    return messages.map((msg) => {
      const separatorIndex = msg.indexOf(':');
      const field = separatorIndex > -1 ? msg.slice(0, separatorIndex).trim() : undefined;
      const detail = separatorIndex > -1 ? msg.slice(separatorIndex + 1).trim() : msg;

      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'Validation Error',
        detail,
        source: field ? { pointer: `/data/${field}` } : undefined,
        correlationId,
      };
    });
  }

  /** Maps an HTTP status code to a stable, guideline-compliant title string. */
  private statusToTitle(status: number): string {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      415: 'Unsupported Media Type',
      422: 'Unprocessable Content',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return titles[status] ?? `HTTP ${status}`;
  }
}
```

### RI-4 — UUID Correlation ID Strategy

**File**: `libs/shared/src/lib/observability/interceptors/request-logging.interceptor.ts` _(relevant excerpt)_

```typescript
import { randomUUID } from 'crypto';

/**
 * Resolves or generates the correlation ID for a request.
 *
 * Priority:
 * 1. X-Correlation-Id header   — primary, per Siemens REST API Guidelines
 * 2. x-request-id header       — legacy fallback for older callers
 * 3. Auto-generate UUID        — per best practice: Generating Correlation IDs
 *
 * The resolved ID is:
 * - Attached to the request object as `request.correlationId`
 * - Echoed in the response via the `X-Correlation-Id` header
 * - Included in every structured log entry
 */
function resolveCorrelationId(request: Request): string {
  const headers = request.headers as Record<string, string | undefined>;

  return (
    headers['x-correlation-id'] ?? headers['x-request-id'] ?? randomUUID() // crypto.randomUUID() — no external dependency
  );
}
```

**Log format change** (structured log fields updated per Finding 5 & 6):

```typescript
// Before (ADR-003):
{ requestId: 'req_1742984200000_k3mx9ab7f', ... }

// After (guideline-compliant):
{ correlationId: 'fe8793b2-1bf0-4d29-bf10-adcf72640ec5', ... }
```

### RI-5 — Concrete Exception Class (Updated with `title` and `code`)

**File**: `libs/shared/src/lib/observability/exceptions/resource-not-found.exception.ts`

```typescript
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

/**
 * Thrown when a requested resource cannot be found by the given identifier.
 * Maps to HTTP 404 Not Found per Siemens REST API Guidelines Rule [301.3].
 */
export class ResourceNotFoundException extends BusinessException {
  readonly title = 'Not Found';

  constructor(resourceType: string, identifier: string | number, code?: string) {
    super(`${resourceType} with identifier '${identifier}' not found`, HttpStatus.NOT_FOUND, code);
  }
}
```

### RI-6 — Example Compliant Error Responses

**404 Not Found**:

```json
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
```

**400 Validation Error (multiple fields)**:

```json
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
```

**500 Internal Server Error**:

```json
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

**502 External Service Error**:

```json
{
  "errors": [
    {
      "code": "0x80003033",
      "status": 502,
      "title": "Bad Gateway",
      "detail": "The upstream AAS connector service did not respond",
      "correlationId": "fe8793b2-1bf0-4d29-bf10-adcf72640ec5"
    }
  ]
}
```

## Consequences

### If Option A is Accepted

#### Positive

- ✅ **Guideline compliance** — All seven identified gaps resolved before any code is written; no second migration required
- ✅ **Stable consumer contract** — The `{ errors: [...] }` shape is industry-recognised and consistent with the project's REST API Design Standards
- ✅ **Security by default** — Stack traces are never exposed in API responses per Rule [303], regardless of environment variable state
- ✅ **Distributed tracing ready** — UUID correlation IDs work natively with API gateways, Datadog, AWS X-Ray, and OpenTelemetry collectors
- ✅ **Validation field precision** — Consumers receive `source.pointer` per field rather than a flat string array, enabling inline form error display
- ✅ **Application error code support** — `code` field is defined in the interface from day one; domain teams can assign codes without a breaking contract change

#### Negative

- ⚠️ **ADR-003 revision required** — The error contract, example responses, and correlation ID sections of ADR-003 must be updated before implementation begins
- ⚠️ **Filter implementation complexity** — `GlobalExceptionFilter` must handle NestJS `ValidationPipe` output format and map it to `source.pointer` objects
- ⚠️ **Breaking change for existing consumers** — Services that already call any service's error endpoint will need to update their error-handling code during rollout

#### Neutral

- ℹ️ **Log field rename** — Structured log entries use `correlationId` instead of `requestId`; log query dashboards must be updated after rollout
- ℹ️ **No dependency additions** — `crypto.randomUUID()` is a Node.js built-in; no new packages are required

## Related Documentation

- [ADR-003: Logging, Error & Exception Handling Strategy](../architecture/003-logging-error-exception-handling.md) — The ADR this TDR cross-references and partially supersedes in the error contract section
- [TDR-004: ST011 Security Compliance in the Shared Observability Module](./004-sfera-st011-observability-compliance.md) — Related security compliance review of the same module
- [REST API Design Standards](../../../.github/instructions/standards/rest-api-design.md) — Project-level REST API rules derived from the Siemens Xcelerator guidelines
- [NestJS Instructions](../../../.github/instructions/frameworks/nestjs.instructions.md) — NestJS coding standards for filters, interceptors, and exception classes
- [Unit Test Standards](../../../.github/instructions/standards/unit-test-standards.md) — Testing conventions for all shared library components

## References

- [Siemens Xcelerator REST API Guidelines v2.5.1 — Error Reporting](https://developer.siemens.com/guidelines/api-guidelines/rest/error.html) — Rules [301], [303], [304], [305], [305.3]
- [Siemens Xcelerator REST API Guidelines v2.5.1 — Best Practices: Correlation IDs](https://developer.siemens.com/guidelines/api-guidelines/rest/best-practices.html#generating-correlation-ids) — Generating, logging, and including correlation IDs in error responses
- [RFC 6901 — JavaScript Object Notation (JSON) Pointer](https://www.rfc-editor.org/rfc/rfc6901) — `source.pointer` format
- [RFC 4122 — A Universally Unique IDentifier (UUID)](https://www.rfc-editor.org/rfc/rfc4122) — UUID format for correlation IDs
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters) — Filter pipeline and `ArgumentsHost`
- [NestJS Interceptors](https://docs.nestjs.com/interceptors) — `RequestLoggingInterceptor` integration point
