import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Ambient per-request state — see data-model.md#requestcontext. */
export interface RequestContext {
  correlationId: string;
  userId?: string;
}

/**
 * `AsyncLocalStorage`-backed request context (per research.md's "Correlation-context propagation
 * mechanism" decision): zero new dependency, no request-scoped DI performance cost. Populated once
 * per request by `CorrelationIdMiddleware` via `run()`, then read anywhere in that request's async
 * call chain (services, `RequestLoggingMiddleware`, `GlobalExceptionFilter`) without explicit
 * parameter threading. `userId` is read directly off `req.user` where needed (set by `AuthGuard`,
 * which runs after this context is established) rather than mutated onto the context, since guards
 * run after middleware and nothing downstream of them needs it via the ambient context.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }
}
