import { Injectable } from '@nestjs/common';
import { renderNotification } from '@vaultfolio/notifications';
import { requireAbsoluteUrl } from '../mail/absolute-url';
import { MailerService } from '../mail/mailer.service';

/**
 * Outbound email for the profile self-service flows (008 — research.md #4):
 * a deliberate third `EmailService` instance, not a shared one — mirrors
 * `invitations/email.service.ts`/`signups/email.service.ts`'s exact shape.
 * Content is rendered by `@vaultfolio/notifications` in the recipient's
 * resolved `email_language` (015, FR-001/FR-002); delivery goes through the
 * shared `MailerService` (FR-008/FR-009/FR-010).
 */
@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  /** Email-change verification link (FR-002), sent to the *new* address. */
  async sendEmailChangeVerification(
    user: { email: string; emailLanguage: string | null },
    newEmail: string,
    token: string,
  ): Promise<void> {
    const verifyUrl = requireAbsoluteUrl(`/account/verify-email/${token}`);
    const rendered = renderNotification({
      type: 'email-change-verification',
      preferredLanguage: user.emailLanguage,
      viewModel: { newEmail, verifyUrl },
    });
    await this.mailerService.send({ to: user.email, ...rendered });
  }

  /** Password-reset link (FR-006). */
  async sendPasswordReset(
    user: { email: string; emailLanguage: string | null },
    token: string,
  ): Promise<void> {
    const resetUrl = requireAbsoluteUrl(`/account/reset-password/${token}`);
    const rendered = renderNotification({
      type: 'password-reset',
      preferredLanguage: user.emailLanguage,
      viewModel: { resetUrl },
    });
    await this.mailerService.send({ to: user.email, ...rendered });
  }
}
