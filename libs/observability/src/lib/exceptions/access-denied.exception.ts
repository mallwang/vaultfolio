import { BusinessException, type BusinessExceptionBody } from './business.exception.js';

/** The caller is authenticated but lacks permission (data-model.md#categorizedfailure-businessexception-hierarchy). */
export class AccessDeniedException extends BusinessException {
  constructor(body: BusinessExceptionBody) {
    super(body, 403);
  }
}
