import { Injectable } from '@nestjs/common';
import { renderNotification } from '@vaultfolio/notifications';
import { MailerService } from '../mail/mailer.service';

/**
 * Outbound email, isolated behind one narrow interface (research.md #1,
 * mirroring the constitution's external-integration isolation rule) so a
 * later swap to a provider-specific HTTP API touches only this file.
 * Content is rendered by `@vaultfolio/notifications` (015); delivery goes
 * through the shared `MailerService`.
 */
@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Sends the invite-link email. Rethrows on delivery failure (connection
   * refused, auth failure, timeout) with context for the caller
   * (`InvitationsService`) to log and map to the 502 `email_delivery_failed`
   * response — never logs the token or SMTP credentials (Principle V).
   * Invitees have no account/preference yet — `preferredLanguage: null`
   * resolves to English (data-model.md).
   */
  async sendInvitation(to: string, token: string): Promise<void> {
    const acceptUrl = `${process.env.APP_BASE_URL ?? ''}/invite/${token}`;

    // APP_BASE_URL must be an absolute http(s) URL. A missing/relative/
    // schemeless value (e.g. unset, or "www.example.com" without the
    // protocol) produces a link that most email clients render as
    // "about:blank#blocked" instead of navigating anywhere — fail loudly
    // here rather than silently mailing out a dead link.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(acceptUrl);
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

    const rendered = renderNotification({
      type: 'invitation',
      preferredLanguage: null,
      viewModel: { acceptUrl },
    });
    await this.mailerService.send({ to, ...rendered });
  }
}
