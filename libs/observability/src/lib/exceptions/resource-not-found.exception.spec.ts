import { ResourceNotFoundException } from './resource-not-found.exception.js';

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
