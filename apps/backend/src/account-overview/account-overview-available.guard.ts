import { CanActivate, Injectable } from '@nestjs/common';
import { AccountOverviewCryptoService } from './account-overview-crypto.service';
import { AccountOverviewUnavailableException } from './account-overview.exceptions';

/**
 * Fails every account-overview route closed with `503 ACCOUNT_OVERVIEW_UNAVAILABLE` while the
 * encryption key is missing, invalid or does not match the stored data — no partial data, no
 * writes. Runs after the global `AuthGuard`/`DomainGuard`, so unauthenticated or non-entitled
 * callers still get 401/403.
 */
@Injectable()
export class AccountOverviewAvailableGuard implements CanActivate {
  constructor(private readonly crypto: AccountOverviewCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) {
      throw new AccountOverviewUnavailableException();
    }
    return true;
  }
}
