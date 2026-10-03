import {
  BusinessException,
  type BusinessExceptionBody,
  ConflictException,
  ResourceNotFoundException,
  ValidationException,
} from '@vaultfolio/observability';
import type { RetirementCheckId } from '@vaultfolio/api-contract';
import type { ValidationIssue } from '@vaultfolio/retirement';

/**
 * 503 for every retirement route while the encryption key is missing/invalid or a stored
 * ciphertext fails to authenticate. Fixed message — never carries a payload, figure or identifier.
 */
export class RetirementUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: 'RETIREMENT_UNAVAILABLE',
        message: 'Retirement data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}

/** 400 naming fields only (`details[].field` + the issue code as `message`), never values. */
export class RetirementValidationException extends ValidationException {
  constructor(issues: readonly ValidationIssue[]) {
    const unknown = issues.some((i) => i.code === 'UNKNOWN_FIELD' || i.code === 'NOT_APPLICABLE');
    super({
      error: unknown ? 'RETIREMENT_UNKNOWN_FIELD' : 'RETIREMENT_VALIDATION',
      message: unknown
        ? 'The request contains a field that is not accepted.'
        : 'The retirement record is invalid.',
      details: issues.map((i) => ({ field: i.field, message: i.code })),
    });
  }
}

/** 400 listing the failed plausibility-check ids only (never figures). */
export class RetirementCheckFailedException extends ValidationException {
  constructor(failed: readonly RetirementCheckId[]) {
    super({
      error: 'RETIREMENT_CHECK_FAILED',
      message: 'The imported figures failed a plausibility check.',
      details: failed.map((id) => ({ field: id, message: 'CHECK_FAILED' })),
    });
  }
}

export class RetirementRecordNotFoundException extends ResourceNotFoundException {
  constructor() {
    super({ error: 'RETIREMENT_RECORD_NOT_FOUND', message: 'Retirement record not found.' });
  }
}

export class RetirementImportedReadonlyException extends ConflictException {
  constructor() {
    super({
      error: 'RETIREMENT_IMPORTED_READONLY',
      message: 'Imported records cannot be edited; only their supplement can.',
    });
  }
}

export class RetirementNotImportedException extends ConflictException {
  constructor() {
    super({
      error: 'RETIREMENT_NOT_IMPORTED',
      message: 'Only imported records have a supplement; edit manual records directly.',
    });
  }
}

export class RetirementStatutoryExistsException extends ConflictException {
  constructor() {
    super({
      error: 'RETIREMENT_STATUTORY_EXISTS',
      message: 'A statutory pension record already exists; replace it instead.',
    });
  }
}
