import {
  BusinessException,
  ExternalServiceException,
  RateLimitException,
  type BusinessExceptionBody,
  ValidationException,
} from '@vaultfolio/observability';
import type { ErrorResponseDetail, FeedbackQuota } from '@vaultfolio/api-contract';

/** Fixed texts only: never the subject, the message or an address. */
export function feedbackInvalid(details: ErrorResponseDetail[]): ValidationException {
  return new ValidationException({
    error: 'validation_error',
    message: 'The feedback is not valid.',
    details,
  });
}

export class FeedbackLimitReachedException extends RateLimitException {
  constructor(quota: FeedbackQuota) {
    super({
      error: 'feedback_limit_reached',
      message: 'The daily feedback limit is reached.',
      quota,
    });
  }
}

export class FeedbackDeliveryFailedException extends ExternalServiceException {
  constructor() {
    super({
      error: 'feedback_delivery_failed',
      message: 'The feedback could not be delivered. Please try again later.',
    });
  }
}

/** 503 while the feedback encryption key is missing, wrong or the domain is migrating. */
export class FeedbackUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: 'feedback_unavailable',
        message: 'Feedback is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}
