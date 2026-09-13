import { ValidationException } from './validation.exception.js';

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
