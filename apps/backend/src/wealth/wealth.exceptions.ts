import {
  BusinessException,
  type BusinessExceptionBody,
  ConflictException,
  ResourceNotFoundException,
  ValidationException,
} from '@vaultfolio/observability';
import { WEALTH_ERROR } from '@vaultfolio/api-contract';
import type { ValidationIssue } from '@vaultfolio/wealth';

/**
 * 503 for every wealth route while the encryption key is missing/invalid or a stored ciphertext
 * fails to authenticate. Fixed message — never carries a payload, name or amount.
 */
export class WealthUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: WEALTH_ERROR.unavailable,
        message: 'Wealth data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}

/** 400 naming fields only (`details[].field` + the issue code as `message`), never values. */
export class WealthValidationException extends ValidationException {
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
      error: WEALTH_ERROR.unknownField,
      message: 'The request contains a field that is not accepted.',
    };
  }
  if (issues.some((i) => i.code === 'LIMIT_EXCEEDED')) {
    return {
      error: WEALTH_ERROR.limitExceeded,
      message: 'The request exceeds an allowed limit.',
    };
  }
  return { error: WEALTH_ERROR.validation, message: 'The wealth data is invalid.' };
}

/** 400 for the per-user snapshot cap (no field to name). */
export class WealthLimitExceededException extends ValidationException {
  constructor() {
    super({
      error: WEALTH_ERROR.limitExceeded,
      message: 'The maximum number of snapshots has been reached.',
      details: [{ field: 'snapshots', message: 'LIMIT_EXCEEDED' }],
    });
  }
}

export class WealthSnapshotNotFoundException extends ResourceNotFoundException {
  constructor() {
    super({ error: WEALTH_ERROR.snapshotNotFound, message: 'Snapshot not found.' });
  }
}

/** 409; carries the id of the snapshot already holding the date so the UI can offer to open it. */
export class WealthSnapshotDateExistsException extends ConflictException {
  constructor(existingId: string) {
    super({
      error: WEALTH_ERROR.snapshotDateExists,
      message: 'A snapshot for this date already exists.',
      existingId,
    });
  }
}
