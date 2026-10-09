import { BusinessException, type BusinessExceptionBody } from '@vaultfolio/observability';

/**
 * 503 for every holdings route while the encryption key is missing/invalid or the domain is
 * locked. Fixed message, never carries a payload, name or amount.
 */
export class HoldingsUnavailableException extends BusinessException {
  constructor() {
    super(
      {
        error: 'HOLDINGS_UNAVAILABLE',
        message: 'Holdings data is temporarily unavailable.',
      } satisfies BusinessExceptionBody,
      503,
    );
  }
}
