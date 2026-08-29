/**
 * Password length policy (spec.md Assumptions): 8–200 characters, enforced at
 * creation/change time only — never re-validated on sign-in beyond hash
 * comparison (data-model.md's "Validation rules"). Framework-independent,
 * per Principle I.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

export type PasswordValidationResult =
  { valid: true } | { valid: false; reason: 'too_short' | 'too_long' };

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_LENGTH) {
    return { valid: false, reason: 'too_short' };
  }
  if (password.length > MAX_LENGTH) {
    return { valid: false, reason: 'too_long' };
  }
  return { valid: true };
}
