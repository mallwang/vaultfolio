import { HttpException } from '@nestjs/common';
import type { ErrorResponseDetail } from '@vaultfolio/api-contract';

/** Constructor payload shared by every `BusinessException` subclass. */
export interface BusinessExceptionBody {
  /** Existing stable machine-readable code (e.g. 'bot_protection_failed'). */
  error: string;
  /** Existing human-readable message. */
  message: string;
  /** Only for field-level validation errors. */
  details?: ErrorResponseDetail[];
}

/**
 * Base of the six categorized-failure subclasses (data-model.md#categorizedfailure-businessexception-hierarchy).
 * Each subclass fixes its own HTTP status; the `{ error, message, details? }` body keeps the
 * existing flat contract shape so migrated throw sites (e.g. `turnstile.service.ts`) can preserve
 * their existing `error` code string verbatim (FR-008).
 */
export abstract class BusinessException extends HttpException {
  readonly details?: ErrorResponseDetail[];

  protected constructor(body: BusinessExceptionBody, status: number) {
    super({ error: body.error, message: body.message }, status);
    this.details = body.details;
  }
}

/** A business-rule validation failure, optionally with field-level `details` (data-model.md). */
export class ValidationException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 400);
  }
}

/** The caller is authenticated but lacks permission (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class AccessDeniedException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 403);
  }
}

/** A referenced resource does not exist (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class ResourceNotFoundException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 404);
  }
}

/** The request conflicts with existing state (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class ConflictException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 409);
  }
}

/** The caller has exceeded an allowed rate (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class RateLimitException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 429);
  }
}

/**
 * A dependent outside service failed (e.g. Cloudflare Turnstile siteverify). HTTP 502 puts this
 * status into the filter's `>= 500` bucket, so it logs at ERROR even though it is a "categorized"
 * failure — its root cause is a system dependency, not caller misuse (data-model.md).
 */
export class ExternalServiceException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 502);
  }
}
