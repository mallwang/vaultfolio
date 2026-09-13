import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { buildFallbackDetail } from './http-error.interceptor';

/**
 * App-wide `ErrorHandler` (registered in app.config.ts). Two responsibilities:
 *
 * 1. In-app (non-HTTP) uncaught exceptions (FR-014) — a synchronous throw or unhandled promise
 *    rejection anywhere in the app, routed here by Angular's zone-based error handling (see
 *    `provideBrowserGlobalErrorListeners()`, already registered).
 * 2. A backend call that genuinely nobody handled (FR-011) — RxJS's own default
 *    `reportUnhandledError` mechanism throws such an error asynchronously precisely when no
 *    subscriber anywhere in the chain provided an error callback; that throw runs inside an
 *    Angular zone task, so it reaches this same handler with the original `HttpErrorResponse`.
 *    A component with its own `.subscribe({ error: fn })` (or a swallowing `catchError`) means
 *    this branch is never invoked for that call — see http-error.interceptor.ts's header comment
 *    for the full reasoning behind why detection lives here rather than in an interceptor.
 *
 * Both cases show the same non-blocking `MessageService` toast pattern already used throughout the
 * app (profile.component.ts, preferences.component.ts) rather than leaving the page frozen/blank.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly messageService = inject(MessageService);

  handleError(error: unknown): void {
    const httpError = extractHttpErrorResponse(error);
    if (httpError) {
      console.error('Unhandled backend error', httpError);
      this.messageService.add({
        severity: 'error',
        summary: 'Something went wrong',
        detail: buildFallbackDetail(httpError),
        life: 8000,
      });
      return;
    }

    console.error('Unhandled application error', error);
    this.messageService.add({
      severity: 'error',
      summary: 'Something went wrong',
      detail: 'Please try again.',
      life: 8000,
    });
  }
}

/** zone.js sometimes wraps a rejected promise's reason under `.rejection`. */
function extractHttpErrorResponse(error: unknown): HttpErrorResponse | null {
  if (error instanceof HttpErrorResponse) {
    return error;
  }
  const rejection = (error as { rejection?: unknown } | null)?.rejection;
  return rejection instanceof HttpErrorResponse ? rejection : null;
}
