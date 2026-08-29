/**
 * Escalating account-lockout delay (FR-007, research.md #3): once
 * `failedAttempts` crosses `LOCKOUT_THRESHOLD`, the caller must wait
 * `delaySeconds` before the next attempt is allowed. The delay escalates
 * geometrically for each additional failure beyond the threshold (30s, 60s,
 * 120s, ...), capped at 15 minutes, so repeated failures don't settle into a
 * flat, brute-forceable wait. A successful sign-in resets `failedAttempts`
 * to 0, which this function reports as unlocked. Pure domain logic, no
 * clock/DB access (Principle I) — the caller (`AuthService`) is responsible
 * for turning `delaySeconds` into an absolute `locked_until` timestamp.
 */

export const LOCKOUT_THRESHOLD = 5;

const BASE_DELAY_SECONDS = 30;
const MAX_DELAY_SECONDS = 15 * 60;

export type LockoutResult = { locked: false } | { locked: true; delaySeconds: number };

export function computeLockout(failedAttempts: number): LockoutResult {
  if (failedAttempts < LOCKOUT_THRESHOLD) {
    return { locked: false };
  }

  const escalations = failedAttempts - LOCKOUT_THRESHOLD;
  const delaySeconds = Math.min(BASE_DELAY_SECONDS * 2 ** escalations, MAX_DELAY_SECONDS);
  return { locked: true, delaySeconds };
}
