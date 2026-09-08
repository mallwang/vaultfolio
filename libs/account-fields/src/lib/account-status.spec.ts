import { ACCOUNT_STATUSES, isAccountStatus } from './account-status.js';

describe('isAccountStatus', () => {
  it('returns true for every known status', () => {
    for (const status of ACCOUNT_STATUSES) {
      expect(isAccountStatus(status)).toBe(true);
    }
  });

  it('returns false for an unrecognized string', () => {
    expect(isAccountStatus('UNKNOWN')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isAccountStatus(undefined)).toBe(false);
    expect(isAccountStatus(null)).toBe(false);
    expect(isAccountStatus(42)).toBe(false);
  });
});
