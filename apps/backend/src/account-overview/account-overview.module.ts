import { Module } from '@nestjs/common';
import { AccountOverviewAvailableGuard } from './account-overview-available.guard';
import { AccountOverviewController } from './account-overview.controller';
import { AccountOverviewCryptoService } from './account-overview-crypto.service';
import { AccountOverviewService } from './account-overview.service';
import { AccountOverviewRepository } from './account-overview.repository';

@Module({
  controllers: [AccountOverviewController],
  providers: [
    AccountOverviewService,
    AccountOverviewRepository,
    AccountOverviewCryptoService,
    AccountOverviewAvailableGuard,
  ],
})
export class AccountOverviewModule {}
