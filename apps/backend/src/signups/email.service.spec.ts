import { renderNotification } from '@vaultfolio/notifications';
import { EmailService } from './email.service';

jest.mock('@vaultfolio/notifications', () => ({
  renderNotification: jest.fn(),
}));

/**
 * Unit tests mocking `MailerService`/`renderNotification` — asserts the
 * adapter wiring, including `sendAdminNotification`'s one render+send call
 * per admin using that admin's own resolved language (015 FR-011).
 */
describe('EmailService (signups)', () => {
  let mailerService: { send: jest.Mock };
  let service: EmailService;

  function renderedFor(language: string) {
    return { type: 'signup-admin-alert', language, subject: 'S', html: '<p>H</p>', text: 'T' };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mailerService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new EmailService(mailerService as never);
    process.env.APP_BASE_URL = 'https://vaultfolio.example.com';
  });

  it('sendVerification renders with preferredLanguage: null (no account yet)', async () => {
    (renderNotification as jest.Mock).mockReturnValue(renderedFor('en'));

    await service.sendVerification('user@example.com', 'tok123');

    expect(renderNotification).toHaveBeenCalledWith({
      type: 'signup-verification',
      preferredLanguage: null,
      viewModel: { verifyUrl: 'https://vaultfolio.example.com/signup/verify/tok123' },
    });
    expect(mailerService.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      ...renderedFor('en'),
    });
  });

  it("sendAdminNotification sends one render+send call per admin, each in that admin's own language", async () => {
    (renderNotification as jest.Mock).mockImplementation(({ preferredLanguage }) =>
      renderedFor(preferredLanguage === 'de' ? 'de' : 'en'),
    );

    await service.sendAdminNotification(
      [
        { email: 'admin-en@example.com', emailLanguage: 'en' },
        { email: 'admin-de@example.com', emailLanguage: 'de' },
      ],
      'newuser@example.com',
    );

    expect(renderNotification).toHaveBeenCalledTimes(2);
    expect(renderNotification).toHaveBeenCalledWith({
      type: 'signup-admin-alert',
      preferredLanguage: 'en',
      viewModel: {
        requestEmail: 'newuser@example.com',
        reviewUrl: 'https://vaultfolio.example.com/app/admin/signups',
      },
    });
    expect(renderNotification).toHaveBeenCalledWith({
      type: 'signup-admin-alert',
      preferredLanguage: 'de',
      viewModel: {
        requestEmail: 'newuser@example.com',
        reviewUrl: 'https://vaultfolio.example.com/app/admin/signups',
      },
    });
    expect(mailerService.send).toHaveBeenCalledWith({
      to: 'admin-en@example.com',
      ...renderedFor('en'),
    });
    expect(mailerService.send).toHaveBeenCalledWith({
      to: 'admin-de@example.com',
      ...renderedFor('de'),
    });
  });

  it('sendAdminNotification is a no-op for an empty admin list', async () => {
    await service.sendAdminNotification([], 'newuser@example.com');
    expect(renderNotification).not.toHaveBeenCalled();
    expect(mailerService.send).not.toHaveBeenCalled();
  });

  it('sendWelcome and sendRejection render with preferredLanguage: null', async () => {
    (renderNotification as jest.Mock).mockReturnValue(renderedFor('en'));

    await service.sendWelcome('user@example.com');
    expect(renderNotification).toHaveBeenCalledWith({
      type: 'signup-welcome',
      preferredLanguage: null,
      viewModel: { appUrl: 'https://vaultfolio.example.com' },
    });

    await service.sendRejection('user@example.com');
    expect(renderNotification).toHaveBeenCalledWith({
      type: 'signup-rejection',
      preferredLanguage: null,
      viewModel: {},
    });
  });
});
