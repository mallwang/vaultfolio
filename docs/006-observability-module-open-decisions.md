# TDR-006: Observability Module — Open Implementation Decisions

## Decision Record

**Status**: ✅ ACCEPTED  
**Date**: 2026-04-01  
**Deciders**: Development Team  
**Supersedes**: N/A  
**Superseded by**: N/A  
**Implements SDR**: N/A

## Context

### Current State

ADR-003 defines the shared `ObservabilityModule` in `libs/shared` (or `libs/observability`), specifying four architecture components: `RequestLoggingInterceptor`, `GlobalExceptionFilter`, business exception classes, and a request correlation strategy. The ADR was subsequently amended by TDR-004 (ST011 security compliance) and TDR-005 (Siemens REST API Guidelines compliance). During an architectural review in the architects' circle, several implementation-level questions were raised that ADR-003 and its amendments intentionally defer.

### Problem Statement

ADR-003 avoids over-specifying implementation details before the first service migration. As the module approaches implementation, these open questions require explicit decisions to ensure consistent implementation across all backend microservices.

### Constraints

- All implementations must reside in `libs/shared` or `libs/observability` per the enforced module boundary rules
- Solutions must remain NestJS-idiomatic and compatible with the existing interceptor/filter pipeline defined in ADR-003
- No runtime dependencies may be added unless there is a clear advantage over a built-in alternative
- Decisions must not alter the external API contract for successful or error responses (ADR-003 constraint)

## Topics Overview

| #   | Topic                                                           | Decision                                     | Status      |
| --- | --------------------------------------------------------------- | -------------------------------------------- | ----------- |
| T1  | Correlation ID propagation across all log messages              | Option B — `nestjs-cls`                      | ✅ Accepted |
| T2  | Suppressing endpoints from request logging                      | Option C — Hybrid (deny-list + decorator)    | ✅ Accepted |
| T3  | Log output format: full JSON vs. mixed format                   | Option C — Format-per-environment            | ✅ Accepted |
| T4  | Logging library: built-in Logger vs. Pino vs. Winston           | Option B — Pino via `nestjs-pino`            | ✅ Accepted |
| T5  | User identity in log entries: extraction and scope              | Option B — Context store extension           | ✅ Accepted |
| T6  | Source location in log entries: line numbers vs. context string | Option B — `ClassName.methodName` convention | ✅ Accepted |
| T7  | Outgoing request logging in proxy / connector services          | Option C — Failures only                     | ✅ Accepted |

## Topic 1 — Correlation ID Propagation Across All Log Messages

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

ADR-003 Component 1 (`RequestLoggingInterceptor`) and Component 2 (`GlobalExceptionFilter`) both embed the `correlationId` in their structured log entries. However, any `Logger` call inside a service, repository, or utility invoked during the same request does not automatically carry the `correlationId`. The pattern currently used across all backend services (`private readonly logger = new Logger(this.constructor.name)`) produces log entries with no correlation context, making it impossible to deterministically associate intermediate log entries with their originating request — particularly under concurrent load.

**Example gap in current output:**

```
[LOG]  Incoming Request: GET /api/passports/123        {"correlationId":"fe87..."}
[LOG]  DefinitionsController: find schema definition with id abc    ← no correlationId
[LOG]  MongoRepository: Query executed in 32ms                      ← no correlationId
[LOG]  Request Completed: GET /api/passports/123 - 45ms {"correlationId":"fe87..."}
```

The question is: by what mechanism should the `correlationId` be automatically included in every log message emitted during a request's execution, without requiring developers to pass it explicitly through all function arguments?

### Options

#### Option A: AsyncLocalStorage (Node.js Built-in)

A thin `CorrelationContext` store wraps Node.js `AsyncLocalStorage`. The `RequestLoggingInterceptor` populates the store at the start of each request. A `CorrelationAwareLogger` (or a custom global `LoggerService`) wraps NestJS `Logger` and transparently appends the `correlationId` from the store to every log entry.

##### Pros

| #   | Pro                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No Additional Dependency** — `AsyncLocalStorage` is a Node.js built-in (stable since v16); zero external supply-chain risk                   |
| A2  | **Transparent Enrichment** — existing `new Logger(...)` callsites enrich log entries without code changes once the global logger is registered |
| A3  | **Full Ownership** — the store contract and lifecycle are owned entirely by the project; no third-party API to track                           |
| A4  | **Low Implementation Cost** — ~15–30 lines for the context store plus the logger wrapper                                                       |
| A5  | **No Vendor Lock-in** — no dependency on a third-party library's release cycle or API surface                                                  |

##### Cons

| #   | Con                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A6  | **Test Isolation Requires Care** — `AsyncLocalStorage` context can leak between parallel Jest tests unless explicitly reset in `beforeEach`/`afterEach`                                                 |
| A7  | **Global Logger Registration Required** — services must register the `CorrelationAwareLogger` as the global NestJS logger; existing direct `new Logger(...)` instantiations are bypassed until replaced |

#### Option B: nestjs-cls Library

`nestjs-cls` is a purpose-built NestJS library that wraps `AsyncLocalStorage` and provides first-class DI integration via a `ClsService`. `ClsMiddleware` (or equivalent) initialises the store per request. Services inject `ClsService` and read the `correlationId` from it.

##### Pros

| #   | Pro                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | **First-Class NestJS DI Integration** — the context store is injectable as a standard NestJS service; no custom wrapper needed             |
| B2  | **Automatic Store Lifecycle** — middleware handles store initialisation and cleanup without bespoke code                                   |
| B3  | **Widely Adopted** — actively maintained, well-tested in NestJS microservice architectures                                                 |
| B4  | **Extensible** — the same store can carry additional request context (`userId`, `tenantId`) beyond `correlationId` with minimal extra work |

##### Cons

| #   | Con                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5  | **Adds a Runtime Dependency** — all services take a dependency on an external package and its release cadence; must be vetted for security and license compliance |
| B6  | **Library-Specific API** — developers learn `ClsService.get()`/`set()`; migrating away in future would touch all callsites                                        |
| B7  | **Wider Blast Radius on Breaking Change** — a major release of `nestjs-cls` requires coordinated updates across all services in the monorepo                      |

#### Option C: Explicit Parameter Passing

The `correlationId` is extracted from the request object in every controller and forwarded explicitly as a parameter through all service method calls down the call stack.

##### Pros

| #   | Pro                                                                                     |
| --- | --------------------------------------------------------------------------------------- |
| C1  | **No New Infrastructure** — zero new files, zero new dependencies                       |
| C2  | **Fully Explicit** — `correlationId` flow is visible at every call boundary in the code |

##### Cons

| #   | Con                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C3  | **Highly Invasive** — every service method, repository method, and utility function must be updated to accept and forward the parameter                                  |
| C4  | **Not Scalable** — any future addition to request context (`userId`, `tenantId`) requires a second wave of refactoring across all call sites                             |
| C5  | **Fragile by Default** — no enforcement mechanism; developers will omit the parameter, producing silent gaps in correlation coverage                                     |
| C6  | **Contradicts ADR-003** — ADR-003 Alternative 4 explicitly rejects per-service manual work for cross-cutting concerns; this option applies the same pattern per function |

### Comparison

| Criterion                            | Option A: AsyncLocalStorage        | Option B: nestjs-cls            | Option C: Explicit Passing     |
| ------------------------------------ | ---------------------------------- | ------------------------------- | ------------------------------ |
| Additional runtime dependency        | ✅ None                            | ⚠️ One library                  | ✅ None                        |
| Implementation effort                | ✅ Low (~30 lines)                 | ✅ Low                          | ❌ Very high (all call stacks) |
| Developer callsite changes required  | ✅ None (global logger)            | ✅ None (inject `ClsService`)   | ❌ Every service method        |
| Test isolation complexity            | ⚠️ Requires explicit Jest reset    | ✅ Middleware handles lifecycle | ✅ No isolation concern        |
| Compatibility with NestJS DI         | ✅ Fully compatible                | ✅ First-class                  | ✅ N/A                         |
| Extensibility beyond `correlationId` | ⚠️ Manual store extension required | ✅ Built-in support             | ❌ One new param per field     |
| Alignment with ADR-003               | ✅ Aligned                         | ✅ Aligned                      | ❌ Contradicts ADR-003         |

### Decision

> **Accepted: Option B — `nestjs-cls`** — Architects' circle review, April 1, 2026.

**Rationale:** The team anticipates storing additional request-scoped context (`userId`, `tenantId`) alongside the `correlationId` in the near future. `nestjs-cls` provides first-class DI integration and automatic store lifecycle management, eliminating the need for a bespoke `AsyncLocalStorage` wrapper. The added runtime dependency (`nestjs-cls`) is well-maintained and aligns with the adoption of `nestjs-pino` (T4), whose `pino-http` child-logger binding integrates cleanly with `ClsMiddleware`.

### Reference Implementation (Option B — `nestjs-cls`)

```bash
# Install
npm install nestjs-cls
```

```typescript
// libs/shared/src/lib/observability/observability.module.ts
import { ClsModule } from 'nestjs-cls';
import { resolveCorrelationId } from './utils/correlation-id.util';

@Module({})
export class ObservabilityModule {
  static forRoot(options: ObservabilityOptions = {}): DynamicModule {
    return {
      module: ObservabilityModule,
      imports: [
        ClsModule.forRoot({
          middleware: {
            mount: true,
            setup: (cls, req) => {
              cls.set('correlationId', resolveCorrelationId(req));
              cls.set('userId', (req.headers['userid'] as string) ?? 'anonymous');
            },
          },
        }),
      ],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    };
  }
}
```

```typescript
// Injecting ClsService in a service — correlationId and userId always available.
// Note: with nestjs-pino (T4), the pino-http child logger already binds both fields
// automatically on every log call; ClsService injection is only needed for
// non-logging access to these values (e.g., audit trail records).
import { ClsService } from 'nestjs-cls';

@Injectable()
export class DefinitionsService {
  constructor(
    @InjectPinoLogger(DefinitionsService.name)
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
  ) {}

  findOne(id: string): Promise<Definition> {
    // correlationId + userId are bound to every log entry by pino-http automatically
    this.logger.info({ id }, 'Looking up definition');
    return this.definitionsRepository.findOne(id);
  }
}
```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **Automatic Enrichment** — every log entry across all services includes the `correlationId` without per-developer effort, once the global `CorrelationAwareLogger` is registered in the `ObservabilityModule`
- ✅ **Zero Dependency Footprint** — no new external package; reduces supply-chain risk and eliminates an additional Mend/Renovate maintenance obligation across the monorepo
- ✅ **Single Implementation** — bug fixes in the `CorrelationAwareLogger` propagate to all services through the shared module, consistent with ADR-003's single-implementation principle

##### Negative

- ⚠️ **Jest Setup Required** — `AsyncLocalStorage` context must be explicitly reset between tests to prevent cross-test contamination; shared test helpers should provide a `resetCorrelationContext()` utility
- ⚠️ **Global Logger Registration** — each service `AppModule` must register `CorrelationAwareLogger` as the global NestJS logger; existing `new Logger(this.constructor.name)` instantiations bypass the enrichment until replaced

##### Neutral

- ℹ️ **New Shared Files** — adds `correlation-context.ts` and `correlation-aware-logger.service.ts` to `libs/shared/observability/`; consistent with the module structure defined in ADR-003

#### If Option B is Accepted

##### Positive

- ✅ **DI-Native Context Access** — any service can inject `ClsService` to read the `correlationId` without a custom wrapper or global logger replacement
- ✅ **Built-in Lifecycle Management** — `nestjs-cls` handles store initialisation and teardown per request; less custom code to maintain compared to Option A
- ✅ **Extensible Request Context** — `userId`, `tenantId`, and other request-scoped values can be added to the same store with minimal additional work, deferring a possible future refactoring

##### Negative

- ⚠️ **New Runtime Dependency** — `nestjs-cls` must be vetted for security (Mend) and license compliance, pinned across the monorepo, and managed through Renovate updates
- ⚠️ **Library API Lock-in** — `ClsService.get()`/`set()` calls spread across service code; migrating away from `nestjs-cls` in the future would require touching many files across all services

##### Neutral

- ℹ️ **ClsMiddleware Registration** — `ObservabilityModule` must register `ClsMiddleware` globally; a one-time change to the shared module with no per-service impact

</details>

## Topic 2 — Suppressing Endpoints from Request Logging

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

ADR-003 Component 1 (`RequestLoggingInterceptor`) logs every incoming request and its outcome. High-frequency operational endpoints — most notably health, liveness, and readiness probes — generate log noise that pollutes aggregated log streams, inflates storage costs, and obscures meaningful request traffic in dashboards. Similar suppression needs occur for metrics scrape endpoints (`/metrics`) and any endpoint polled on a short interval by an orchestrator or load balancer.

The question is: where and how should individual endpoints opt out of request logging — centrally in the `RequestLoggingInterceptor` itself, or at the handler level via a per-endpoint decorator?

### Options

#### Option A: Centrally Configured Path Deny-List

The `ObservabilityModule` accepts a configuration object at registration time (e.g., `ObservabilityModule.forRoot({ suppressPaths: ['/health', '/metrics'] })`). The `RequestLoggingInterceptor` compares the incoming request path against the list at the start of each request and skips logging entirely when a match is found.

##### Pros

| #   | Pro                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Zero Service-Code Changes** — suppression is configured once in the module registration; no imports or decorators required in any controller                  |
| A2  | **Single Audit Point** — all suppressed paths are visible in one place (`AppModule` registration), making it easy to review what is excluded from logging       |
| A3  | **Works Out of the Box** — common paths (`/health`, `/ready`, `/metrics`) can be pre-configured as module defaults, requiring no action from service developers |
| A4  | **No Reflector Dependency** — the interceptor does not need to interact with NestJS metadata infrastructure; simpler implementation                             |

##### Cons

| #   | Con                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A5  | **Path-Coupling** — suppression is tied to literal path strings; route renaming or path-prefix changes silently re-enable logging without any compile-time signal |
| A6  | **Does Not Compose with Dynamic Routes** — parameterised paths (e.g., `/api/:id/ping`) cannot be matched without introducing glob/regex logic in the interceptor  |
| A7  | **Per-Service Reconfiguration Required** — each service must explicitly extend the path list for any service-specific endpoint it wishes to suppress              |

#### Option B: Custom `@SuppressRequestLogging()` Decorator

A custom NestJS metadata decorator `@SuppressRequestLogging()` is provided by the `ObservabilityModule`. Applied to a controller class or individual handler method, it sets metadata that the `RequestLoggingInterceptor` reads via `Reflector` to skip logging for that handler.

##### Pros

| #   | Pro                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Declarative and Co-located** — suppression intent is expressed directly on the handler, the same place as `@Get()`, `@HttpCode()`, and other handler metadata |
| B2  | **Route-Agnostic** — works regardless of path naming, path-prefix strategy, or dynamic route segments; no string matching required                              |
| B3  | **Granular Control** — can be applied at class level (suppress all handler methods) or method level (suppress a single endpoint)                                |
| B4  | **Refactor-Safe** — renaming a route does not affect suppression; the decorator travels with the handler                                                        |

##### Cons

| #   | Con                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5  | **Requires Per-Service Decorator Import** — every service must import `@SuppressRequestLogging` from the shared module and apply it explicitly; can be forgotten |
| B6  | **Spreads the Concern** — suppression configuration is distributed across controller files rather than centralised; harder to audit which endpoints are silenced |
| B7  | **Reflector Overhead** — the interceptor must call `Reflector.getAllAndOverride()` on every request, even those that are not suppressed                          |

#### Option C: Hybrid — Module Default Deny-List + Decorator Override

The `ObservabilityModule` ships with a pre-configured default path deny-list for universally known noise endpoints (`/health`, `/ready`, `/live`, `/metrics`). Services can augment the list via `ObservabilityModule.forRoot({ suppressPaths: [...] })`. Additionally, the `@SuppressRequestLogging()` decorator is available for service-specific handlers that cannot be addressed by path matching alone.

##### Pros

| #   | Pro                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Health Endpoints Suppressed Out of the Box** — no action required from service teams for the most common suppression need                          |
| C2  | **Escape Hatch for Edge Cases** — the decorator handles dynamic routes or service-specific polling endpoints without polluting the central path list |
| C3  | **Backward Compatible** — services that never need custom suppression require no code changes; those that do can adopt the decorator incrementally   |

##### Cons

| #   | Con                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4  | **Two Mechanisms to Learn** — developers must understand both the path list and the decorator; guidance must clearly define when to use each                               |
| C5  | **Interceptor Complexity** — the interceptor must implement both path-list checking and Reflector metadata resolution, increasing its internal complexity and test surface |

### Comparison

| Criterion                                 | Option A: Central Deny-List    | Option B: Decorator               | Option C: Hybrid                        |
| ----------------------------------------- | ------------------------------ | --------------------------------- | --------------------------------------- |
| Health endpoints suppressed by default    | ✅ Via pre-set defaults        | ❌ Must decorate every service    | ✅ Pre-set defaults included            |
| Works with dynamic / parameterised routes | ❌ Requires regex logic        | ✅ Route-agnostic                 | ✅ Decorator handles edge cases         |
| Suppression config is centralised         | ✅ Single location per service | ❌ Spread across controller files | ⚠️ Split between module config and code |
| Refactor-safe (route renaming)            | ❌ Path strings break silently | ✅ Travels with the handler       | ⚠️ Path list breaks; decorator is safe  |
| Developer effort per new suppressed route | ✅ One config entry            | ✅ One decorator                  | ✅ Choose the appropriate mechanism     |
| Interceptor implementation complexity     | ✅ Simple path comparison      | ⚠️ Requires Reflector integration | ❌ Both mechanisms to maintain          |
| Auditability of suppressed endpoints      | ✅ Centralised                 | ❌ Scattered                      | ⚠️ Partially centralised                |

### Decision

> **Accepted: Option C — Hybrid (module deny-list + `@SuppressRequestLogging()` decorator)** — Architects' circle review, April 1, 2026.

**Rationale:** Health and metrics endpoints exist in every service and must be suppressed without requiring per-service action; the pre-configured default deny-list covers this. Dynamic routes and service-specific polling endpoints cannot be addressed reliably by path-string matching alone; the decorator handles these cases in a refactor-safe, co-located manner. The additional interceptor complexity is modest and covered by unit tests in the shared module.

### Reference Implementation (Option C — Hybrid)

```typescript
// libs/shared/src/lib/observability/decorators/suppress-request-logging.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SUPPRESS_REQUEST_LOGGING = 'SUPPRESS_REQUEST_LOGGING';

/** Apply to a controller class or handler method to skip request lifecycle logging. */
export const SuppressRequestLogging = () => SetMetadata(SUPPRESS_REQUEST_LOGGING, true);
```

```typescript
// libs/shared/src/lib/observability/observability.module.ts
export interface ObservabilityOptions {
  /** Paths suppressed from logging in addition to the built-in defaults. */
  suppressPaths?: string[];
}

const DEFAULT_SUPPRESS_PATHS = ['/health', '/live', '/ready', '/metrics'];

@Module({})
export class ObservabilityModule {
  static forRoot(options: ObservabilityOptions = {}): DynamicModule {
    const suppressPaths = [...DEFAULT_SUPPRESS_PATHS, ...(options.suppressPaths ?? [])];
    return {
      module: ObservabilityModule,
      providers: [
        { provide: OBSERVABILITY_OPTIONS, useValue: { suppressPaths } },
        { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    };
  }
}
```

```typescript
// Inside RequestLoggingInterceptor.intercept() — hybrid suppression check
constructor(
  private readonly reflector: Reflector,
  @Inject(OBSERVABILITY_OPTIONS) private readonly options: ObservabilityOptions,
) {}

intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  const request = context.switchToHttp().getRequest<Request>();

  // 1. Path deny-list (covers default health/metrics paths and service additions)
  if (this.options.suppressPaths?.some((p) => request.url.startsWith(p))) {
    return next.handle();
  }

  // 2. Decorator override (covers dynamic routes and service-specific handlers)
  const suppress = this.reflector.getAllAndOverride<boolean>(
    SUPPRESS_REQUEST_LOGGING,
    [context.getHandler(), context.getClass()],
  );
  if (suppress) {
    return next.handle();
  }

  // ... normal logging logic
}
```

```typescript
// Usage in a service — decorator for a non-standard polling endpoint
@Controller('passports')
export class PassportController {

  @Get('status-poll')  // polled every 5 s by the frontend
  @SuppressRequestLogging()
  async getStatus(): Promise<StatusDto> { ... }

}
```

```typescript
// Service AppModule registration with extra suppressed path
@Module({
  imports: [
    ObservabilityModule.forRoot({
      suppressPaths: ['/internal/ping'], // service-specific; health covered by default
    }),
  ],
})
export class AppModule {}
```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **Minimal Interceptor Complexity** — path-list matching is trivial to implement and test
- ✅ **Centralised Suppression Config** — all suppressed paths are visible in one location per service

##### Negative

- ⚠️ **Path-String Fragility** — route renames silently re-enable logging; no compile-time or lint enforcement
- ⚠️ **No Dynamic Route Support** — parameterised routes cannot be suppressed without adding glob/regex logic later

##### Neutral

- ℹ️ **`ObservabilityModule.forRoot()`** — introduces a module factory pattern; all services must migrate from `ObservabilityModule` to `ObservabilityModule.forRoot({...})` even if they use only defaults

#### If Option B is Accepted

##### Positive

- ✅ **Refactor-Safe** — suppression is co-located with the handler and survives route renaming
- ✅ **Granular** — can suppress individual methods without affecting sibling handlers on the same controller

##### Negative

- ⚠️ **Health Endpoints Not Suppressed by Default** — every service must explicitly decorate its health controller; omissions will go unnoticed until log noise is observed in production
- ⚠️ **Distributed Configuration** — no single file shows which endpoints are suppressed; requires grepping across all controller files

##### Neutral

- ℹ️ **New Export from Shared Module** — `@SuppressRequestLogging` must be added to the public API of `libs/shared/observability/index.ts`

#### If Option C is Accepted

##### Positive

- ✅ **Zero-Effort Health Suppression** — common operational endpoints are silenced out of the box; no per-service action required
- ✅ **Dynamic Route Support** — the decorator covers cases the path list cannot handle without regex complexity
- ✅ **Incremental Adoption** — services that never need custom suppression require no changes; the decorator is available when needed

##### Negative

- ⚠️ **Two Mechanisms** — documentation must clearly state the decision rule: use the module config for well-known static paths, the decorator for everything else
- ⚠️ **Increased Interceptor Test Surface** — both path-list and Reflector code paths must be independently unit-tested

##### Neutral

- ℹ️ **`ObservabilityModule.forRoot()`** — same factory pattern consideration as Option A; default path list covers most cases without explicit configuration

</details>

## Topic 3 — Log Output Format: Full JSON vs. Mixed Format

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

ADR-003 Component 1 defines log entries in a **mixed format**: a human-readable text prefix followed by a JSON payload on the same line, for example:

```
[LOG] Incoming Request: GET /api/users | {"correlationId":"fe87...","userId":"user-abc","method":"GET","url":"/api/users",...}
[WARN] Client Error: POST /api/users - 400 - Validation failed | {"correlationId":"fe87...","eventCategory":"CLIENT_ERROR",...}
```

This format is readable in a raw terminal during local development, but log aggregators (AWS CloudWatch Logs Insights, Datadog, ELK/OpenSearch) must apply regex extraction to parse the text prefix into structured fields. Fields that appear only in the prefix — such as the human-readable message, HTTP method, and status code summary — are not directly queryable as structured keys without additional pipeline configuration.

The question is: should the `RequestLoggingInterceptor`, `GlobalExceptionFilter`, and all other log output from the `ObservabilityModule` emit **pure JSON objects** on every line, or retain the mixed format defined in ADR-003?

### Options

#### Option A: Full Structured JSON

Every log line emitted by the `ObservabilityModule` (and, via `CorrelationAwareLogger`, by all other service code) is a complete JSON object. NestJS's built-in `Logger` is replaced by a custom `LoggerService` that serialises all fields — level, message, context, and structured metadata — into a single flat JSON object per line.

Example output:

```json
{"level":"log","context":"RequestLoggingInterceptor","message":"Incoming Request","method":"GET","url":"/api/users","correlationId":"fe87...","userId":"user-abc","ip":"127.0.0.1","timestamp":"2026-03-27T10:00:00.000Z"}
{"level":"warn","context":"GlobalExceptionFilter","message":"Client Error","method":"POST","url":"/api/users","statusCode":400,"correlationId":"fe87...","eventCategory":"CLIENT_ERROR","timestamp":"2026-03-27T10:00:01.000Z"}
```

##### Pros

| #   | Pro                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Trivially Parseable** — log aggregators ingest every field as a first-class structured key with zero regex extraction or pipeline configuration                     |
| A2  | **Consistent Schema** — all fields (`correlationId`, `statusCode`, `eventCategory`, `duration`) are always at the top level; no split between prefix text and payload |
| A3  | **Direct Field Querying** — log systems can filter, alert, and aggregate on any field (e.g., `statusCode >= 500`) without post-processing                             |
| A4  | **Compatible with OpenTelemetry** — structured JSON maps cleanly to OTel log body and attributes without transformation                                               |

##### Cons

| #   | Con                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A5  | **Unreadable in Raw Terminal** — raw `docker logs` or IDE run output is dense JSON; requires a formatter (`pino-pretty`, `jq`, or a log viewer) locally |
| A6  | **Custom `LoggerService` Required** — NestJS's built-in `Logger` produces the mixed format by default; it must be fully replaced, not just wrapped      |
| A7  | **Breaks Existing Log Grep Habits** — developers accustomed to scanning plain-text logs must adapt their local debugging workflow                       |

#### Option B: Mixed Format (ADR-003 Default)

Retain the format specified in ADR-003: a human-readable NestJS-style prefix (`[LEVEL] Message: context - detail`) followed by a `|` separator and a JSON metadata payload. NestJS's built-in `Logger` is used as-is or lightly wrapped.

Example output:

```
[LOG] Incoming Request: GET /api/users | {"correlationId":"fe87...","userId":"user-abc","method":"GET",...}
[WARN] Client Error: POST /api/users - 400 - Validation failed | {"correlationId":"fe87...","eventCategory":"CLIENT_ERROR",...}
```

##### Pros

| #   | Pro                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | **Human-Readable by Default** — raw terminal and IDE output is immediately understandable without a log viewer or formatter                |
| B2  | **No `LoggerService` Replacement** — the built-in NestJS `Logger` can be used directly or lightly wrapped; lower implementation complexity |
| B3  | **Consistent with ADR-003** — no amendment to the already-documented log format examples in ADR-003 is required                            |

##### Cons

| #   | Con                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B4  | **Regex Extraction in Log Aggregators** — the text prefix (`[LEVEL] Message: ...`) is not structured JSON; aggregators require custom grok/regex patterns to extract level, message, and context |
| B5  | **Split Schema** — some fields live in the prefix text (level, short message, method, status) and others in the JSON payload; no single query can address all fields without extraction          |
| B6  | **Inconsistent with Industry Norms** — structured JSON logging is the de-facto standard for containerised microservices; tooling (CloudWatch, Datadog, Loki) optimises for it                    |

#### Option C: Format-per-Environment (`json` in CI/production, `pretty` locally)

The `ObservabilityModule` accepts a `logFormat` configuration option (`'json' | 'pretty'`). In `json` mode the output is full structured JSON (Option A). In `pretty` mode the output is the human-readable mixed format (Option B). The format defaults to `'json'`; local development overrides to `'pretty'` via an environment variable (`LOG_FORMAT=pretty`).

##### Pros

| #   | Pro                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Structured JSON in Production** — log aggregators receive clean, parseable JSON in all deployed environments                    |
| C2  | **Readable Locally** — developers retain the easy-to-scan mixed format during `nx serve` without installing a log viewer          |
| C3  | **Common Industry Pattern** — `pino`, `winston`, and most mature logging libraries provide exactly this mode-switching capability |

##### Cons

| #   | Con                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4  | **Two Code Paths** — both format renderers must be implemented, tested, and maintained in the shared module                                                                      |
| C5  | **Local ≠ Production Format** — subtle formatting bugs (e.g., a field missing in the JSON renderer) may not surface during local development and only appear after deployment    |
| C6  | **Additional Module Config** — `ObservabilityModule.forRoot()` gains a `logFormat` option; services that have not yet migrated to `forRoot()` must do so to configure the format |

### Comparison

| Criterion                                  | Option A: Full JSON         | Option B: Mixed Format       | Option C: Format-per-Env       |
| ------------------------------------------ | --------------------------- | ---------------------------- | ------------------------------ |
| Log aggregator parseability                | ✅ Native structured fields | ❌ Requires regex extraction | ✅ JSON in deployed envs       |
| Human-readable in raw terminal             | ❌ Dense JSON               | ✅ Plain text prefix         | ✅ Pretty mode locally         |
| Custom `LoggerService` required            | ✅ Yes — full replacement   | ⚠️ Light wrapper sufficient  | ✅ Yes — both renderers        |
| Implementation complexity                  | ⚠️ Medium                   | ✅ Low                       | ❌ Highest                     |
| Consistency with production format         | ✅ Always identical         | ✅ Always identical          | ⚠️ Local differs from deployed |
| Alignment with containerised service norms | ✅ Industry standard        | ❌ Non-standard prefix       | ✅ Production is standard      |
| Amendments to ADR-003 log format examples  | ⚠️ Required                 | ✅ None                      | ⚠️ Required for JSON examples  |

### Decision

> **Accepted: Option C — Format-per-environment (`json` default, `pretty` locally via `LOG_FORMAT=pretty`)** — Architects' circle review, April 1, 2026.

**Rationale:** Deployed environments emit clean, aggregator-ready structured JSON with zero pipeline configuration. Local development retains the human-readable format without requiring a log viewer. Because T4 resolves to Pino (`nestjs-pino`), this is handled automatically by Pino's `transport` option — no custom renderer is needed; the reference implementation below applies only if the built-in Logger path is ever revisited.

### Reference Implementation (Option C — Format-per-Environment)

> **Note:** T4 resolved to Pino (`nestjs-pino`). Format-per-environment is handled natively by Pino's `transport` option — no custom `LoggerService` renderer is required.

```typescript
// libs/shared/src/lib/observability/observability.module.ts
// Pino selects JSON vs. pretty output based on the LOG_FORMAT environment variable.
// Structured JSON is the default (undefined transport); pino-pretty is opt-in locally.
LoggerModule.forRoot({
  pinoHttp: {
    transport:
      process.env['LOG_FORMAT'] === 'pretty'
        ? {target: 'pino-pretty', options: {colorize: true, singleLine: false}}
        : undefined,
  },
}),
```

```bash
# .env.local (committed as .env.example, gitignored for actual secrets)
LOG_FORMAT=pretty

# .env.development / .env.production — no override; Pino defaults to structured JSON
```

```jsonc
// package.json — convenience script for local dev with pretty output
{
  "scripts": {
    "start:pretty": "LOG_FORMAT=pretty npx nx run <service>:serve:local",
  },
}
```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **Aggregator-Ready from Day One** — every log line is immediately queryable as structured data in CloudWatch, Datadog, or any JSON-aware aggregator with zero pipeline configuration
- ✅ **Single Code Path** — one JSON renderer to implement, test, and maintain; no environment branching
- ✅ **OTel Compatibility** — log body maps directly to OpenTelemetry log record attributes without transformation

##### Negative

- ⚠️ **Local Developer Experience** — raw `nx serve` output is unreadable without a log viewer; a `pino-pretty`-style npm script or IDE plugin should be provided as part of the shared developer setup
- ⚠️ **ADR-003 Log Format Examples Must Be Updated** — the human-readable log examples in ADR-003 (Component 1 and Component 2 sections) must be replaced with JSON equivalents

##### Neutral

- ℹ️ **Custom `LoggerService`** — the full NestJS `Logger` is replaced; the `CorrelationAwareLogger` from Topic 1 (if adopted) can incorporate the JSON renderer directly, avoiding a separate class

#### If Option B is Accepted

##### Positive

- ✅ **No Change to ADR-003** — the format is already documented; no amendment required
- ✅ **Minimal Implementation** — the built-in NestJS `Logger` is used directly; the JSON payload portion remains parseable if the prefix is stripped

##### Negative

- ⚠️ **Aggregator Pipeline Overhead** — every deployed environment requires a grok/regex extraction rule to split the text prefix from the JSON payload; this must be set up and maintained per aggregator
- ⚠️ **Non-Standard** — new developers and tooling integrations will not treat the format as natively structured; field-level alerting requires extraction rules

##### Neutral

- ℹ️ **Acceptable Short-Term** — reasonable as a temporary state if full-JSON migration is planned in a subsequent sprint, but this should be tracked explicitly to avoid indefinite deferral

#### If Option C is Accepted

##### Positive

- ✅ **Production-Grade Logging Without Sacrificing DX** — deployed environments emit clean JSON; local development retains the readable mixed format
- ✅ **Incremental Migration Path** — teams can validate the JSON format in staging before rolling out to production, reducing the risk of unexpected aggregator issues

##### Negative

- ⚠️ **Two Renderers** — both JSON and pretty formatters must be covered by unit tests in the shared module; the scope of the `LoggerService` implementation grows
- ⚠️ **Format Drift Risk** — a field added to the JSON renderer but forgotten in the pretty renderer (or vice versa) is not caught until the other mode is exercised

##### Neutral

- ℹ️ **`LOG_FORMAT` Environment Variable** — must be documented in each service's `.env.example` and the shared module README; defaults to `json` so no action is needed for deployed environments

</details>

## Topic 4 — Logging Library: Built-in Logger vs. Pino vs. Winston

> **Cross-topic note:** This decision directly influences T1 (Correlation ID propagation) and T3 (Log output format). Adopting Pino (`nestjs-pino`) provides native JSON output (resolving T3-A) and first-class `AsyncLocalStorage`-based request context (partially resolving T1). The decision here should be made before finalising T1 and T3 to avoid redundant custom implementation.

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

ADR-003 defines a custom `RequestLoggingInterceptor` and `GlobalExceptionFilter` built on top of NestJS's built-in `Logger` / `ConsoleLogger`. These components are responsible for structured log output across all backend microservices. The built-in `Logger` is synchronous, outputs a non-JSON mixed format by default, and has no native support for request-scoped context propagation or high-throughput async writes.

Topics T1 and T3 in this TDR identify two problems that a more capable logging library could solve natively:

- **T1** requires a mechanism to propagate `correlationId` into every log entry — `nestjs-pino` handles this automatically via `pino-http`'s child logger per request.
- **T3** requires structured JSON for log aggregators — Pino outputs pure JSON natively; pretty-printing for local development is handled by `pino-pretty`.

The question is: should the `ObservabilityModule` be built on top of the NestJS built-in `Logger`, Pino (`nestjs-pino`), or Winston (`nest-winston`)?

### Options

#### Option A: NestJS Built-in Logger (ConsoleLogger)

The `ObservabilityModule` wraps NestJS's built-in `Logger` / `ConsoleLogger` with a custom `LoggerService` that adds JSON serialisation, correlation ID injection, and severity mapping. All structured behaviour is implemented by hand in the shared module.

##### Pros

| #   | Pro                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **No Additional Dependency** — zero new packages; no supply-chain risk, no Renovate/Mend overhead                                                            |
| A2  | **Consistent with Current Codebase** — all services already use `new Logger(this.constructor.name)`; the migration surface is limited to module registration |
| A3  | **Full Ownership** — every behaviour is explicitly implemented and tested in the project; no dependency on a third-party library's opaque internals          |

##### Cons

| #   | Con                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4  | **Synchronous Writes** — the built-in logger writes to stdout synchronously; at high throughput this blocks the event loop on every log call                        |
| A5  | **Bespoke JSON Serialisation** — structured JSON output, pretty-print switching (T3), and correlation ID injection (T1) must all be hand-implemented and maintained |
| A6  | **Re-inventing Solved Problems** — Pino already solves T1 and T3 natively; building equivalent behaviour manually is high-effort for lower quality                  |

#### Option B: Pino via `nestjs-pino`

`nestjs-pino` integrates the [Pino](https://getpino.io/) logger into NestJS. Pino is the fastest Node.js logger (async, low-overhead JSON serialisation). `nestjs-pino` replaces the NestJS `LoggerService`, provides a `PinoLogger` injectable, and uses `pino-http` middleware to create a child logger per request — automatically propagating all request-scoped fields (`correlationId`, `userId`, etc.) into every log entry for the duration of that request.

##### Pros

| #   | Pro                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Highest Throughput** — async writes via worker thread; logging never blocks the event loop; benchmarks show 5–8× throughput vs. synchronous loggers                                                                                                                |
| B2  | **Native JSON Output** — Pino always emits structured JSON; `pino-pretty` provides human-readable output for local development — resolves T3 natively                                                                                                                |
| B3  | **Automatic Request Context Propagation** — `pino-http` creates a child logger per request and binds all request fields to it; every `logger.info()` called within that request automatically includes `correlationId` and other bound fields — resolves T1 natively |
| B4  | **First-Class NestJS Integration** — `nestjs-pino` implements `LoggerService` and registers `PinoLogger` as a DI-injectable; no custom wrapper required                                                                                                              |
| B5  | **`pino-pretty` for Local Dev** — a single `pino-pretty` dev-dependency replaces the custom pretty-printer that Option A (T3) would require                                                                                                                          |
| B6  | **Industry Standard** — Pino is the most widely recommended logger for NestJS in production; extensive community knowledge, battle-tested in high-load systems                                                                                                       |

##### Cons

| #   | Con                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B7  | **Two New Runtime Dependencies** — `pino` and `nestjs-pino` (plus `pino-pretty` as a dev-dependency); must be vetted for security and license compliance                                                                                                        |
| B8  | **`pino-http` Middleware Registration** — `nestjs-pino` requires middleware registration in the `ObservabilityModule`; must co-exist correctly with the `RequestLoggingInterceptor` defined in ADR-003                                                          |
| B9  | **`new Logger(...)` Callsites Must Migrate** — existing `private readonly logger = new Logger(this.constructor.name)` usage is not automatically enriched; services should inject `PinoLogger` or use the global logger to benefit from request-context binding |

#### Option C: Winston via `nest-winston`

`nest-winston` integrates the [Winston](https://github.com/winstonjs/winston) logger into NestJS. Winston is the most widely known Node.js logger, offering a rich transport system (console, file, HTTP, cloud sinks) and a highly configurable format pipeline.

##### Pros

| #   | Pro                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Rich Transport System** — built-in transports for console, file, HTTP, and many cloud providers; useful when log routing beyond stdout is needed |
| C2  | **Flexible Format Pipeline** — `winston.format.combine()` supports custom transforms, colorisation, and JSON serialisation in a composable way     |
| C3  | **Widely Known** — large developer ecosystem; many teams have prior Winston experience                                                             |

##### Cons

| #   | Con                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C4  | **Significantly Slower than Pino** — Winston is synchronous by default and substantially slower under load; not recommended for high-throughput microservices                                    |
| C5  | **No Native Request Context** — Winston has no concept of per-request child loggers; T1 (correlation ID propagation) still requires a custom `AsyncLocalStorage` wrapper                         |
| C6  | **Containerised Services Do Not Need File/HTTP Transports** — all services log to stdout/stderr; Winston's primary differentiator (transport flexibility) provides no value in this architecture |
| C7  | **Heavier Dependency** — Winston and its companion packages (`winston-transport`, format utilities) add more package weight than Pino with equivalent functionality                              |

### Comparison

| Criterion                                 | Option A: Built-in Logger     | Option B: Pino (`nestjs-pino`) | Option C: Winston (`nest-winston`) |
| ----------------------------------------- | ----------------------------- | ------------------------------ | ---------------------------------- |
| Additional runtime dependencies           | ✅ None                       | ⚠️ `pino` + `nestjs-pino`      | ⚠️ `winston` + `nest-winston`      |
| Async / non-blocking writes               | ❌ Synchronous                | ✅ Async worker thread         | ❌ Synchronous by default          |
| Native structured JSON output (T3)        | ❌ Custom implementation      | ✅ Built-in                    | ⚠️ Configurable but manual         |
| Per-request context propagation (T1)      | ❌ Custom implementation      | ✅ `pino-http` child logger    | ❌ Custom implementation           |
| Pretty-print for local development (T3-C) | ❌ Custom implementation      | ✅ `pino-pretty` dev-dep       | ⚠️ Manual format pipeline          |
| NestJS `LoggerService` integration        | ✅ Native                     | ✅ First-class                 | ✅ Via `nest-winston`              |
| Implementation effort in shared module    | ❌ High (T1 + T3 both manual) | ✅ Low (T1 + T3 resolved)      | ⚠️ Medium (T1 still manual)        |
| Performance under load                    | ⚠️ Acceptable (low-mid load)  | ✅ Highest                     | ❌ Lowest                          |
| Resolves T1 natively                      | ❌                            | ✅                             | ❌                                 |
| Resolves T3 natively                      | ❌                            | ✅                             | ⚠️ Partially                       |

### Decision

> **Accepted: Option B — Pino via `nestjs-pino`** — Architects' circle review, April 1, 2026.

**Rationale:** Pino is the only option that natively resolves both T1 (request-context propagation via `pino-http` child loggers, complementing the `nestjs-cls` store adopted in T1) and T3 (pure JSON output with `pino-pretty` for local development, as accepted in T3). Async writes eliminate event-loop blocking under load. The two additional runtime dependencies (`pino`, `nestjs-pino`) are MIT-licensed and have passed Mend security vetting.

### Reference Implementation (Option B — Pino via `nestjs-pino`)

```bash
# Install
npm install nestjs-pino pino-http
npm install --save-dev pino-pretty
```

```typescript
// libs/shared/src/lib/observability/observability.module.ts
import { Module, DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { resolveCorrelationId } from './utils/correlation-id.util';
import { sanitiseHeaders } from './utils/sensitive-data-sanitiser';

@Module({})
export class ObservabilityModule {
  static forRoot(options: ObservabilityOptions = {}): DynamicModule {
    const suppressPaths = [...DEFAULT_SUPPRESS_PATHS, ...(options.suppressPaths ?? [])];

    return {
      module: ObservabilityModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            // T3: JSON in production, pino-pretty locally
            transport:
              process.env['LOG_FORMAT'] === 'pretty'
                ? {
                    target: 'pino-pretty',
                    options: { colorize: true, singleLine: true },
                  }
                : undefined,

            // T4: serializers bind correlationId + userId to every log in this request
            serializers: {
              req(req) {
                return {
                  method: req.method,
                  url: req.url,
                  // T5: resolve userId from trusted internal header; fall back to 'anonymous'
                  userId: (req.headers['userid'] as string) ?? 'anonymous',
                };
              },
              res(res) {
                return { statusCode: res.statusCode };
              },
            },

            // T1: correlation ID is resolved once and bound to pino-http child logger
            genReqId(req) {
              return resolveCorrelationId(req); // per ADR-003 Component 4 trust boundary
            },

            // T2: suppress high-frequency operational paths
            autoLogging: {
              ignore: (req) => suppressPaths.some((p) => req.url?.startsWith(p)),
            },

            // ST011:2030 — redact sensitive headers before they reach log output
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              censor: '[REDACTED]',
            },
          },
        }),
      ],
      providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
      exports: [LoggerModule],
    };
  }
}
```

```typescript
// Service AppModule — full registration (replaces RequestLoggingInterceptor; pino-http handles lifecycle logging)
@Module({
  imports: [
    ObservabilityModule.forRoot({
      suppressPaths: ['/internal/ping'],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // pino-http middleware must be applied globally so the child logger
    // is available before the first NestJS pipe or guard executes
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
```

```typescript
// Injecting PinoLogger in a service — carries correlationId + userId automatically
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class DefinitionsService {
  constructor(
    @InjectPinoLogger(DefinitionsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findOneById(id: string): Promise<SchemaDefinition> {
    // correlationId and userId are automatically included by pino-http child logger
    this.logger.info({ schemaId: id }, 'Fetching schema definition');
    return this.repository.findById(id);
  }
}
```

```bash
# .env.local — enable pretty output for local development (T3)
LOG_FORMAT=pretty
```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **Zero New Dependencies** — no package additions; no Mend/Renovate overhead for new packages
- ✅ **Full Implementation Ownership** — all logging behaviour is authored and tested within the project

##### Negative

- ⚠️ **T1 and T3 Require Full Custom Implementation** — the team must build and maintain a `CorrelationAwareLogger` (T1) and a JSON/pretty-print renderer (T3) from scratch; this is significant implementation surface that Pino provides out of the box
- ⚠️ **Synchronous Logging** — at sustained high request rates across many services, synchronous stdout writes will become a measurable performance bottleneck

##### Neutral

- ℹ️ **No Migration of Existing Callsites** — services continue using `new Logger(this.constructor.name)` as-is until they register the `ObservabilityModule`

#### If Option B is Accepted

##### Positive

- ✅ **T1 Resolved Natively** — `pino-http` binds `correlationId` and other request fields to a child logger; every `logger.info()` within the request automatically includes the correlation context without a custom `AsyncLocalStorage` store or `CorrelationAwareLogger`
- ✅ **T3 Resolved Natively** — Pino emits pure JSON; `pino-pretty` provides the dev-friendly pretty format via `LOG_FORMAT=pretty`; no custom renderer to implement or maintain
- ✅ **Highest Performance** — async logging via worker thread; no event loop blocking under load
- ✅ **Reduced Shared Module Complexity** — adopting Pino eliminates several files that would otherwise be required (custom JSON renderer, `CorrelationAwareLogger`, `CorrelationContext` store)

##### Negative

- ⚠️ **`pino-http` and `RequestLoggingInterceptor` Overlap** — both log request lifecycle events; the ADR-003 `RequestLoggingInterceptor` must be scoped to application-level structured fields only, delegating HTTP-level fields (`method`, `url`, `statusCode`, `duration`) to `pino-http` to avoid duplicate log entries
- ⚠️ **Callsite Migration** — `new Logger(this.constructor.name)` instantiations bypass the injected `PinoLogger` and the `pino-http` child-logger context; services should migrate callsites to inject `PinoLogger` to benefit fully from request context binding
- ⚠️ **Security and License Vetting Required** — `pino` (MIT) and `nestjs-pino` (MIT) must pass Mend scan before adoption

##### Neutral

- ℹ️ **`pino-pretty` as Dev Dependency** — added to root `package.json` as a `devDependency`; no production bundle impact
- ℹ️ **ADR-003 Amendment Needed** — the log format examples in ADR-003 Components 1 and 2 should be updated to reflect Pino's JSON schema once this decision is accepted

#### If Option C is Accepted

##### Positive

- ✅ **Familiar to Teams with Winston Experience** — lower learning curve if the team has prior Winston knowledge
- ✅ **Flexible Transport System** — useful if future requirements include routing logs to a file or a secondary sink (unlikely given the containerised stdout-first architecture)

##### Negative

- ⚠️ **T1 Not Resolved** — correlation ID propagation still requires a custom `AsyncLocalStorage` wrapper or `nestjs-cls`, the same effort as Option A
- ⚠️ **Performance Inferior to Pino** — Winston is the slowest of the three options; not suitable as a long-term choice for a growing microservice fleet
- ⚠️ **Transport Complexity Unused** — the primary Winston differentiator (transport system) provides no value in a containerised, stdout-only logging architecture

##### Neutral

- ℹ️ **Not Recommended for New NestJS Projects** — the NestJS documentation and community increasingly point to Pino as the preferred production logger; Winston guidance is largely legacy

</details>

## Topic 5 — User Identity in Log Entries: Extraction and Scope

> **Cross-topic note:** The mechanism chosen in T1 (correlation ID propagation) and T4 (logging library) directly determines the lowest-effort path for this topic. If T4 resolves to Pino (`nestjs-pino`), the `pino-http` serializer is the natural place to bind `userId` alongside `correlationId` from the incoming request — a single binding covers both fields for the entire request. If T1 resolves to `AsyncLocalStorage` without Pino, the same context store should carry `userId` to avoid introducing a second propagation mechanism.

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

ADR-003 Component 1 already includes `userId` in its structured log entry examples:

```
[LOG] Incoming Request: GET /api/users | {"correlationId":"fe87...","userId":"user-abc",...}
```

However, ADR-003 does not specify how `userId` is sourced, whether it is always present, what value public (unauthenticated) endpoints should carry, or which JWT claims beyond `userId` are permissible in log entries.

The current service pattern (visible across all backend controllers) forwards `userId` as an HTTP header from the user-management-proxy or API gateway after Auth0 token verification:

```typescript
@Headers('userId') userId: string
```

This means `userId` is already available in the request as a trusted internal header by the time the `RequestLoggingInterceptor` executes — the JWT has already been verified upstream. Public endpoints do not carry this header.

Three questions need answering:

1. **Source**: where does the interceptor read the user identity from?
2. **Scope**: which identity fields are logged (GID only, or additional claims)?
3. **Fallback**: what value is used for unauthenticated / public requests?

### Constraints

- **ST011:2030** — sensitive data must not appear in log entries; only a non-sensitive user identifier (GID) may be logged; full JWT payload, email address, display name, and role claims must never appear in log output
- **ST011:3010** — trust boundary: the `userId` header must only be trusted when it originates from a verified internal service token; the interceptor must not trust a `userId` header from a public client request
- Services already receive a resolved `userId` header from the proxy; the interceptor does not need to decode or verify JWT claims itself

### Options

#### Option A: Read `userId` Header Directly in `RequestLoggingInterceptor`

The `RequestLoggingInterceptor` reads `request.headers['userid']` (the trusted internal header set by the user-management-proxy after Auth0 verification). If the header is absent (public endpoint, unauthenticated call, or pre-authentication request), the field is set to `'anonymous'`. No JWT decoding or additional middleware is required.

##### Pros

| #   | Pro                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Zero Additional Implementation** — `userId` is already present as a resolved, trusted header; the interceptor reads it with a single line                        |
| A2  | **No JWT Coupling** — the interceptor does not depend on the JWT library, Auth0 SDK, or token structure; upstream proxy changes do not affect the logging layer    |
| A3  | **Consistent with Existing Controller Pattern** — every controller already reads `userId` from the same header; the interceptor follows the same convention        |
| A4  | **ST011:3010 Compliant by Default** — the header is only present on requests that have passed the proxy trust boundary; no raw JWT is processed in the interceptor |

##### Cons

| #   | Con                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A5  | **Header Name Coupling** — the interceptor references the literal header name `'userid'`; if the proxy header contract changes, the interceptor must be updated in the shared module |
| A6  | **Only GID Available** — only the `userId` GID is carried in the header; additional identity context (e.g., tenant or organisation ID) requires a separate header or JWT decode      |

#### Option B: Extend the Correlation Context Store with `userId` (links to T1)

The request context store introduced in T1 (either `AsyncLocalStorage` or `nestjs-cls` / `pino-http` bindings) is extended to carry `userId` alongside `correlationId`. The interceptor (or `pino-http` serializer in T4-B) reads the `userId` header once at the request boundary, writes it to the context store, and thereafter every log entry emitted during the request — including those deep inside services — automatically includes the `userId` field.

##### Pros

| #   | Pro                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | **`userId` in Every Log Entry** — not only request lifecycle entries but also application-level `logger.info()` calls inside services automatically carry the `userId`               |
| B2  | **Single Read Point** — the header is read once at the request boundary; no per-log-call lookup                                                                                      |
| B3  | **Extensible** — additional request-scoped fields (organisation ID, tenant ID) can be added to the same store with no changes to the interceptor                                     |
| B4  | **Natural Fit with T4-B (Pino)** — if `nestjs-pino` is adopted, `userId` is bound to the `pino-http` child logger in the same serializer that binds `correlationId`; zero extra code |

##### Cons

| #   | Con                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5  | **Depends on T1 Decision** — this option is only available once the context propagation mechanism from T1 is decided and implemented; cannot be adopted in isolation |
| B6  | **Context Store Must Be Extended** — if T1 has already been implemented with only `correlationId`, the store interface and its consumers must be updated             |

#### Option C: Dedicated `UserContextMiddleware`

A `UserContextMiddleware` is added to the `ObservabilityModule`. It runs before the interceptor, reads the `userId` header, and attaches the resolved identity to the request object as `request.userContext`. The `RequestLoggingInterceptor` (and optionally the `GlobalExceptionFilter`) then reads `request.userContext.userId` rather than the raw header.

##### Pros

| #   | Pro                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Clean Separation** — identity resolution is decoupled from the logging interceptor; each component has a single responsibility                          |
| C2  | **Extensible for Richer Context** — the middleware could decode additional trusted headers (organisation ID, tenant ID) into a typed `UserContext` object |

##### Cons

| #   | Con                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3  | **Extra Abstraction for Minimal Gain** — a full middleware class for reading one header is disproportionate; Option A achieves the same result with a single line in the interceptor                |
| C4  | **Middleware Registration Required** — `ObservabilityModule` must register the middleware globally, adding complexity to the module setup alongside the interceptor and filter                      |
| C5  | **No Propagation to Application Logs** — like Option A, `userId` only appears in lifecycle log entries; application-level logs inside services still do not carry the field unless combined with T1 |

### Comparison

| Criterion                                     | Option A: Header in Interceptor     | Option B: Context Store (T1)        | Option C: UserContextMiddleware     |
| --------------------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| Implementation effort                         | ✅ Trivial (one line)               | ⚠️ Requires T1 to be resolved first | ⚠️ Medium (new middleware class)    |
| `userId` in application-level logs (services) | ❌ Lifecycle entries only           | ✅ Every log entry                  | ❌ Lifecycle entries only           |
| Depends on T1 decision                        | ✅ Independent                      | ❌ Yes                              | ✅ Independent                      |
| Natural fit with T4-B (Pino)                  | ⚠️ Separate from Pino binding       | ✅ Same binding point               | ⚠️ Separate from Pino binding       |
| ST011:2030 / ST011:3010 compliant             | ✅ GID only, trusted header         | ✅ GID only, trusted header         | ✅ GID only, trusted header         |
| Anonymous fallback for public endpoints       | ✅ `'anonymous'` when header absent | ✅ `'anonymous'` when header absent | ✅ `'anonymous'` when header absent |
| Extra module complexity                       | ✅ None                             | ⚠️ Context store extension          | ⚠️ New middleware registration      |

### Decision

> **Accepted: Option B — Context store extension (`userId` bound alongside `correlationId` via `pino-http` serializer)** — Architects' circle review, April 1, 2026.

**Rationale:** With T1 resolved to `nestjs-cls` and T4 to Pino, the `pino-http` serializer is the natural single binding point for both `correlationId` and `userId` — no additional code is required beyond what T1 already implements. This ensures `userId` appears in every log entry across the entire request lifetime, not only in lifecycle entries. The logged value must always be the GID from the trusted `userid` internal header; JWT payload, email, display name, role claims, and `sub` must never appear in log output (ST011:2030).

### Reference Implementation (Option B — `pino-http` Serializer)

```typescript
// libs/shared/src/lib/observability/observability.module.ts
// userId is bound alongside correlationId in the pino-http serializer
// (see T4 reference implementation for the full LoggerModule.forRoot() setup).
LoggerModule.forRoot({
  pinoHttp: {
    genReqId: (req) => resolveCorrelationId(req), // binds correlationId per ADR-003 Component 4
    serializers: {
      req(req) {
        return {
          // ST011:2030 — GID only; never email, name, roles, or raw JWT
          userId: (req.headers['userid'] as string) ?? 'anonymous',
        };
      },
    },
  },
}),
```

```typescript
// ClsService can be injected in services that need userId outside of log calls
// (e.g., audit trail records). See T1 reference implementation for ClsModule setup.
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuditService {
  constructor(private readonly cls: ClsService) {}

  record(action: string): void {
    const userId = this.cls.get<string>('userId'); // GID or 'anonymous'
    // ... persist audit entry
  }
}
```

### Field Specification

Regardless of option chosen, the following field contract applies to all log entries:

| Field    | Authenticated request             | Public / unauthenticated request |
| -------- | --------------------------------- | -------------------------------- |
| `userId` | GID from `userid` internal header | `'anonymous'`                    |

Fields that must **never** appear in log output: JWT raw token, `email`, `name`, `roles`, `permissions`, `sub` claim, organisation name.

### Consequences

#### If Option A is Accepted (immediate)

##### Positive

- ✅ **Immediate Availability** — `userId` appears in all request lifecycle and error log entries as soon as the `ObservabilityModule` is registered
- ✅ **No New Files** — a two-line change to the `RequestLoggingInterceptor`; no new classes or module registrations
- ✅ **Proxy-Contract Aligned** — reads the same `userid` header that every controller already depends on; no new contract introduced

##### Negative

- ⚠️ **`userId` Absent from Application Logs** — log entries emitted inside services (`logger.info()`) do not automatically carry the `userId`; only the interceptor and filter entries include it

##### Neutral

- ℹ️ **Upgrade Path to Option B** — once T1 is resolved, the header read can be moved into the context store binding with a small, non-breaking refactor

#### If Option B is Accepted (target state, post-T1)

##### Positive

- ✅ **`userId` in Every Log Entry** — all application-level `logger.info()` calls, repository log entries, and utility log entries automatically carry the `userId` for the duration of the request
- ✅ **No Per-Service Changes** — once the context store is extended, all services benefit automatically through the `ObservabilityModule`
- ✅ **Single Source of Truth** — both `correlationId` and `userId` are bound in one place (the context store or `pino-http` serializer); no risk of divergence between the two fields

##### Negative

- ⚠️ **T1 Must Be Resolved First** — Option B cannot be implemented until the context propagation mechanism from T1 is in place; it should be tracked as a follow-on task in the same sprint

##### Neutral

- ℹ️ **Context Store Interface Update** — if the T1 implementation only defined `correlationId`, the store type must be extended to `{ correlationId: string; userId: string }`; this is a non-breaking internal change within the shared module

</details>

## Topic 6 — Source Location in Log Entries: Line Numbers vs. Context String

> **Cross-topic note:** This topic interacts with T4 (logging library). Pino does not capture call-site location by default (it is opt-in and imposes a measurable CPU cost). The NestJS built-in `Logger` exposes a `context` string that is already used as the class name. The decision here should align with the choice made in T4.

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

During debugging, developers benefit from knowing _where_ a log entry was emitted. Two pieces of source location information are theoretically available: the **class/method name** and the **file path with line number**.

The current codebase pattern sets the NestJS `Logger` context to the class name:

```typescript
private readonly logger = new Logger(this.constructor.name);
// emits: [LOG] [DefinitionsController] find schema definition with id abc
```

This gives class-level granularity but no method name. Log entries from different methods of the same class are indistinguishable by context alone unless developers manually prefix the message.

#### Why line numbers are unreliable in this build pipeline

NestJS services in this monorepo are compiled in two ways depending on environment:

- **Local development** (`nx serve`): transpiled by `ts-node` or `@swc-node/register` — individual `.ts` / `.js` files, line numbers in stack traces map to TypeScript source lines and are accurate.
- **Production Docker build** (`Dockerfile.services`): compiled by `tsc` or `webpack` (a `webpack.config.js` is present at the workspace root) into a `dist/` output. If webpack bundling is used, all service code is merged into a single `main.js` bundle. **All log call-site line numbers in a webpack bundle point into `main.js` and are meaningless without source maps.**

Even for non-webpack `tsc` builds, the emitted `.js` line numbers differ from TypeScript source line numbers unless source maps are loaded at runtime (e.g., via `source-map-support`).

Automatically capturing file and line number at log call-sites (as some loggers can do via `Error` stack introspection) is also expensive: constructing a new `Error` object on every log call to extract the call stack is a significant CPU overhead at high throughput.

#### The security constraint

Exposing source maps in production raises an ST011 concern: source maps contain the original TypeScript source structure, file names, and variable names. If source maps are accessible (e.g., served alongside the bundle or embedded), they reveal internal implementation details to anyone who can access them — a violation of the information-disclosure principles underlying ST011:2016.

### Options

#### Option A: Class Name as Context Only (Current Pattern)

Retain the existing NestJS `Logger` convention: the context string is set to the class name (`this.constructor.name` or `ClassName.name`). No file path or line number is captured. The `context` field in structured log entries identifies the class responsible for the entry.

##### Pros

| #   | Pro                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Zero Performance Cost** — no stack introspection; no `Error` object constructed per log call                                                         |
| A2  | **Refactor-Safe** — `this.constructor.name` follows the class through rename refactors if the IDE updates all usages; string literals do not           |
| A3  | **No Source Map Risk** — no source maps required in production; no information-disclosure concern (ST011:2016)                                         |
| A4  | **Consistent with NestJS Convention** — the built-in `Logger`, `nestjs-pino`, and all NestJS documentation use the class name as the context parameter |

##### Cons

| #   | Con                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A5  | **Method-Level Ambiguity** — when a class has multiple methods that log, the context string alone does not identify which method emitted a given entry |
| A6  | **No File or Line Reference** — tracing a log entry to a specific line of TypeScript source requires searching the class file manually                 |

#### Option B: `ClassName.methodName` as Context String

The context string is set to `ClassName.methodName` at the call site, either by convention (developers write `'DefinitionsController.findOne'`) or via a shared helper that accepts `(this, 'methodName')` and returns the formatted string. No line numbers are involved.

Example output:

```
[LOG] [DefinitionsController.findOne] find schema definition with id abc-123
```

##### Pros

| #   | Pro                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Method-Level Granularity** — log entries are traceable to the specific method without searching the class                                                |
| B2  | **No Performance Cost** — the context string is a static literal or a cheap string concatenation; no stack introspection                                   |
| B3  | **No Source Maps Required** — no production information-disclosure risk; fully ST011:2016 compliant                                                        |
| B4  | **Works in All Build Modes** — method names are preserved in both `tsc` and webpack bundles (unless aggressive minification with name-mangling is enabled) |

##### Cons

| #   | Con                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5  | **Developer Discipline Required** — each `logger.log()` call must manually include the method name; no enforcement mechanism; inconsistent adoption is likely across teams |
| B6  | **Fragile on Rename** — if the method is renamed, the string literal context does not update automatically; a helper using `arguments.callee.name` is non-strict-mode only |
| B7  | **Increases Callsite Verbosity** — every `logger.log()` call becomes slightly more verbose; minor, but multiplied across a large codebase                                  |

#### Option C: Runtime Call-Site Capture via Stack Introspection

Capture the file name and line number at every log call by constructing a new `Error` object and parsing its `.stack` property. Some loggers (including Pino, via the `caller` option) provide this as a built-in feature.

Example output:

```json
{
  "level": "log",
  "context": "DefinitionsController",
  "caller": "definitions.controller.ts:71:18",
  "message": "find schema definition..."
}
```

##### Pros

| #   | Pro                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Precise Source Location** — pinpoints the exact TypeScript file and line (with source maps loaded), or the transpiled JS file and line (without them) |
| C2  | **No Developer Overhead** — location is captured automatically; developers write `logger.log('message')` with no manual context suffix                  |

##### Cons

| #   | Con                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3  | **Significant CPU Cost** — constructing an `Error` and parsing a stack string on every log call is expensive at high throughput; Pino's own documentation marks the `caller` option as a performance trade-off |
| C4  | **Meaningless in Webpack Bundles** — if the production build uses webpack, all line numbers point into `main.js`; the captured location is useless without source maps                                         |
| C5  | **Source Maps in Production Required for Utility** — only valuable if source maps are deployed alongside the bundle, which exposes TypeScript source structure (ST011:2016 risk)                               |
| C6  | **Unreliable Across Build Modes** — accurate in `ts-node` local dev, inaccurate in `tsc` transpile (off-by-line), and useless in webpack without source maps                                                   |

### Comparison

| Criterion                                | Option A: Class name only  | Option B: Class.method name | Option C: Stack introspection    |
| ---------------------------------------- | -------------------------- | --------------------------- | -------------------------------- |
| Granularity                              | Class level                | Method level                | File + line (with source maps)   |
| Performance cost                         | ✅ None                    | ✅ Negligible               | ❌ High per call                 |
| Works reliably in webpack bundle         | ✅ Yes                     | ✅ Yes                      | ❌ No (line numbers meaningless) |
| Source maps required in production       | ✅ No                      | ✅ No                       | ❌ Yes (or useless)              |
| ST011:2016 information disclosure risk   | ✅ None                    | ✅ None                     | ⚠️ Risk if source maps deployed  |
| Developer discipline required            | ✅ Minimal                 | ⚠️ Per-callsite string      | ✅ None                          |
| Rename refactor safety                   | ✅ `this.constructor.name` | ❌ String literals break    | ✅ Automatic                     |
| Consistent with NestJS / Pino convention | ✅ Yes                     | ⚠️ Deviates from convention | ⚠️ Non-standard                  |

### Decision

> **Accepted: Option B — `ClassName.methodName` context string convention** — Architects' circle review, April 1, 2026.

**Rationale:** Class-name-only context (Option A) remains the baseline; developers add the method name suffix as a convention where disambiguation is needed. Option C (line numbers) is rejected: line numbers in a webpack-bundled deployment are unreliable without production source maps, and production source maps introduce an ST011:2016 information-disclosure risk that is not justified by the debugging benefit.

### Reference Implementation (Option B — `ClassName.methodName` Convention)

```typescript
// Pattern 1 — inline suffix (preferred for classes with many logging methods)
@Injectable()
export class DefinitionsService {
  private readonly logger = new Logger(DefinitionsService.name);

  async findOneById(id: string): Promise<SchemaDefinition> {
    // Method name appended manually where disambiguation matters
    this.logger.log('Fetching schema definition', `${DefinitionsService.name}.findOneById`);
    return this.repository.findById(id);
  }

  async findAll(): Promise<SchemaDefinition[]> {
    this.logger.log('Fetching all schema definitions', `${DefinitionsService.name}.findAll`);
    return this.repository.findAll();
  }
}
```

```typescript
// Pattern 2 — helper function (reduces string duplication, stays rename-safe)
// libs/shared/src/lib/observability/utils/logger-context.util.ts

/**
 * Returns a logger context string in the format 'ClassName.methodName'.
 * Use where method-level disambiguation is needed; class name alone is the default baseline.
 */
export function logCtx(target: { constructor: { name: string } }, methodName: string): string {
  return `${target.constructor.name}.${methodName}`;
}
```

```typescript
// Usage with the helper
@Injectable()
export class DefinitionsService {
  private readonly logger = new Logger(DefinitionsService.name);

  async findOneById(id: string): Promise<SchemaDefinition> {
    this.logger.log('Fetching schema definition', logCtx(this, 'findOneById'));
    return this.repository.findById(id);
  }
}
```

```typescript
// Pattern 3 — Pino (T4-B): context is the injected logger name; method is added as a structured field
@Injectable()
export class DefinitionsService {
  constructor(
    @InjectPinoLogger(DefinitionsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findOneById(id: string): Promise<SchemaDefinition> {
    // correlationId and userId are automatic; method name is a structured field
    this.logger.info({ method: 'findOneById', schemaId: id }, 'Fetching schema definition');
    return this.repository.findById(id);
  }
}
```

> **Local dev only — Pino caller option (Option C behaviour, gated behind `LOG_FORMAT=pretty`):**
>
> ```typescript
> // In ObservabilityModule.forRoot() pino transport config
> transport:
>   process.env['LOG_FORMAT'] === 'pretty'
>     ? {
>         target: 'pino-pretty',
>         options: { colorize: true, singleLine: true },
>       }
>     : undefined,
> // Enable caller capture only in pretty mode (local dev) — never in production
> ...(process.env['LOG_FORMAT'] === 'pretty' ? { caller: true } : {}),
> ```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **No Migration Cost** — the current pattern is already Option A; zero changes required across existing callsites
- ✅ **No Performance Impact** — context strings are set once per class instantiation

##### Negative

- ⚠️ **Method Ambiguity Remains** — distinguishing log entries from different methods in a large class still requires reading the message text

##### Neutral

- ℹ️ **Convention Documented** — the coding standards should explicitly state that `new Logger(this.constructor.name)` is the required pattern; no implicit fallback to string literals

#### If Option B is Accepted

##### Positive

- ✅ **Method-Level Traceability** — log entries from high-traffic classes (controllers, service facades) can be traced to the originating method without searching source files
- ✅ **No Runtime Overhead** — string concatenation at class construction time is negligible

##### Negative

- ⚠️ **Inconsistent Adoption Risk** — without lint enforcement, some developers will use only the class name and others will include the method; log queries cannot rely on a uniform format
- ⚠️ **Rename Fragility** — a shared helper (e.g., `loggerContext(this, 'methodName')`) can reduce the string-literal risk but adds a minor callsite convention to document and teach

##### Neutral

- ℹ️ **Coding Standards Update Required** — the project coding standards must document the `ClassName.methodName` convention, when to apply it, and the recommended helper pattern if one is adopted

#### If Option C is Accepted

##### Positive

- ✅ **Precise Location in Local Dev** — `ts-node` local runs benefit from accurate TypeScript file and line references, reducing time-to-debug during development

##### Negative

- ⚠️ **Rejected for Production** — per-call `Error` construction cost is prohibitive at the request rates of a microservice fleet; the option is only viable as a local-dev-only setting
- ⚠️ **Source Map Deployment** — if source maps are deployed to make line numbers meaningful in staging or production, TypeScript source structure is exposed (ST011:2016)

##### Neutral

- ℹ️ **Acceptable as a Local-Dev-Only Override** — if T4 resolves to Pino, the `caller` option can be enabled only when `LOG_FORMAT=pretty` (local dev mode from T3-C) so that precise call-site data aids local debugging without any production cost or risk

</details>

## Topic 7 — Outgoing Request Logging in Proxy / Connector Services

> **Cross-topic note:** This decision is only meaningful once the `correlationId` is propagated through outbound HTTP headers (ADR-003 Component 4) and every downstream service participates in the `ObservabilityModule` (i.e., logs its own incoming requests). During the migration period, when some services have not yet registered the module, outgoing request logging on the caller side may be the only log evidence that a cross-service call occurred.

<details>
<summary>Context, Options, Comparison, Decision &amp; Consequences</summary>

### Context

Several services in the platform act as proxies or connectors — their primary behaviour is to receive an incoming request, translate it, and forward it to one or more downstream services (e.g., `user-management-proxy`, `aas-connector`, `cx-connector`). When ADR-003 is fully rolled out, each downstream service logs its own incoming request with the same `correlationId`.

This creates a potential duplication:

```
[user-management-proxy]  LOG  Outgoing: POST https://user-management-service/users  {"correlationId":"fe87..."}
[user-management-service] LOG  Incoming Request: POST /users  {"correlationId":"fe87...","duration":12ms}
```

The two entries describe the same request from opposite ends of the same HTTP call. For a log aggregator, both entries are queryable by `correlationId` and provide a complete picture — but the outgoing entry adds redundant information in the happy path.

**However**, the outgoing log is the _only_ record when the downstream service is unreachable:

```
[user-management-proxy]  ERROR  Outgoing Failed: POST https://user-management-service/users - ECONNREFUSED  {"correlationId":"fe87..."}
# user-management-service never logs — it never received the request
```

In this case, without the outgoing log entry the `correlationId` trace has a visible gap: the incoming request to the proxy is logged, but no downstream entry exists. The root cause (network failure, service not running) would only be inferable from the proxy's error log if something is logged there.

The question is: should the `ObservabilityModule` (or a dedicated `OutgoingRequestInterceptor`) log all outgoing HTTP calls from proxy/connector services, log only failures, or defer entirely to the downstream service's incoming log?

### Options

#### Option A: No Outgoing Request Logging

Proxy and connector services do not log outgoing requests. The downstream service's incoming request log (with matching `correlationId`) is the authoritative record of what was called and how long it took.

##### Pros

| #   | Pro                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No Duplication** — each request appears exactly once in the log stream from the service that handled it; aggregated log volume is minimised                        |
| A2  | **No Extra Implementation** — no outgoing interceptor or HTTP client middleware required in proxy services                                                           |
| A3  | **Downstream Log is Richer** — the receiving service's log includes actual processing duration and all response fields; the outgoing log from the caller is a subset |

##### Cons

| #   | Con                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4  | **Blind Spot on Connectivity Failure** — if the downstream service is unreachable (ECONNREFUSED, timeout, DNS failure), no log entry records the attempted call; the trace has a silent gap |
| A5  | **Blind Spot During Migration** — if a downstream service has not yet registered the `ObservabilityModule`, its incoming requests are not logged; the caller has no trace of the call       |
| A6  | **No Caller-Side Latency Measurement** — the caller cannot measure the perceived round-trip time (network + processing) without logging the outgoing request timestamp and response time    |

#### Option B: Log All Outgoing Requests

Proxy and connector services log every outgoing HTTP call: method, URL (sanitised — ST011:4010), duration, and response status. This mirrors the `RequestLoggingInterceptor` pattern on the outgoing side.

##### Pros

| #   | Pro                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Complete Trace on Connectivity Failure** — all outgoing attempts are recorded regardless of whether the downstream service is reachable                     |
| B2  | **Caller-Side Latency Visible** — the outgoing log captures perceived round-trip time; comparing it with the downstream incoming log reveals network overhead |
| B3  | **Migration Safety Net** — services not yet on the `ObservabilityModule` are still traceable through the caller’s outgoing log                                |

##### Cons

| #   | Con                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B4  | **Systematic Duplication** — every successful cross-service call generates two log entries (outgoing on caller, incoming on downstream); doubles log volume for proxy services |
| B5  | **URL Sanitisation Required** — outgoing URLs may contain path parameters with user-identifiable values; must pass through `log-value-sanitiser.ts` (ST011:4010)               |
| B6  | **Implementation Cost** — requires an `OutgoingRequestInterceptor` (Axios interceptor or NestJS `HttpModule` wrapper) in the shared module or per-service                      |

#### Option C: Log Outgoing Failures Only

Proxy and connector services log outgoing HTTP calls only when they result in an error: non-2xx responses, network errors (ECONNREFUSED, ETIMEDOUT), and unhandled exceptions from the HTTP client. Successful calls are not logged on the caller side.

##### Pros

| #   | Pro                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Connectivity Failures Are Always Recorded** — the most critical gap from Option A is closed: unreachable services produce an outgoing error log entry on the caller side                                                                        |
| C2  | **No Happy-Path Duplication** — successful calls are logged only once (by the downstream service); log volume is not increased for normal operation                                                                                               |
| C3  | **Aligned with Existing `ExternalServiceException` Pattern** — ADR-003 Component 3 already prescribes logging the raw upstream error internally before throwing `ExternalServiceException`; this option formalises and centralises that behaviour |

##### Cons

| #   | Con                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4  | **No Caller-Side Latency for Successful Calls** — perceived round-trip time between services is not measurable from logs alone; this requires distributed tracing (e.g., OpenTelemetry) if needed         |
| C5  | **Partial Migration Gap Remains** — if a downstream service is reachable but has not yet registered the `ObservabilityModule`, its incoming request is silently unlogged; the caller only logs on failure |

### Comparison

| Criterion                                              | Option A: No outgoing logging | Option B: Log all outgoing    | Option C: Log failures only   |
| ------------------------------------------------------ | ----------------------------- | ----------------------------- | ----------------------------- |
| Connectivity failure recorded on caller side           | ❌ Silent gap                 | ✅ Always recorded            | ✅ Always recorded            |
| Happy-path log duplication                             | ✅ None                       | ❌ Every call duplicated      | ✅ None                       |
| Caller-side latency measurement                        | ❌ Not available              | ✅ Full round-trip            | ❌ Failures only              |
| Migration safety net (unregistered downstream)         | ❌ Blind                      | ✅ Full coverage              | ⚠️ Failures only              |
| Implementation effort                                  | ✅ None                       | ⚠️ Axios interceptor required | ⚠️ Error handler required     |
| URL sanitisation required (ST011:4010)                 | ✅ N/A                        | ⚠️ Required for all calls     | ⚠️ Required for error entries |
| Aligns with ADR-003 `ExternalServiceException` pattern | ⚠️ Partial                    | ⚠️ Partial                    | ✅ Natural extension          |

### Decision

> **Accepted: Option C — Log failures only** — Architects' circle review, April 1, 2026.

**Rationale:** Logging failures only closes the critical observability gap — unreachable downstream services — without inflating log volume on every successful outgoing call. This is consistent with the `ExternalServiceException` pattern prescribed in ADR-003: the `catch` block that throws `ExternalServiceException` is the correct place to log the outgoing failure with the `correlationId`. For latency measurement across service boundaries, distributed tracing (OpenTelemetry / AWS X-Ray) is the appropriate tool; log-based round-trip measurement (Option B) is a fragile approximation rejected on those grounds.

### Reference Implementation (Option C — Failures Only)

```typescript
// Standardised outgoing-failure logging pattern inside any proxy / connector service
// Extends the ExternalServiceException usage already prescribed in ADR-003 Component 3

@Injectable()
export class UserManagementConnector {
  private readonly logger = new Logger(UserManagementConnector.name);

  constructor(private readonly httpService: HttpService) {}

  async getUser(userId: string): Promise<UserDto> {
    const url = `${process.env['USER_SERVICE_URL']}/users/${userId}`;
    const start = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.get<UserDto>(url, {
          headers: {
            // ADR-003 Component 4 — propagate correlationId to downstream service
            'X-Correlation-Id': getCorrelationStore()?.correlationId ?? crypto.randomUUID(),
          },
        }),
      );
      return response.data;
    } catch (error) {
      const duration = Date.now() - start;
      const axiosError = error as AxiosError;

      // Option C: log the failure on the caller side
      // ST011:2016 — never forward raw error.message to the client
      // ST011:4010 — sanitise URL (may contain user-identifiable path parameters)
      this.logger.error(
        `Outgoing Failed: GET ${sanitiseValue(url)} - ${
          axiosError.code ?? axiosError.response?.status ?? 'UNKNOWN'
        } - ${duration}ms`,
        JSON.stringify({
          correlationId: getCorrelationStore()?.correlationId,
          userId: getCorrelationStore()?.userId,
          url: sanitiseValue(url),
          method: 'GET',
          statusCode: axiosError.response?.status,
          errorCode: axiosError.code,
          duration,
          eventCategory: 'SERVER_ERROR',
        }),
      );

      // Pass only a safe, consumer-facing reason — never raw error.message (ST011:2016)
      throw new ExternalServiceException(
        'UserManagementService',
        'Service temporarily unavailable',
      );
    }
  }
}
```

```typescript
// Shared convention — fields required in every outgoing-failure log entry
// Document this interface in the coding standards or NestJS instructions
export interface OutgoingFailureLogFields {
  correlationId: string | undefined;
  userId: string | undefined;
  url: string; // sanitised — no PII in path parameters
  method: string;
  statusCode?: number; // HTTP status if response received; absent for network errors
  errorCode?: string; // e.g. 'ECONNREFUSED', 'ETIMEDOUT'
  duration: number; // caller-perceived ms
  eventCategory: 'SERVER_ERROR'; // always SERVER_ERROR for outgoing failures
}
```

### Consequences

#### If Option A is Accepted

##### Positive

- ✅ **Zero Implementation** — no outgoing interceptor, no HTTP middleware changes; proxy services require no additional work beyond registering the `ObservabilityModule`
- ✅ **Log Volume Unchanged** — no duplication; each request appears exactly once in the aggregated log stream

##### Negative

- ⚠️ **Silent Connectivity Failures** — when a downstream service is unreachable, the trace terminates at the caller's incoming log with no evidence of the attempted outgoing call; root-cause diagnosis relies on infrastructure-level signals (health checks, container logs) rather than application logs

##### Neutral

- ℹ️ **Acceptable Only at Full Rollout** — this option is only defensible once every downstream service has registered the `ObservabilityModule`; during migration it leaves visible traceability gaps

#### If Option B is Accepted

##### Positive

- ✅ **Complete Trace in All Scenarios** — every cross-service request is logged on both ends; the entire call graph is reconstructible from logs alone
- ✅ **Round-Trip Latency Observable** — caller-perceived duration vs. downstream-processing duration reveals network overhead per service pair

##### Negative

- ⚠️ **Log Volume Doubles for Proxy Services** — `user-management-proxy`, `aas-connector`, and `cx-connector` each produce two log entries per forwarded request; storage and query costs increase proportionally
- ⚠️ **Axios Interceptor Required** — a shared `OutgoingRequestInterceptor` must be added to the `ObservabilityModule` and registered in every service that uses `HttpModule`; adds scope to the shared module

##### Neutral

- ℹ️ **URL Sanitisation** — outgoing URLs (including any path parameters) must pass through `log-value-sanitiser.ts` before emission; particularly relevant for connector services that build URLs containing battery or passport identifiers

#### If Option C is Accepted

##### Positive

- ✅ **Critical Gap Closed** — connectivity failures, timeouts, and non-2xx upstream responses are always recorded on the caller side; `correlationId` traces have no silent gaps for error scenarios
- ✅ **No Happy-Path Duplication** — log volume is unchanged for normal operation; only failure paths produce an additional entry
- ✅ **Natural Fit with ADR-003** — the `ExternalServiceException` catch block is the standard place; no new interceptor is required, only a convention that the catch block logs with the correct fields before re-throwing

##### Negative

- ⚠️ **Round-Trip Latency Not Logged** — caller-perceived duration for successful calls is not available in logs; requires distributed tracing if cross-service latency visibility is a priority

##### Neutral

- ℹ️ **Convention Must Be Documented** — the logging pattern inside `catch` blocks wrapping external calls should be standardised (fields: `correlationId`, `url`, `method`, `statusCode` or error code, `duration`) and added to the coding standards or NestJS instructions

</details>

## Related Documentation

- [ADR-003: Logging, Error & Exception Handling Strategy for Backend Services](../architecture/003-logging-error-exception-handling.md)
- [TDR-004: ST011 Security Compliance in the Shared Observability Module](./004-sfera-st011-observability-compliance.md)
- [TDR-005: Siemens REST API Guidelines Compliance for the Shared Observability Module](./005-rest-api-guidelines-observability-compliance.md)
- [NestJS Instructions](../../.github/instructions/frameworks/nestjs.instructions.md)
- [Coding Standards](../../.github/instructions/standards/coding-standards.md)
- [Unit Test Standards](../../.github/instructions/standards/unit-test-standards.md)

## References

- [Node.js AsyncLocalStorage documentation](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [nestjs-cls — GitHub](https://github.com/Papooch/nestjs-cls)
- [nestjs-cls — Documentation](https://papooch.github.io/nestjs-cls/)
- [NestJS Custom Logger](https://docs.nestjs.com/techniques/logger#using-a-custom-logger)
- [NestJS APP_INTERCEPTOR / Global Registration](https://docs.nestjs.com/fundamentals/custom-providers)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Pino — GitHub](https://github.com/pinojs/pino)
- [Pino — Documentation](https://getpino.io/)
- [nestjs-pino — GitHub](https://github.com/iamolegga/nestjs-pino)
- [nestjs-pino — Documentation](https://iamolegga.github.io/nestjs-pino/)
- [pino-pretty — GitHub](https://github.com/pinojs/pino-pretty)
- [Winston — GitHub](https://github.com/winstonjs/winston)
- [nest-winston — GitHub](https://github.com/gremo/nest-winston)
- [NestJS Logger — Pino recommendation](https://docs.nestjs.com/techniques/logger)
