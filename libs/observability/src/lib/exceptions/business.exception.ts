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
