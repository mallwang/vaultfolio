import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

/** A referenced resource does not exist (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class ResourceNotFoundException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 404);
  }
}
