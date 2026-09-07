import { HttpException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

const VALID_RESPONSE = {
  success: true,
  action: 'signup',
  hostname: 'example.com',
  'error-codes': [],
};

function makeService(): TurnstileService {
  return new TurnstileService();
}

function mockFetch(body: object, ok = true): void {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    json: async () => body,
  } as Response);
}

describe('TurnstileService', () => {
  beforeEach(() => {
    process.env['TURNSTILE_SECRET_KEY'] = 'test-secret';
    process.env['TURNSTILE_HOSTNAMES'] = 'example.com';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves on valid token (happy path)', async () => {
    mockFetch(VALID_RESPONSE);
    await expect(makeService().verify('valid-token', 'signup', '1.2.3.4')).resolves.toBeUndefined();
  });

  it('throws 422 when success is false', async () => {
    mockFetch({ ...VALID_RESPONSE, success: false, 'error-codes': ['invalid-input-response'] });
    await expect(makeService().verify('bad-token', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 when action does not match', async () => {
    mockFetch({ ...VALID_RESPONSE, action: 'other-action' });
    await expect(makeService().verify('tok', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 when hostname not in allow-list', async () => {
    mockFetch({ ...VALID_RESPONSE, hostname: 'attacker.com' });
    await expect(makeService().verify('tok', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 on network error', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network failure'));
    await expect(makeService().verify('tok', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 on timeout (AbortError)', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(err);
    await expect(makeService().verify('tok', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 pre-flight: empty token', async () => {
    await expect(makeService().verify('', 'signup')).rejects.toThrow(HttpException);
  });

  it('throws 422 pre-flight: token > 2048 chars', async () => {
    await expect(makeService().verify('x'.repeat(2049), 'signup')).rejects.toThrow(HttpException);
  });

  it('allows any hostname when TURNSTILE_HOSTNAMES is unset', async () => {
    delete process.env['TURNSTILE_HOSTNAMES'];
    mockFetch({ ...VALID_RESPONSE, hostname: 'anything.com' });
    await expect(makeService().verify('tok', 'signup')).resolves.toBeUndefined();
  });
});
