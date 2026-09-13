import { SetMetadata } from '@nestjs/common';

export const SUPPRESS_REQUEST_LOGGING_KEY = 'suppressRequestLogging';

/**
 * Marks a route as one that should be opted out of `RequestLoggingMiddleware`'s lifecycle log
 * lines (e.g. a future high-frequency health/metrics endpoint), without touching the middleware
 * itself. Not applied to any route by this feature (`GET /health` is already never intercepted at
 * all — FR-017, since `RequestLoggingMiddleware` still runs for it but nothing in this feature
 * reads this metadata yet) — kept available for a future need.
 *
 * Note: `RequestLoggingMiddleware` runs as Express middleware, before NestJS resolves the matched
 * route handler, so it cannot read this handler-level metadata directly (a `Reflector` lookup
 * needs an `ExecutionContext`, only available from a Guard/Interceptor/Pipe). Wiring this up for a
 * real route will need `MiddlewareConsumer.exclude(path)` in `observability.module.ts` (path-based)
 * or an interceptor-set flag read back in the middleware's `res.on('finish')` handler, whichever
 * fits the route in question — left as-is until a concrete need exists.
 */
export const SuppressRequestLogging = () => SetMetadata(SUPPRESS_REQUEST_LOGGING_KEY, true);
