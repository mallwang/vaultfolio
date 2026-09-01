import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mail/mailer.module';
import { EmailAvailabilityService } from '../shared/email-availability.service';
import { SignupsRepository } from '../signups/signups.repository';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsRepository } from './invitations.repository';
import { EmailService } from './email.service';

/**
 * `AuthModule` exports `UsersRepository`/`SessionsRepository` — reused here
 * rather than re-provided. `SignupsRepository` is provided directly (rather
 * than importing `SignupsModule`, which would create a module cycle since
 * `SignupsModule` itself needs nothing from here) purely so
 * `EmailAvailabilityService` can see 007's sign-up/blacklist tables.
 */
@Module({
  imports: [AuthModule, MailerModule],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    InvitationsRepository,
    EmailService,
    EmailAvailabilityService,
    SignupsRepository,
  ],
})
export class InvitationsModule {}
