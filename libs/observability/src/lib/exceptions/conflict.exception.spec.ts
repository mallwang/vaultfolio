import { ConflictException } from './conflict.exception.js';

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
