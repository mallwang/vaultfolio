import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HoldingsAvailableGuard } from './holdings-available.guard';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';
import { HoldingsRepository } from './holdings.repository';

@Module({
  imports: [AuthModule],
  controllers: [HoldingsController],
  providers: [HoldingsService, HoldingsRepository, HoldingsCryptoService, HoldingsAvailableGuard],
})
export class HoldingsModule {}
