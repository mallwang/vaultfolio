import { RateLimitException } from './rate-limit.exception.js';

describe('RateLimitException', () => {
  it('has HTTP status 429 and passes error/message through unchanged', () => {
    const exception = new RateLimitException({
      error: 'rate_limited',
      message: 'Too many requests.',
    });

    expect(exception.getStatus()).toBe(429);
    expect(exception.getResponse()).toEqual({
      error: 'rate_limited',
      message: 'Too many requests.',
    });
  });
});
