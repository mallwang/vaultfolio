# domain-auth

Framework-independent auth domain logic — no NestJS/database dependency (Principle I). All
functions are pure predicates or calculators; the caller (`AuthService`, `AccountsService`,
`AccountActionTokensRepository`) owns I/O and clock access.

## Exports

- **`validatePassword(password)`** — checks 8–200 char length policy. Returns
  `{ valid: true }` or `{ valid: false, reason: 'too_short' | 'too_long' }`.
- **`computeLockout(failedAttempts)`** — escalating lockout delay (threshold: 5 failures,
  starting at 30 s, doubling per additional failure, capped at 15 min). Returns
  `{ locked: false }` or `{ locked: true, delaySeconds }`.
  `LOCKOUT_THRESHOLD` (= 5) is exported for callers that need the raw value.
- **`canRemoveLastAdmin(activeAdminCount, isTargetActiveAdmin)`** — last-admin invariant
  shared by all three enforcement points (role change, archive, self-delete). Returns `false`
  only when the target is the sole remaining active admin.
- **`isTokenUsable(status, expiresAt, now)`** — a token is usable only when `PENDING` and not
  past `expiresAt`.
- **`expiryWindowHours(purpose)`** — purpose-specific token expiry: 24 h for `EMAIL_CHANGE`,
  1 h for `PASSWORD_RESET`. Overridable via `EMAIL_CHANGE_EXPIRY_HOURS` /
  `PASSWORD_RESET_EXPIRY_HOURS` env vars.
- **`AccountActionTokenPurpose`** / **`AccountActionTokenStatus`** — discriminated union types
  for token purpose and lifecycle state.

## Running unit tests

Run `npm exec nx test domain-auth` to execute the unit tests via Jest.
