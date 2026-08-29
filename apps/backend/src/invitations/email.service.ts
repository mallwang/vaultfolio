import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Outbound email, isolated behind one narrow interface (research.md #1,
 * mirroring the constitution's external-integration isolation rule) so a
 * later swap to a provider-specific HTTP API touches only this file. The
 * SMTP transport is created lazily per send — a misconfigured/unreachable
 * SMTP host must never crash the process at startup (data-model.md, FR-008).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Sends the invite-link email. Rethrows on delivery failure (connection
   * refused, auth failure, timeout) with context for the caller
   * (`InvitationsService`) to log and map to the 502 `email_delivery_failed`
   * response — never logs the token or SMTP credentials (Principle V).
   */
  async sendInvitation(to: string, token: string): Promise<void> {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });

    const acceptUrl = `${process.env.APP_BASE_URL ?? ''}/invite/${token}`;

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: "You're invited to Vaultfolio",
        text: `You've been invited to join Vaultfolio. Accept your invitation: ${acceptUrl}`,
        html: `<p>You've been invited to join Vaultfolio.</p><p><a href="${acceptUrl}">Accept your invitation</a></p>`,
      });
    } catch (error) {
      this.logger.error(`Invitation email delivery failed (recipient: ${to})`, error as Error);
      throw error;
    }
  }
}
