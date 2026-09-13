import { ExternalServiceException } from './external-service.exception.js';

describe('ExternalServiceException', () => {
  it('has HTTP status 502 and passes error/message through unchanged', () => {
    const exception = new ExternalServiceException({
      error: 'bot_protection_failed',
      message: 'Bot protection check failed.',
    });

    expect(exception.getStatus()).toBe(502);
    expect(exception.getResponse()).toEqual({
      error: 'bot_protection_failed',
      message: 'Bot protection check failed.',
    });
  });
});
