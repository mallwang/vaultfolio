import {
  BusinessException,
  type BusinessExceptionBody,
  ResourceNotFoundException,
  ValidationException,
} from '@vaultfolio/observability';
import { INSURANCES_ERROR } from '@vaultfolio/api-contract';
import type { ValidationIssue } from '@vaultfolio/insurances';

/**
 * 503 for every insurances route while the encryption key is missing/invalid or a stored
 * ciphertext fails to authenticate. Fixed message — never carries a payload, name or amount.
 */
export class InsurancesUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: INSURANCES_ERROR.unavailable,
        message: 'Insurances data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}

/** 400 naming fields only (`details[].field` + the issue code as `message`), never values. */
export class InsurancesValidationException extends ValidationException {
  constructor(issues: readonly ValidationIssue[]) {
    super({
      ...bodyFor(issues),
      details: issues.map((i) => ({ field: i.field, message: i.code })),
    });
  }
}

function bodyFor(issues: readonly ValidationIssue[]): BusinessExceptionBody {
  if (issues.some((i) => i.code === 'UNKNOWN_FIELD')) {
    return {
      error: INSURANCES_ERROR.unknownField,
      message: 'The request contains a field that is not accepted.',
    };
  }
  if (issues.some((i) => i.code === 'LIMIT')) {
    return {
      error: INSURANCES_ERROR.limitExceeded,
      message: 'The request exceeds an allowed limit.',
    };
  }
  return { error: INSURANCES_ERROR.validation, message: 'The insurance data is invalid.' };
}

/** 400 for the per-user contract cap (no field to name). */
export class InsurancesLimitExceededException extends ValidationException {
  constructor() {
    super({
      error: INSURANCES_ERROR.limitExceeded,
      message: 'The maximum number of contracts has been reached.',
      details: [{ field: 'contracts', message: 'LIMIT' }],
    });
  }
}

export class InsurancesContractNotFoundException extends ResourceNotFoundException {
  constructor() {
    super({ error: INSURANCES_ERROR.contractNotFound, message: 'Contract not found.' });
  }
}
