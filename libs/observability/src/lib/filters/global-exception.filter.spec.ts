import { HttpException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import { RequestContextService } from '../context/request-context.service.js';
import {
  AccessDeniedException,
  ExternalServiceException,
  ValidationException,
} from '../exceptions/business.exception.js';

function buildHost(request: { method: string; url: string }) {
  const response = {
    headers: {} as Record<string, string>,
    statusCode: 0,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    body: undefined as unknown,
  };

  return {
    response,
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as import('@nestjs/common').ArgumentsHost,
  };
}

describe('GlobalExceptionFilter', () => {
  const requestContext = new RequestContextService();
  const filter = new GlobalExceptionFilter(requestContext);
  const request = { method: 'GET', url: '/accounts' };

  it('includes the correlation ID from the request context on every error response', () => {
    const { host, response } = buildHost(request);

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(new HttpException({ error: 'forbidden', message: 'nope' }, 403), host);
    });

    expect((response.body as { correlationId: string }).correlationId).toBe('req-corr-id');
    expect(response.headers['X-Correlation-Id']).toBe('req-corr-id');
  });

  it('falls back to a placeholder correlationId when the context was never populated', () => {
    const { host, response } = buildHost(request);

    // No run() wrapper — simulates context not yet populated; filter falls back safely.
    filter.catch(new HttpException({ error: 'forbidden', message: 'nope' }, 403), host);

    expect((response.body as { correlationId: string }).correlationId).toBe('unknown');
  });

  it('still yields a valid generic ErrorResponse when its own body-building logic throws', () => {
    const { response } = buildHost(request);
    const throwingHost = {
      switchToHttp: () => ({
        getRequest: () => {
          throw new Error('boom');
        },
        getResponse: () => response,
      }),
    } as unknown as import('@nestjs/common').ArgumentsHost;

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(new HttpException('irrelevant', 500), throwingHost);
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toMatchObject({
      error: 'internal_server_error',
    });
  });

  it('passes through details from a BusinessException unchanged', () => {
    const { host, response } = buildHost(request);
    const exception = new ValidationException({
      error: 'validation_failed',
      message: 'Invalid input',
      details: [{ field: 'email', message: 'is required' }],
    });

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(exception, host);
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error: 'validation_failed',
      message: 'Invalid input',
      correlationId: 'req-corr-id',
      details: [{ field: 'email', message: 'is required' }],
    });
  });

  it('classifies a < 500 BusinessException (e.g. AccessDeniedException) at WARN', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { host } = buildHost(request);

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(new AccessDeniedException({ error: 'forbidden', message: 'nope' }), host);
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('classifies a >= 500 BusinessException (ExternalServiceException) at ERROR', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host } = buildHost(request);

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(
        new ExternalServiceException({ error: 'bot_protection_failed', message: 'failed' }),
        host,
      );
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('classifies a truly unhandled (non-HttpException) error at ERROR', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host } = buildHost(request);

    requestContext.run({ correlationId: 'req-corr-id' }, () => {
      filter.catch(new Error('unexpected'), host);
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
