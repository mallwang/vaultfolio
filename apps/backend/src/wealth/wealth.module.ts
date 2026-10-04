import { Module } from '@nestjs/common';
import { WealthAvailableGuard } from './wealth-available.guard';
import { WealthCryptoService } from './wealth-crypto.service';
import { WealthController } from './wealth.controller';
import { WealthRepository } from './wealth.repository';
import { WealthService } from './wealth.service';

@Module({
  controllers: [WealthController],
  providers: [WealthService, WealthRepository, WealthCryptoService, WealthAvailableGuard],
})
export class WealthModule {}
