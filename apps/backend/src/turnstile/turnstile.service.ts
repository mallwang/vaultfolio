import { HttpException, Injectable, Logger } from '@nestjs/common';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function allowedHostnames(): Set<string> {
  const raw = process.env['TURNSTILE_HOSTNAMES'] ?? '';
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  );
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  async verify(token: string, action: string, clientIp?: string): Promise<void> {
    if (!token || token.length > 2048) {
      throw new HttpException(
        { error: 'bot_protection_failed', message: 'Bot protection check failed.' },
        422,
      );
    }

    const secret = process.env['TURNSTILE_SECRET_KEY'] ?? '';
    const params = new URLSearchParams({ secret, response: token });
    if (clientIp) {
      params.set('remoteip', clientIp);
    }

    let result: { success: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
    try {
      const res = await globalThis.fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: AbortSignal.timeout(10_000),
      });
      result = (await res.json()) as typeof result;
    } catch (err) {
      this.logger.error('Turnstile siteverify network/timeout error', err);
      throw new HttpException(
        { error: 'bot_protection_failed', message: 'Bot protection check failed.' },
        422,
      );
    }

    const hostnames = allowedHostnames();
    if (
      !result.success ||
      result.action !== action ||
      (hostnames.size > 0 && !hostnames.has(result.hostname ?? ''))
    ) {
      this.logger.warn('Turnstile verification failed', {
        success: result.success,
        action: result.action,
        hostname: result.hostname,
        errorCodes: result['error-codes'],
      });
      throw new HttpException(
        { error: 'bot_protection_failed', message: 'Bot protection check failed.' },
        422,
      );
    }
  }
}
