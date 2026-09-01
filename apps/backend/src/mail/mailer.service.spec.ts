import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';

jest.mock('nodemailer');

/**
 * Unit tests for `MailerService`'s `SMTP_SENDER_NAME` handling
 * (FR-008/FR-009/FR-010) and error propagation. `sendMail` is mocked so
 * these assert the exact arguments `MailerService` passes to nodemailer —
 * nodemailer's own RFC 5322/2047 encoding of a structured `from` is trusted,
 * not re-implemented here (research.md #4).
 */
describe('MailerService', () => {
  const originalEnv = { ...process.env };
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_FROM: 'noreply@vaultfolio.example.com',
    };
    delete process.env.SMTP_SENDER_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const request = { to: 'user@example.com', subject: 'Subject', html: '<p>Hi</p>', text: 'Hi' };

  it('uses a structured from with the sender name when SMTP_SENDER_NAME is set', async () => {
    process.env.SMTP_SENDER_NAME = 'Vaultfolio';

    await new MailerService().send(request);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Vaultfolio', address: 'noreply@vaultfolio.example.com' },
      }),
    );
  });

  it('falls back to the bare SMTP_FROM address when SMTP_SENDER_NAME is unset', async () => {
    await new MailerService().send(request);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'noreply@vaultfolio.example.com' }),
    );
  });

  it('still sends a structured from for a sender name containing a quote and a comma', async () => {
    process.env.SMTP_SENDER_NAME = 'Vault"folio, Inc.';

    await expect(new MailerService().send(request)).resolves.toBeUndefined();

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Vault"folio, Inc.', address: 'noreply@vaultfolio.example.com' },
      }),
    );
  });

  it('passes to/subject/html/text through unchanged', async () => {
    await new MailerService().send(request);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      }),
    );
  });

  it('logs and rethrows on send failure', async () => {
    const error = new Error('connection refused');
    sendMail.mockRejectedValue(error);

    await expect(new MailerService().send(request)).rejects.toThrow('connection refused');
  });
});
