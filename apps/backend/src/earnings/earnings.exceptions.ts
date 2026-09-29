import { BusinessException, type BusinessExceptionBody } from '@vaultfolio/observability';

/**
 * 503 for every earnings route while the encryption key is missing/invalid or a stored ciphertext
 * fails to authenticate (FR-044). Fixed message — never carries a payload, amount or row content.
 */
export class EarningsUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: 'EARNINGS_UNAVAILABLE',
        message: 'Earnings data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}
