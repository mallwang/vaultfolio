/**
 * Account action token expiry/usability rules (008-profile-password-account,
 * data-model.md's "Entity: Account Action Token") — pure domain logic, no
 * clock/DB access (Principle I), sibling to
 * `libs/domain/invitations/src/lib/invitation-token.ts`'s pattern. The
 * caller (`AccountActionTokensRepository`/`ProfileService`) owns reading the
 * row and passing its status/expiry through.
 */

export type AccountActionTokenPurpose = 'EMAIL_CHANGE' | 'PASSWORD_RESET';
export type AccountActionTokenStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'SUPERSEDED';

const EMAIL_CHANGE_EXPIRY_HOURS_DEFAULT = 24;
const PASSWORD_RESET_EXPIRY_HOURS_DEFAULT = 1;

/** A token is usable only while `PENDING` and not yet past `expiresAt` (research.md #3). */
export function isTokenUsable(
  status: AccountActionTokenStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  return status === 'PENDING' && expiresAt.getTime() > now.getTime();
}

/**
 * Purpose-specific expiry window in hours (spec Assumptions, research.md #3):
 * 24h for `EMAIL_CHANGE`, 1h for `PASSWORD_RESET`. Overridable via
 * `EMAIL_CHANGE_EXPIRY_HOURS`/`PASSWORD_RESET_EXPIRY_HOURS` — reading env vars
 * here (rather than passing them in) mirrors 006's `expiryDays()`/007's
 * `expiryHours()` convention of keeping the env-var lookup next to the
 * default it backs.
 */
export function expiryWindowHours(purpose: AccountActionTokenPurpose): number {
  if (purpose === 'EMAIL_CHANGE') {
    const hours = Number(process.env.EMAIL_CHANGE_EXPIRY_HOURS);
    return Number.isFinite(hours) && hours > 0 ? hours : EMAIL_CHANGE_EXPIRY_HOURS_DEFAULT;
  }
  const hours = Number(process.env.PASSWORD_RESET_EXPIRY_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : PASSWORD_RESET_EXPIRY_HOURS_DEFAULT;
}
