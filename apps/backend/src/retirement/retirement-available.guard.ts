import { CanActivate, Injectable } from '@nestjs/common';
import { RetirementCryptoService } from './retirement-crypto.service';
import { RetirementUnavailableException } from './retirement.exceptions';

/**
 * Fails every retirement route closed with `503 RETIREMENT_UNAVAILABLE` while the encryption key
 * is missing, invalid or does not match the stored data — no partial figures, no writes. Runs
 * after the global `AuthGuard`/`DomainGuard`, so unauthenticated or non-entitled callers still
 * get 401/403.
 */
@Injectable()
export class RetirementAvailableGuard implements CanActivate {
  constructor(private readonly crypto: RetirementCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new RetirementUnavailableException();
    }
    return true;
  }
}
