import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from '@vaultfolio/api-contract';

/**
 * Registered after `authInterceptor` (app.config.ts). Passes every response through unchanged —
 * it never swallows an error — so that Angular's own "was this Observable's error ever given a
 * handler" detection (RxJS's default `reportUnhandledError` escalation, which throws
 * asynchronously only when truly nobody downstream provided an error callback or a
 * fully-resolving `catchError`) keeps working exactly as it would with no interceptor at all.
 *
 * That escalation is what actually decides whether the fallback toast shows (`GlobalErrorHandler`,
 * global-error-handler.ts): an existing component's own `.subscribe({ error: fn })` — the pattern
 * used throughout this app (signup.component.ts, profile.component.ts, ...) — is unaffected by an
 * interceptor sitting earlier in the chain, since interceptors always run *before* the calling
 * code's own operators, never after. Deciding "handled or not" at the interceptor level would
 * require guessing (there is no synchronous signal to depend on), and would misfire for cases like
 * profile.component.ts's own specific `status === 502` handling — verified in this codebase, which
 * is exactly why FR-012 (no double notification for an already-handled failure) is delegated to
 * the one place that can answer it correctly for free.
 *
 * This file still owns the fallback message text (`buildFallbackDetail`), shared with
 * `GlobalErrorHandler` so both surfaces present the correlation ID identically (FR-013), and logs
 * every backend failure for local debugging regardless of whether anything else handles it.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.debug('Backend request failed', {
          url: req.urlWithParams,
          status: error.status,
          error,
        });
      }
      return throwError(() => error);
    }),
  );

/** Shared fallback toast copy — "Something went wrong (ref: ...)" when a correlationId is available. */
export function buildFallbackDetail(error: HttpErrorResponse): string {
  const body = error.error as Partial<ErrorResponse> | null;
  return body?.correlationId
    ? `Please try again. (ref: ${body.correlationId})`
    : 'Please try again.';
}
