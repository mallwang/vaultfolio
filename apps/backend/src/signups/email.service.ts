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
 * Outbound email for the sign-up flow (research.md #2) — a new instance
 * scoped to `signups/` rather than generalizing `invitations/email.service.ts`
 * into a shared mailer (YAGNI). Content is rendered by
 * `@vaultfolio/notifications` in the recipient's resolved `email_language`
 * (015); delivery goes through the shared `MailerService`.
 */
@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Verification-link email (FR-001/FR-003). Recipients have no account yet
   * — `preferredLanguage: null` resolves to English (data-model.md).
   */
  async sendVerification(to: string, token: string): Promise<void> {
    const verifyUrl = requireAbsoluteUrl(`/signup/verify/${token}`);
    const rendered = renderNotification({
      type: 'signup-verification',
      preferredLanguage: null,
      viewModel: { verifyUrl },
    });
    await this.mailerService.send({ to, ...rendered });
  }

  /**
   * Notifies every admin that a sign-up request is awaiting review
   * (FR-004): one render+send per admin, each in that admin's own resolved
   * language (015 FR-011), not one shared-language send to all.
   */
  async sendAdminNotification(
    admins: { email: string; emailLanguage: string | null }[],
    requestEmail: string,
  ): Promise<void> {
    await Promise.all(
      admins.map((admin) => {
        const rendered = renderNotification({
          type: 'signup-admin-alert',
          preferredLanguage: admin.emailLanguage,
          viewModel: { requestEmail },
        });
        return this.mailerService.send({ to: admin.email, ...rendered });
      }),
    );
  }

  /**
   * Sent when an admin approves the request (FR-006). The new account has
   * no `email_language` yet at this point — `preferredLanguage: null`
   * resolves to English.
   */
  async sendWelcome(to: string): Promise<void> {
    const rendered = renderNotification({
      type: 'signup-welcome',
      preferredLanguage: null,
      viewModel: { appUrl: process.env.APP_BASE_URL ?? '' },
    });
    await this.mailerService.send({ to, ...rendered });
  }

  /** Sent when an admin rejects the request. Never includes the reject reason (FR-009 of 007). */
  async sendRejection(to: string): Promise<void> {
    const rendered = renderNotification({
      type: 'signup-rejection',
      preferredLanguage: null,
      viewModel: {},
    });
    await this.mailerService.send({ to, ...rendered });
  }
}
