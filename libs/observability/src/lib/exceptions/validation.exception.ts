import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

/** A business-rule validation failure, optionally with field-level `details` (data-model.md). */
export class ValidationException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 400);
  }
}
