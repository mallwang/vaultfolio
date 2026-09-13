import {
  AccessDeniedException,
  ConflictException,
  ExternalServiceException,
  RateLimitException,
  ResourceNotFoundException,
  ValidationException,
} from './business.exception.js';

describe('ValidationException', () => {
  it('has HTTP status 400 and passes error/message through unchanged', () => {
    const exception = new ValidationException({ error: 'invalid_password', message: 'Too short.' });

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({ error: 'invalid_password', message: 'Too short.' });
  });

  it('carries optional field-level details', () => {
    const exception = new ValidationException({
      error: 'validation_failed',
      message: 'Invalid input',
      details: [{ field: 'email', message: 'is required' }],
    });

    expect(exception.details).toEqual([{ field: 'email', message: 'is required' }]);
  });
});

describe('AccessDeniedException', () => {
  it('has HTTP status 403 and passes error/message through unchanged', () => {
    const exception = new AccessDeniedException({
      error: 'forbidden',
      message: 'You do not have access to this resource.',
    });

    expect(exception.getStatus()).toBe(403);
    expect(exception.getResponse()).toEqual({
      error: 'forbidden',
      message: 'You do not have access to this resource.',
    });
  });
});

describe('ResourceNotFoundException', () => {
  it('has HTTP status 404 and passes error/message through unchanged', () => {
    const exception = new ResourceNotFoundException({
      error: 'account_not_found',
      message: 'No such account.',
    });

    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toEqual({
      error: 'account_not_found',
      message: 'No such account.',
    });
  });
});

describe('ConflictException', () => {
  it('has HTTP status 409 and passes error/message through unchanged', () => {
    const exception = new ConflictException({
      error: 'account_exists',
      message: 'Already exists.',
    });

    expect(exception.getStatus()).toBe(409);
    expect(exception.getResponse()).toEqual({
      error: 'account_exists',
      message: 'Already exists.',
    });
  });
});

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
