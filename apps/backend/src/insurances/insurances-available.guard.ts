import { CanActivate, Injectable } from '@nestjs/common';
import { InsurancesCryptoService } from './insurances-crypto.service';
import { InsurancesUnavailableException } from './insurances.exceptions';

/**
 * Fails every insurances route closed with `503 INSURANCES_UNAVAILABLE` while the encryption key is
 * missing, invalid or does not match the stored data — no partial data, no writes. Runs after the
 * global `AuthGuard`/`DomainGuard`, so unauthenticated or non-entitled callers still get 401/403.
 */
@Injectable()
export class InsurancesAvailableGuard implements CanActivate {
  constructor(private readonly crypto: InsurancesCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new InsurancesUnavailableException();
    }
    return true;
  }
}
