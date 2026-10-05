import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EarningsModule } from '../earnings/earnings.module';
import { MailerModule } from '../mail/mailer.module';
import { InsurancesAvailableGuard } from './insurances-available.guard';
import { InsurancesCryptoService } from './insurances-crypto.service';
import { InsurancesLinkedSocialService } from './insurances-linked-social.service';
import { InsurancesReminderService } from './insurances-reminder.service';
import { InsurancesController } from './insurances.controller';
import { InsurancesRepository } from './insurances.repository';
import { InsurancesService } from './insurances.service';

@Module({
  imports: [AuthModule, EarningsModule, MailerModule],
  controllers: [InsurancesController],
  providers: [
    InsurancesService,
    InsurancesRepository,
    InsurancesCryptoService,
    InsurancesAvailableGuard,
    InsurancesLinkedSocialService,
    InsurancesReminderService,
  ],
})
export class InsurancesModule {}
