import { computeLockout, LOCKOUT_THRESHOLD } from './lockout-policy.js';

describe('computeLockout', () => {
  it('does not lock below the threshold', () => {
    for (let attempts = 0; attempts < LOCKOUT_THRESHOLD; attempts++) {
      expect(computeLockout(attempts)).toEqual({ locked: false });
    }
  });

  it('locks with a 30s delay right at the threshold', () => {
    expect(computeLockout(LOCKOUT_THRESHOLD)).toEqual({ locked: true, delaySeconds: 30 });
  });

  it('escalates geometrically for each failure beyond the threshold', () => {
    expect(computeLockout(LOCKOUT_THRESHOLD + 1)).toEqual({ locked: true, delaySeconds: 60 });
    expect(computeLockout(LOCKOUT_THRESHOLD + 2)).toEqual({ locked: true, delaySeconds: 120 });
    expect(computeLockout(LOCKOUT_THRESHOLD + 3)).toEqual({ locked: true, delaySeconds: 240 });
  });

  it('caps the delay at 15 minutes', () => {
    expect(computeLockout(LOCKOUT_THRESHOLD + 10)).toEqual({ locked: true, delaySeconds: 900 });
    expect(computeLockout(LOCKOUT_THRESHOLD + 100)).toEqual({ locked: true, delaySeconds: 900 });
  });

  it('resets on success (0 failed attempts) regardless of prior state', () => {
    expect(computeLockout(0)).toEqual({ locked: false });
  });
});
