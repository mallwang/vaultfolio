import { Module } from '@nestjs/common';
import { AccountOverviewController } from './account-overview.controller';
import { AccountOverviewService } from './account-overview.service';
import { AccountOverviewRepository } from './account-overview.repository';

@Module({
  controllers: [AccountOverviewController],
  providers: [AccountOverviewService, AccountOverviewRepository],
})
export class AccountOverviewModule {}
