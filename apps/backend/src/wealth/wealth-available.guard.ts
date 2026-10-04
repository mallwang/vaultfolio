import { CanActivate, Injectable } from '@nestjs/common';
import { WealthCryptoService } from './wealth-crypto.service';
import { WealthUnavailableException } from './wealth.exceptions';

/**
 * Fails every wealth route closed with `503 WEALTH_UNAVAILABLE` while the encryption key is
 * missing, invalid or does not match the stored data — no partial data, no writes. Runs after the
 * global `AuthGuard`/`DomainGuard`, so unauthenticated or non-entitled callers still get 401/403.
 */
@Injectable()
export class WealthAvailableGuard implements CanActivate {
  constructor(private readonly crypto: WealthCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new WealthUnavailableException();
    }
    return true;
  }
}
