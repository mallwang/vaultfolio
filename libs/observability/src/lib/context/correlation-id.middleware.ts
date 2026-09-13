import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { resolveCorrelationId } from './correlation-id.util.js';
import { RequestContextService } from './request-context.service.js';

/**
 * Resolves/generates the request's correlation ID and populates `RequestContextService` before
 * anything else runs (FR-001, US1). Registered as global Express middleware (not an interceptor)
 * because NestJS runs Guards before Interceptors — a guard-thrown exception (e.g. `AuthGuard`,
 * `RolesGuard`) would otherwise never see a populated context. Also sets the `X-Correlation-Id`
 * response header on every response, success or failure, per contracts/error-response.md.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = resolveCorrelationId(req.headers);
    res.setHeader('X-Correlation-Id', correlationId);
    this.requestContext.run({ correlationId }, () => next());
  }
}
