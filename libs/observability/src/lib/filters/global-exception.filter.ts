import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponse } from '@vaultfolio/api-contract';
import { RequestContextService } from '../context/request-context.service.js';
import { BusinessException } from '../exceptions/business.exception.js';

const FALLBACK_ERROR_RESPONSE: ErrorResponse = {
  error: 'internal_server_error',
  message: 'Something went wrong. Please try again.',
  correlationId: 'unknown',
};

/**
 * Catches every thrown error (`APP_FILTER`, global scope) and builds the additive `ErrorResponse`
 * body — `error`, `message`, `correlationId`, optional `details` — per contracts/error-response.md
 * (FR-002, FR-003). Also classifies severity and logs the failure (FR-005, FR-006 — US2, T022) and
 * sets the `X-Correlation-Id` response header on every response it handles.
 *
 * Its own body-building logic is wrapped in try/catch (FR-015): a bug here must never prevent the
 * original request from getting a response — it falls back to a plain generic 500 `ErrorResponse`.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    let response: Response;
    try {
      response = host.switchToHttp().getResponse<Response>();
    } catch (unrecoverable) {
      // Nothing left to respond with — log and give up; this should never happen in practice.
      this.logger.error(
        'GlobalExceptionFilter could not obtain the response object',
        unrecoverable,
      );
      return;
    }

    try {
      const request = host.switchToHttp().getRequest<Request>();
      const correlationId =
        this.requestContext.getCorrelationId() ?? FALLBACK_ERROR_RESPONSE.correlationId;
      const { status, body } = buildErrorResponse(exception, correlationId);

      this.logFailure(exception, status, correlationId, request);

      response.setHeader('X-Correlation-Id', correlationId);
      response.status(status).json(body);
    } catch (filterError) {
      this.logger.error(
        'GlobalExceptionFilter failed while building an error response',
        filterError,
      );
      try {
        response.setHeader('X-Correlation-Id', FALLBACK_ERROR_RESPONSE.correlationId);
      } catch {
        // Setting the header itself failed — fall through and still attempt to answer the request.
      }
      response.status(500).json(FALLBACK_ERROR_RESPONSE);
    }
  }

  /** Severity classification per data-model.md: status < 500 -> WARN, >= 500 or unhandled -> ERROR (FR-005, FR-006). */
  private logFailure(
    exception: unknown,
    status: number,
    correlationId: string,
    request: Request,
  ): void {
    const context = { correlationId, method: request.method, path: request.url };
    if (status < 500) {
      this.logger.warn({ ...context, message: exceptionMessage(exception) });
    } else {
      // Full stack trace, server-side only — never included in the response body (FR-006).
      this.logger.error({ ...context, error: exception });
    }
  }
}

function buildErrorResponse(
  exception: unknown,
  correlationId: string,
): { status: number; body: ErrorResponse } {
  if (exception instanceof BusinessException) {
    const status = exception.getStatus();
    const responseBody = exception.getResponse() as { error: string; message: string };
    const body: ErrorResponse = {
      error: responseBody.error,
      message: responseBody.message,
      correlationId,
    };
    if (exception.details) {
      body.details = exception.details;
    }
    return { status, body };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const { error, message } = normaliseHttpExceptionResponse(raw, exception.message);
    return { status, body: { error, message, correlationId } };
  }

  return {
    status: 500,
    body: { ...FALLBACK_ERROR_RESPONSE, correlationId },
  };
}

/** Existing ad hoc `HttpException` throws (e.g. Turnstile) already pass `{ error, message }` bodies; anything else (built-in Nest exceptions) falls back to a generic code derived from the status. */
function normaliseHttpExceptionResponse(
  raw: unknown,
  fallbackMessage: string,
): { error: string; message: string } {
  if (raw && typeof raw === 'object' && 'error' in raw && 'message' in raw) {
    const candidate = raw as { error: unknown; message: unknown };
    if (typeof candidate.error === 'string' && typeof candidate.message === 'string') {
      return { error: candidate.error, message: candidate.message };
    }
  }
  return { error: 'error', message: fallbackMessage };
}

function exceptionMessage(exception: unknown): string {
  return exception instanceof Error ? exception.message : String(exception);
}
