import { BusinessException, type BusinessExceptionBody } from '@vaultfolio/observability';

const body = (error: string, message: string): BusinessExceptionBody => ({ error, message });

export class EncryptionDomainNotFoundException extends BusinessException {
  constructor() {
    super(body('ENCRYPTION_DOMAIN_NOT_FOUND', 'Unknown encryption domain.'), 404);
  }
}

/** The domain is not `READY` (key missing/wrong, migrating, re-encrypting). */
export class EncryptionDomainNotReadyException extends BusinessException {
  constructor() {
    super(body('ENCRYPTION_DOMAIN_NOT_READY', 'The domain is not ready for this operation.'), 409);
  }
}

export class EncryptionOperationRunningException extends BusinessException {
  constructor() {
    super(
      body('ENCRYPTION_OPERATION_RUNNING', 'Another encryption operation runs for this domain.'),
      409,
    );
  }
}

export class EncryptionKeyNotRetiredException extends BusinessException {
  constructor() {
    super(body('ENCRYPTION_KEY_NOT_RETIRED', 'Only a retired data key can be destroyed.'), 409);
  }
}

export class EncryptionKeyInUseException extends BusinessException {
  constructor() {
    super(body('ENCRYPTION_KEY_IN_USE', 'Stored rows still use this data key.'), 409);
  }
}

export class EncryptionConfirmationMismatchException extends BusinessException {
  constructor() {
    super(
      body('ENCRYPTION_CONFIRMATION_MISMATCH', 'The confirmation must equal the domain id.'),
      400,
    );
  }
}
