import { CanActivate, Injectable } from '@nestjs/common';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsUnavailableException } from './holdings.exceptions';

/**
 * Fails every holdings route closed with `503 HOLDINGS_UNAVAILABLE` while the encryption key is
 * missing, invalid or does not match the stored data. Runs after the global auth/domain guards.
 */
@Injectable()
export class HoldingsAvailableGuard implements CanActivate {
  constructor(private readonly crypto: HoldingsCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new HoldingsUnavailableException();
    }
    return true;
  }
}
