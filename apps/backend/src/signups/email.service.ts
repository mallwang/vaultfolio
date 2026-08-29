import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
 * into a shared mailer (YAGNI), following its exact lazy-transport
 * construction pattern: created per send, never crashes the process on a
 * misconfigured/unreachable SMTP host, rethrows on failure for the caller to
 * map to the 502 `email_delivery_failed` response.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private transport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }

  /** Verification-link email (FR-001/FR-003). */
  async sendVerification(to: string, token: string): Promise<void> {
    const verifyUrl = requireAbsoluteUrl(`/signup/verify/${token}`);
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Verify your Vaultfolio sign-up',
        text: `Confirm your Vaultfolio sign-up: ${verifyUrl}`,
        html: `<p>Confirm your Vaultfolio sign-up.</p><p><a href="${verifyUrl}">Verify your email</a></p>`,
      });
    } catch (error) {
      this.logger.error(`Verification email delivery failed (recipient: ${to})`, error as Error);
      throw error;
    }
  }

  /** Notifies every admin that a sign-up request is awaiting review (FR-004). */
  async sendAdminNotification(adminEmails: string[], requestEmail: string): Promise<void> {
    if (adminEmails.length === 0) {
      return;
    }
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to: adminEmails,
        subject: 'New Vaultfolio sign-up awaiting review',
        text: `${requestEmail} has verified their email and is awaiting sign-up approval.`,
        html: `<p><strong>${requestEmail}</strong> has verified their email and is awaiting sign-up approval.</p>`,
      });
    } catch (error) {
      this.logger.error('Admin-notification email delivery failed', error as Error);
      throw error;
    }
  }

  /** Sent when an admin approves the request (FR-006). */
  async sendWelcome(to: string): Promise<void> {
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Your Vaultfolio account is ready',
        text: `Your sign-up was approved — you can now sign in to Vaultfolio: ${process.env.APP_BASE_URL ?? ''}`,
        html: `<p>Your sign-up was approved — you can now <a href="${process.env.APP_BASE_URL ?? ''}">sign in to Vaultfolio</a>.</p>`,
      });
    } catch (error) {
      this.logger.error(`Welcome email delivery failed (recipient: ${to})`, error as Error);
      throw error;
    }
  }

  /** Sent when an admin rejects the request. Never includes the reject reason (FR-009). */
  async sendRejection(to: string): Promise<void> {
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Your Vaultfolio sign-up was not approved',
        text: 'Your Vaultfolio sign-up request was not approved.',
        html: '<p>Your Vaultfolio sign-up request was not approved.</p>',
      });
    } catch (error) {
      this.logger.error(`Rejection email delivery failed (recipient: ${to})`, error as Error);
      throw error;
    }
  }
}
