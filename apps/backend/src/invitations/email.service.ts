import { Injectable } from '@nestjs/common';
import { renderNotification } from '@vaultfolio/notifications';
import { requireAbsoluteUrl } from '../mail/absolute-url';
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
    const acceptUrl = requireAbsoluteUrl(`/invite/${token}`);

    const rendered = renderNotification({
      type: 'invitation',
      preferredLanguage: null,
      recipient: to,
      viewModel: { acceptUrl },
    });
    await this.mailerService.send({ to, ...rendered });
  }
}
