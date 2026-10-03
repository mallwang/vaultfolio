import { Module } from '@nestjs/common';
import { RetirementAvailableGuard } from './retirement-available.guard';
import { RetirementCryptoService } from './retirement-crypto.service';
import { RetirementController } from './retirement.controller';
import { RetirementRepository } from './retirement.repository';
import { RetirementService } from './retirement.service';

@Module({
  controllers: [RetirementController],
  providers: [
    RetirementService,
    RetirementRepository,
    RetirementCryptoService,
    RetirementAvailableGuard,
  ],
})
export class RetirementModule {}
