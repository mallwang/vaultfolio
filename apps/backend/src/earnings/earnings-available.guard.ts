import { CanActivate, Injectable } from '@nestjs/common';
import { EarningsCryptoService } from './earnings-crypto.service';
import { EarningsUnavailableException } from './earnings.exceptions';

/**
 * Fails every earnings route closed with `503 EARNINGS_UNAVAILABLE` while the encryption key is
 * missing, invalid or does not match the stored data (FR-044) — no partial figures, no imports.
 * Runs after the global `AuthGuard`/`DomainGuard`, so unauthenticated or non-entitled callers
 * still get 401/403.
 */
@Injectable()
export class EarningsAvailableGuard implements CanActivate {
  constructor(private readonly crypto: EarningsCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new EarningsUnavailableException();
    }
    return true;
  }
}
