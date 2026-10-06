import { BusinessException, type BusinessExceptionBody } from '@vaultfolio/observability';
import { ACCOUNT_OVERVIEW_ERROR } from '@vaultfolio/api-contract';

/**
 * 503 for every account-overview route while the encryption key is missing/invalid or a stored
 * ciphertext fails to authenticate. Fixed message — never carries a payload, name or card number.
 */
export class AccountOverviewUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: ACCOUNT_OVERVIEW_ERROR.unavailable,
        message: 'Account data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}
