import { Module } from '@nestjs/common';
import { EarningsAvailableGuard } from './earnings-available.guard';
import { EarningsCryptoService } from './earnings-crypto.service';
import { EarningsController } from './earnings.controller';
import { EarningsRepository } from './earnings.repository';
import { EarningsService } from './earnings.service';

@Module({
  controllers: [EarningsController],
  providers: [EarningsService, EarningsRepository, EarningsCryptoService, EarningsAvailableGuard],
})
export class EarningsModule {}
