import { Injectable } from '@nestjs/common';
import { type InsuranceLinkedSocialLine, UserRole } from '@vaultfolio/api-contract';
import { linkedLinesFromEarnings } from '@vaultfolio/insurances';
import type { RequestUser } from '../auth/current-user.decorator';
import { EarningsCryptoService } from '../earnings/earnings-crypto.service';
import { EarningsService } from '../earnings/earnings.service';

/**
 * Derives the read-only statutory social-insurance lines from the caller's own Earnings data on
 * every request (R6). Nothing is copied or stored; without entitlement, key or data the result is
 * simply empty and the UI offers manual entry.
 */
@Injectable()
export class InsurancesLinkedSocialService {
  constructor(
    private readonly earnings: EarningsService,
    private readonly earningsCrypto: EarningsCryptoService,
  ) {}

  linesFor(user: RequestUser): InsuranceLinkedSocialLine[] {
    const entitled = user.role === UserRole.ADMIN || user.domainScopes.includes('earnings');
    if (!entitled || !this.earningsCrypto.available) return [];
    try {
      return linkedLinesFromEarnings(
        this.earnings.records(user.id).map((r) => ({
          period: r.period,
          amounts: r.amounts,
        })),
      );
    } catch {
      return [];
    }
  }
}
