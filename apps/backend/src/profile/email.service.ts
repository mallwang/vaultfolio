import { Injectable } from '@nestjs/common';
import { renderNotification } from '@vaultfolio/notifications';
import { MailerService } from '../mail/mailer.service';

function requireAbsoluteUrl(path: string): string {
  const url = `${process.env.APP_BASE_URL ?? ''}${path}`;

  // APP_BASE_URL must be an absolute http(s) URL — see
  // `invitations/email.service.ts` for the full rationale (a missing/
  // relative/schemeless value renders as a dead "about:blank#blocked" link
  // in most email clients).
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      `APP_BASE_URL is not a valid absolute URL (got "${process.env.APP_BASE_URL ?? ''}"). ` +
        'Set it to e.g. "https://vaultfolio.example.com" (must include the protocol).',
    );
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(
      `APP_BASE_URL must use http:// or https:// (got "${process.env.APP_BASE_URL ?? ''}").`,
    );
  }
  return url;
}

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
