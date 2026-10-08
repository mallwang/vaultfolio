import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mail/mailer.module';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { FeedbackAvailableGuard } from './feedback-available.guard';
import { FeedbackController } from './feedback.controller';
import { FeedbackCryptoService } from './feedback-crypto.service';
import { FeedbackEmailService } from './feedback-email.service';
import { FeedbackRepository } from './feedback.repository';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [AuthModule, MailerModule, TurnstileModule],
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    FeedbackRepository,
    FeedbackCryptoService,
    FeedbackEmailService,
    FeedbackAvailableGuard,
  ],
})
export class FeedbackModule {}
