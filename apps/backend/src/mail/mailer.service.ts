import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailerSendRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * The one shared SMTP-transport adapter (research.md #5), consolidating the
 * three near-identical `nodemailer.createTransport({...})` +
 * `process.env.SMTP_*` blocks previously duplicated in
 * `profile/email.service.ts`, `signups/email.service.ts`, and
 * `invitations/email.service.ts`. Also owns the new `SMTP_SENDER_NAME`
 * handling (FR-008/FR-009/FR-010) in exactly one place. The transport is
 * created lazily per send — a misconfigured/unreachable SMTP host must
 * never crash the process (mirrors today's per-service behavior).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  private transport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }

  /**
   * `from` uses nodemailer's structured `{ name, address }` form when
   * `SMTP_SENDER_NAME` is set — nodemailer performs RFC 5322/2047-compliant
   * encoding of `name` (quoting/escaping/Q-encoding as needed), so a value
   * containing e.g. a double quote or comma still produces a valid header
   * (FR-010) with zero bespoke escaping code. Falls back to the bare
   * `SMTP_FROM` address when unset (today's behavior, FR-009).
   */
  private from(): string | { name: string; address: string } {
    const address = process.env.SMTP_FROM ?? '';
    const name = process.env.SMTP_SENDER_NAME;
    return name ? { name, address } : address;
  }

  /**
   * Sends a pre-rendered notification email. Rethrows on delivery failure
   * (connection refused, auth failure, timeout) with context for the caller
   * to map to a delivery-failure response — never logs credentials/tokens.
   */
  async send(request: MailerSendRequest): Promise<void> {
    try {
      await this.transport().sendMail({
        from: this.from(),
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      });
    } catch (error) {
      this.logger.error(`Email delivery failed (recipient: ${request.to})`, error as Error);
      throw error;
    }
  }
}
