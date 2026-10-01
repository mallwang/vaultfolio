import { Logger } from '@nestjs/common';
import type { User } from '../auth/users.repository';
import { RequestsEmailService } from './requests-email.service';

const user = (email: string, emailLanguage: string | null): User =>
  ({ id: `id-${email}`, email, emailLanguage }) as User;

describe('RequestsEmailService', () => {
  const send = jest.fn();
  const findAllByRole = jest.fn();
  const findById = jest.fn();
  let service: RequestsEmailService;
  let errors: jest.SpyInstance;
  let warnings: jest.SpyInstance;
  const request = { id: 'req-1', feature: 'earnings', type: 'new-parser' };

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://vaultfolio.example.com';
    send.mockReset().mockResolvedValue(undefined);
    findAllByRole.mockReset();
    findById.mockReset();
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    service = new RequestsEmailService({ findAllByRole, findById } as never, { send } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends one link-only mail per admin in the admin language, without attachments', async () => {
    findAllByRole.mockResolvedValue([user('a@example.com', 'de'), user('b@example.com', null)]);
    await service.notifyAdmins(request);

    expect(send).toHaveBeenCalledTimes(2);
    const [first, second] = send.mock.calls.map(([mail]) => mail);
    expect(first.to).toBe('a@example.com');
    expect(first.subject).toBe('Neue Anfrage (Einkommen): Neuer Parser');
    expect(second.subject).toBe('New Earnings request: New parser');
    for (const mail of [first, second]) {
      expect(mail.text).toContain('https://vaultfolio.example.com/app/admin/requests?id=req-1');
      expect(Object.keys(mail).sort()).toEqual([
        'html',
        'language',
        'subject',
        'text',
        'to',
        'type',
      ]);
    }
  });

  it('keeps going when one recipient fails and logs metadata only', async () => {
    findAllByRole.mockResolvedValue([user('a@example.com', 'en'), user('b@example.com', 'en')]);
    send.mockRejectedValueOnce(new Error('smtp down a@example.com'));
    await expect(service.notifyAdmins(request)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errors.mock.calls)).not.toContain('example.com');
    expect(errors.mock.calls[0][0]).toMatchObject({
      event: 'RequestMailFailed',
      requestId: 'req-1',
    });
  });

  it('rejects a relative APP_BASE_URL without throwing and sends nothing', async () => {
    process.env.APP_BASE_URL = '/relative';
    findAllByRole.mockResolvedValue([user('a@example.com', 'en')]);
    await expect(service.notifyAdmins(request)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('logs and does not throw when no administrator is reachable', async () => {
    findAllByRole.mockResolvedValue([]);
    await expect(service.notifyAdmins(request)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(warnings).toHaveBeenCalledTimes(1);
  });

  it('sends the done mail to the requester with the import link', async () => {
    findById.mockResolvedValue(user('member@example.com', 'de'));
    await service.notifyDone('u1', request);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('member@example.com');
    expect(mail.text).toContain('https://vaultfolio.example.com/app/earnings/import');
    expect(mail.subject).toContain('erledigt');
  });

  it('swallows a failing done mail and skips an unknown requester', async () => {
    findById.mockResolvedValueOnce(null);
    await service.notifyDone('gone', request);
    expect(send).not.toHaveBeenCalled();

    findById.mockResolvedValue(user('member@example.com', 'en'));
    send.mockRejectedValue(new Error('boom'));
    await expect(service.notifyDone('u1', request)).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(1);
  });
});
