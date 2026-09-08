import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { TurnstileGuard } from './turnstile.guard';
import type { TurnstileService } from './turnstile.service';

function buildContext(req: {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  ip?: string;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ body: req.body, headers: req.headers ?? {}, ip: req.ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('TurnstileGuard', () => {
  let reflector: { get: jest.Mock };
  let turnstileService: { verify: jest.Mock };
  let guard: TurnstileGuard;

  beforeEach(() => {
    reflector = { get: jest.fn().mockReturnValue('signup') };
    turnstileService = { verify: jest.fn().mockResolvedValue(undefined) };
    guard = new TurnstileGuard(
      reflector as unknown as Reflector,
      turnstileService as unknown as TurnstileService,
    );
  });

  it('verifies the token from the request body against the decorated action and allows activation', async () => {
    const context = buildContext({ body: { turnstileToken: 'tok123' }, ip: '203.0.113.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(turnstileService.verify).toHaveBeenCalledWith('tok123', 'signup', '203.0.113.1');
  });

  it('defaults to an empty token when the body has none or it is not a string', async () => {
    const context = buildContext({ body: { turnstileToken: 42 }, ip: '203.0.113.1' });

    await guard.canActivate(context);

    expect(turnstileService.verify).toHaveBeenCalledWith('', 'signup', '203.0.113.1');
  });

  it('defaults to an empty token when the body is undefined', async () => {
    const context = buildContext({ ip: '203.0.113.1' });

    await guard.canActivate(context);

    expect(turnstileService.verify).toHaveBeenCalledWith('', 'signup', '203.0.113.1');
  });

  it('prefers the first x-forwarded-for entry over req.ip', async () => {
    const context = buildContext({
      body: { turnstileToken: 'tok123' },
      headers: { 'x-forwarded-for': '198.51.100.5, 10.0.0.1' },
      ip: '203.0.113.1',
    });

    await guard.canActivate(context);

    expect(turnstileService.verify).toHaveBeenCalledWith('tok123', 'signup', '198.51.100.5');
  });

  it('falls back to req.ip when x-forwarded-for is absent', async () => {
    const context = buildContext({ body: { turnstileToken: 'tok123' }, ip: '203.0.113.1' });

    await guard.canActivate(context);

    expect(turnstileService.verify).toHaveBeenCalledWith('tok123', 'signup', '203.0.113.1');
  });

  it('propagates a rejection from the underlying verify call', async () => {
    turnstileService.verify.mockRejectedValue(new Error('bot_protection_failed'));
    const context = buildContext({ body: { turnstileToken: 'tok123' }, ip: '203.0.113.1' });

    await expect(guard.canActivate(context)).rejects.toThrow('bot_protection_failed');
  });
});
