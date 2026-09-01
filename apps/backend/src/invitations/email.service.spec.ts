import { renderNotification } from '@vaultfolio/notifications';
import { EmailService } from './email.service';

jest.mock('@vaultfolio/notifications', () => ({
  renderNotification: jest.fn(),
}));

describe('EmailService (invitations)', () => {
  const rendered = {
    type: 'invitation',
    language: 'en',
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

  it('renders with preferredLanguage: null (invitees have no account yet) and sends the result', async () => {
    await service.sendInvitation('invitee@example.com', 'tok123');

    expect(renderNotification).toHaveBeenCalledWith({
      type: 'invitation',
      preferredLanguage: null,
      viewModel: { acceptUrl: 'https://vaultfolio.example.com/invite/tok123' },
    });
    expect(mailerService.send).toHaveBeenCalledWith({ to: 'invitee@example.com', ...rendered });
  });

  it('rejects before rendering when APP_BASE_URL is missing/invalid', async () => {
    delete process.env.APP_BASE_URL;

    await expect(service.sendInvitation('invitee@example.com', 'tok123')).rejects.toThrow(
      /APP_BASE_URL/,
    );
    expect(renderNotification).not.toHaveBeenCalled();
  });
});
