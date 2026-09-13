import { REQUEST_BODY_NEVER_LOGGED, sanitiseHeaders } from './sensitive-data-sanitiser.js';

describe('sanitiseHeaders', () => {
  it('redacts Authorization and Cookie', () => {
    const result = sanitiseHeaders({
      authorization: 'Bearer secret-token',
      Cookie: 'session=abc123',
      'x-correlation-id': 'abc',
    });

    expect(result['authorization']).toBe('[REDACTED]');
    expect(result['Cookie']).toBe('[REDACTED]');
    expect(result['x-correlation-id']).toBe('abc');
  });

  it('does not mutate the input object', () => {
    const input = { authorization: 'Bearer secret-token' };
    sanitiseHeaders(input);
    expect(input['authorization']).toBe('Bearer secret-token');
  });
});

describe('REQUEST_BODY_NEVER_LOGGED', () => {
  it('documents that request bodies are never logged', () => {
    expect(REQUEST_BODY_NEVER_LOGGED).toBe(true);
  });
});
