import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service.js';
import { sanitiseLogValue } from '../utils/log-value-sanitiser.js';

type AuthenticatedRequest = Request & { user?: { id?: string } };

/**
 * Logs the request's full lifecycle — exactly one "Incoming Request" line at entry and exactly one
 * of "Request Completed" / "Request Failed" at exit, per request (FR-004) — with method, path,
 * duration, status code, correlation ID, and `userId` when authenticated (spec Edge Cases).
 *
 * Implemented as Express middleware (applied after `CorrelationIdMiddleware`, still before Guards
 * run) rather than an interceptor: NestJS interceptors never run for a request a Guard rejects
 * (`AuthGuard`, `RolesGuard`, `TurnstileGuard`, ...) — verified against the running app — which
 * would otherwise silently produce zero lifecycle log lines for every guard-rejected request,
 * violating FR-004's "every request" guarantee. Hooking `res.on('finish')` fires for every
 * response regardless of which layer produced it (a guard rejection, a pipe validation failure, a
 * normal handler, or `GlobalExceptionFilter`'s own fallback), so this middleware alone gives
 * complete coverage. `req.user`, though set later by `AuthGuard`, is still safe to read inside the
 * `finish` callback since that only fires once the whole request/response cycle has completed.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  constructor(private readonly requestContext: RequestContextService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const correlationId = this.requestContext.getCorrelationId();
    const start = Date.now();
    const method = req.method;
    const path = sanitiseLogValue(req.originalUrl ?? req.url);

    this.safeLog(() => this.logger.log({ event: 'Incoming Request', correlationId, method, path }));

    res.on('finish', () => {
      const userId = req.user?.id;
      const failed = res.statusCode >= 400;
      this.safeLog(() =>
        this.logger.log({
          event: failed ? 'Request Failed' : 'Request Completed',
          correlationId,
          method,
          path,
          userId,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          outcome: failed ? 'failed' : 'completed',
        }),
      );
    });

    next();
  }

  /** A logging failure must never break the request/response cycle (FR-015). */
  private safeLog(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this.logger.error('RequestLoggingMiddleware failed to write a lifecycle log line', err);
    }
  }
}
