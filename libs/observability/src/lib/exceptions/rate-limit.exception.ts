import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

/** The caller has exceeded an allowed rate (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class RateLimitException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 429);
  }
}
