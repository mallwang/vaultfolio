import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

/** The request conflicts with existing state (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class ConflictException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 409);
  }
}
