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
 * Outbound email for the profile self-service flows (008 — research.md #4):
 * a deliberate third `EmailService` instance, not a shared one — mirrors
 * `invitations/email.service.ts`/`signups/email.service.ts`'s exact lazy-
 * transport-construction pattern (created per send, never crashes the
 * process on a misconfigured/unreachable SMTP host, rethrows on failure for
 * the caller to map to a delivery-failure response).
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

  /** Email-change verification link (FR-002), sent to the *new* address. */
  async sendEmailChangeVerification(to: string, newEmail: string, token: string): Promise<void> {
    const verifyUrl = requireAbsoluteUrl(`/account/verify-email/${token}`);
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Confirm your new Vaultfolio email address',
        text: `Confirm this address (${newEmail}) as your new Vaultfolio email: ${verifyUrl}`,
        html: `<p>Confirm <strong>${newEmail}</strong> as your new Vaultfolio email.</p><p><a href="${verifyUrl}">Confirm email change</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        `Email-change verification delivery failed (recipient: ${to})`,
        error as Error,
      );
      throw error;
    }
  }

  /** Password-reset link (FR-006). */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = requireAbsoluteUrl(`/account/reset-password/${token}`);
    try {
      await this.transport().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Reset your Vaultfolio password',
        text: `Reset your Vaultfolio password: ${resetUrl}`,
        html: `<p>Reset your Vaultfolio password.</p><p><a href="${resetUrl}">Reset password</a></p>`,
      });
    } catch (error) {
      this.logger.error(`Password-reset email delivery failed (recipient: ${to})`, error as Error);
      throw error;
    }
  }
}
