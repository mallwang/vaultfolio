import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mail/mailer.module';
import { EmailAvailabilityService } from '../shared/email-availability.service';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { SignupsController } from './signups.controller';
import { SignupsService } from './signups.service';
import { SignupsRepository } from './signups.repository';
import { EmailService } from './email.service';
import { SignupExpirySweepService } from './signup-expiry-sweep.service';

/** `AuthModule` exports `UsersRepository`/`SessionsRepository` — reused here rather than re-provided. */
@Module({
  imports: [AuthModule, MailerModule],
  controllers: [SignupsController],
  providers: [
    SignupsService,
    SignupsRepository,
    EmailService,
    EmailAvailabilityService,
    InvitationsRepository,
    SignupExpirySweepService,
  ],
})
export class SignupsModule {}
