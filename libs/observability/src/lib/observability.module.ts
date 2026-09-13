import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CorrelationIdMiddleware } from './context/correlation-id.middleware.js';
import { RequestLoggingMiddleware } from './context/request-logging.middleware.js';
import { RequestContextService } from './context/request-context.service.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';

/**
 * Wires the correlation-id + request-lifecycle-logging middleware and the global exception filter
 * in once, at the application root (FR-001–FR-006). Import once into `AppModule` — see
 * specs/030-observability-logging-error-handling/plan.md.
 */
@Module({
  providers: [
    RequestContextService,
    CorrelationIdMiddleware,
    RequestLoggingMiddleware,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [RequestContextService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applied before Guards run (Nest's middleware -> guards -> interceptors order), so every
    // guard-thrown exception (AuthGuard, RolesGuard, ...) still sees a populated context and a
    // logged lifecycle, in that order — CorrelationIdMiddleware must run first so
    // RequestLoggingMiddleware can read the correlation ID it establishes.
    consumer.apply(CorrelationIdMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
