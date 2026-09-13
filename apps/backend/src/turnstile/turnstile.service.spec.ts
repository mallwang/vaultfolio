import { HttpException, Logger } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';
import { ExternalServiceException, ValidationException } from '@vaultfolio/observability';

const VALID_RESPONSE = {
  success: true,
  action: 'signup',
  hostname: 'example.com',
  'error-codes': [],
};

const BOT_PROTECTION_FAILED_BODY = {
  error: 'bot_protection_failed',
  message: 'Bot protection check failed.',
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
    // jest.setup.ts silences Logger globally, but only once in a top-level
    // beforeAll — this file's own afterEach below (jest.restoreAllMocks())
    // undoes that spy too, so from the second test onward the deliberate
    // failure-path tests would log for real. Re-apply per test.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves on valid token (happy path)', async () => {
    mockFetch(VALID_RESPONSE);
    await expect(makeService().verify('valid-token', 'signup', '1.2.3.4')).resolves.toBeUndefined();
  });

  // Migrated to categorized BusinessException subclasses
  // (specs/030-observability-logging-error-handling, US4/T040) — the existing `error`/`message`
  // body values (relied on by existing callers, FR-008) are unchanged; only the HTTP status and
  // exception class are now consistent with the rest of the app's categorized failures.

  it('throws a ValidationException (unchanged body) when success is false', async () => {
    mockFetch({ ...VALID_RESPONSE, success: false, 'error-codes': ['invalid-input-response'] });
    const promise = makeService().verify('bad-token', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ValidationException);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws a ValidationException when action does not match', async () => {
    mockFetch({ ...VALID_RESPONSE, action: 'other-action' });
    const promise = makeService().verify('tok', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ValidationException);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws a ValidationException when hostname not in allow-list', async () => {
    mockFetch({ ...VALID_RESPONSE, hostname: 'attacker.com' });
    const promise = makeService().verify('tok', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ValidationException);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws an ExternalServiceException (unchanged body) on network error', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network failure'));
    const promise = makeService().verify('tok', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ExternalServiceException);
    await expect(promise).rejects.toMatchObject({
      status: 502,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws an ExternalServiceException on timeout (AbortError)', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(err);
    const promise = makeService().verify('tok', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ExternalServiceException);
    await expect(promise).rejects.toMatchObject({
      status: 502,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws a ValidationException pre-flight: empty token', async () => {
    const promise = makeService().verify('', 'signup');
    await expect(promise).rejects.toBeInstanceOf(ValidationException);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      response: BOT_PROTECTION_FAILED_BODY,
    });
  });

  it('throws a ValidationException pre-flight: token > 2048 chars', async () => {
    const promise = makeService().verify('x'.repeat(2049), 'signup');
    await expect(promise).rejects.toBeInstanceOf(ValidationException);
    await expect(promise).rejects.toBeInstanceOf(HttpException);
  });

  it('allows any hostname when TURNSTILE_HOSTNAMES is unset', async () => {
    delete process.env['TURNSTILE_HOSTNAMES'];
    mockFetch({ ...VALID_RESPONSE, hostname: 'anything.com' });
    await expect(makeService().verify('tok', 'signup')).resolves.toBeUndefined();
  });
});
