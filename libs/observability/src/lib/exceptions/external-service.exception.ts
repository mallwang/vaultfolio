import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

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
