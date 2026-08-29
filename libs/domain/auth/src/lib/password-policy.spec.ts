import { validatePassword } from './password-policy.js';

describe('validatePassword', () => {
  it('rejects an empty password', () => {
    expect(validatePassword('')).toEqual({ valid: false, reason: 'too_short' });
  });

  it('rejects a password below the 8-character minimum', () => {
    expect(validatePassword('a'.repeat(7))).toEqual({ valid: false, reason: 'too_short' });
  });

  it('accepts a password at the 8-character boundary', () => {
    expect(validatePassword('a'.repeat(8))).toEqual({ valid: true });
  });

  it('accepts a password at the 200-character boundary', () => {
    expect(validatePassword('a'.repeat(200))).toEqual({ valid: true });
  });

  it('rejects a password above the 200-character maximum', () => {
    expect(validatePassword('a'.repeat(201))).toEqual({ valid: false, reason: 'too_long' });
  });

  it('accepts a valid password within the range', () => {
    expect(validatePassword('a-valid-password')).toEqual({ valid: true });
  });
});
