import { renderNotification } from '@vaultfolio/notifications';
import { EmailService } from './email.service';

jest.mock('@vaultfolio/notifications', () => ({
  renderNotification: jest.fn(),
}));

/**
 * Unit tests mocking `MailerService`/`renderNotification` — asserts the
 * adapter wiring (correct `type`/`preferredLanguage`/`viewModel` in,
 * rendered result forwarded to `MailerService.send`), not rendering itself
 * (covered by `libs/notifications/src/lib/notification-renderer.spec.ts`).
 */
describe('EmailService (profile)', () => {
  const rendered = {
    type: 'password-reset',
    language: 'de',
    subject: 'Subject',
    html: '<p>Body</p>',
    text: 'Body',
  };

  let mailerService: { send: jest.Mock };
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    (renderNotification as jest.Mock).mockReturnValue(rendered);
    mailerService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new EmailService(mailerService as never);
    process.env.APP_BASE_URL = 'https://vaultfolio.example.com';
  });

  it('sendPasswordReset renders with the user language and sends the rendered result', async () => {
    await service.sendPasswordReset({ email: 'user@example.com', emailLanguage: 'de' }, 'tok123');

    expect(renderNotification).toHaveBeenCalledWith({
      type: 'password-reset',
      preferredLanguage: 'de',
      viewModel: { resetUrl: 'https://vaultfolio.example.com/account/reset-password/tok123' },
    });
    expect(mailerService.send).toHaveBeenCalledWith({ to: 'user@example.com', ...rendered });
  });

  it('sendEmailChangeVerification renders with the user language and sends the rendered result', async () => {
    await service.sendEmailChangeVerification(
      { email: 'user@example.com', emailLanguage: null },
      'new@example.com',
      'tok456',
    );

    expect(renderNotification).toHaveBeenCalledWith({
      type: 'email-change-verification',
      preferredLanguage: null,
      viewModel: {
        newEmail: 'new@example.com',
        verifyUrl: 'https://vaultfolio.example.com/account/verify-email/tok456',
      },
    });
    expect(mailerService.send).toHaveBeenCalledWith({ to: 'user@example.com', ...rendered });
  });
});
