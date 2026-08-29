import { expiryWindowHours, isTokenUsable } from './account-action-token.js';

describe('isTokenUsable', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const future = new Date('2026-01-02T00:00:00.000Z');
  const past = new Date('2025-12-31T00:00:00.000Z');

  it('is usable when PENDING and unexpired', () => {
    expect(isTokenUsable('PENDING', future, now)).toBe(true);
  });

  it('is not usable when PENDING but expired', () => {
    expect(isTokenUsable('PENDING', past, now)).toBe(false);
  });

  it('is not usable when PENDING and expiring exactly now', () => {
    expect(isTokenUsable('PENDING', now, now)).toBe(false);
  });

  it.each(['USED', 'EXPIRED', 'SUPERSEDED'] as const)(
    'is not usable when status is %s, regardless of expiry',
    (status) => {
      expect(isTokenUsable(status, future, now)).toBe(false);
    },
  );
});

describe('expiryWindowHours', () => {
  const originalEmailChange = process.env.EMAIL_CHANGE_EXPIRY_HOURS;
  const originalPasswordReset = process.env.PASSWORD_RESET_EXPIRY_HOURS;

  afterEach(() => {
    if (originalEmailChange === undefined) {
      delete process.env.EMAIL_CHANGE_EXPIRY_HOURS;
    } else {
      process.env.EMAIL_CHANGE_EXPIRY_HOURS = originalEmailChange;
    }
    if (originalPasswordReset === undefined) {
      delete process.env.PASSWORD_RESET_EXPIRY_HOURS;
    } else {
      process.env.PASSWORD_RESET_EXPIRY_HOURS = originalPasswordReset;
    }
  });

  it('defaults EMAIL_CHANGE to 24 hours when unset', () => {
    delete process.env.EMAIL_CHANGE_EXPIRY_HOURS;
    expect(expiryWindowHours('EMAIL_CHANGE')).toBe(24);
  });

  it('defaults PASSWORD_RESET to 1 hour when unset', () => {
    delete process.env.PASSWORD_RESET_EXPIRY_HOURS;
    expect(expiryWindowHours('PASSWORD_RESET')).toBe(1);
  });

  it('reads EMAIL_CHANGE_EXPIRY_HOURS when set to a valid positive number', () => {
    process.env.EMAIL_CHANGE_EXPIRY_HOURS = '48';
    expect(expiryWindowHours('EMAIL_CHANGE')).toBe(48);
  });

  it('reads PASSWORD_RESET_EXPIRY_HOURS when set to a valid positive number', () => {
    process.env.PASSWORD_RESET_EXPIRY_HOURS = '2';
    expect(expiryWindowHours('PASSWORD_RESET')).toBe(2);
  });

  it.each(['0', '-1', 'not-a-number', ''])(
    'falls back to the default for an invalid value (%s)',
    (value) => {
      process.env.EMAIL_CHANGE_EXPIRY_HOURS = value;
      expect(expiryWindowHours('EMAIL_CHANGE')).toBe(24);
    },
  );
});
