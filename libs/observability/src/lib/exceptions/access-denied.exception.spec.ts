import { AccessDeniedException } from './access-denied.exception.js';

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
