import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

/** Shared SMTP-transport module — imported by every module whose `EmailService` needs to send. */
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
