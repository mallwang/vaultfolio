import { Module } from '@nestjs/common';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';
import { HoldingsRepository } from './holdings.repository';

@Module({
  controllers: [HoldingsController],
  providers: [HoldingsService, HoldingsRepository],
})
export class HoldingsModule {}
