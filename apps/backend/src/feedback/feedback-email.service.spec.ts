import { Logger } from '@nestjs/common';
import type { User } from '../auth/users.repository';
import { FeedbackEmailService } from './feedback-email.service';
import { FeedbackDeliveryFailedException } from './feedback.exceptions';

const user = (email: string, emailLanguage: string | null): User =>
  ({ id: email, email, emailLanguage }) as User;
const mail = {
  id: 'f-1',
  category: 'problem' as const,
  subject: 'Subj <b>',
  message: 'Body text',
  senderName: 'Eve',
  senderEmail: 'eve@example.com',
  senderLanguage: 'en' as const,
};

describe('FeedbackEmailService', () => {
  const send = jest.fn();
  const findAllByRole = jest.fn();
  let errors: jest.SpyInstance;
  let service: FeedbackEmailService;

  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined);
    findAllByRole.mockReset();
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new FeedbackEmailService({ findAllByRole } as never, { send } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends one mail per admin in the admin language', async () => {
    findAllByRole.mockResolvedValue([user('a@example.com', 'de'), user('b@example.com', null)]);
    await service.deliver(mail);
    const [first, second] = send.mock.calls.map(([m]) => m);
    expect(first.to).toBe('a@example.com');
    expect(first.subject).toBe('[Feedback: Problem] Subj <b>');
    expect(second.subject).toBe('[Feedback: Problem] Subj <b>');
    expect(first.text).toContain('Body text');
    expect(first.html).not.toContain('<b>');
  });

  it('throws and logs ids only when no admin exists', async () => {
    findAllByRole.mockResolvedValue([]);
    await expect(service.deliver(mail)).rejects.toBeInstanceOf(FeedbackDeliveryFailedException);
    expect(JSON.stringify(errors.mock.calls)).not.toContain('Body text');
  });

  it('throws when any send fails and logs counts without content or addresses', async () => {
    findAllByRole.mockResolvedValue([user('a@example.com', 'en'), user('b@example.com', 'en')]);
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('smtp'));
    await expect(service.deliver(mail)).rejects.toBeInstanceOf(FeedbackDeliveryFailedException);
    expect(errors).toHaveBeenCalledWith({
      event: 'FeedbackMailFailed',
      feedbackId: 'f-1',
      category: 'problem',
      failed: 1,
      total: 2,
    });
  });
});
