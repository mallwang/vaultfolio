/**
 * Shared contract for the Auth API — see
 * specs/005-auth-sessions-isolation/contracts/auth-api.md. Plain TypeScript
 * interfaces, no runtime dependency, imported by both `apps/backend` and
 * `apps/frontend` so the two tiers can never silently drift on shape
 * (Principle II).
 */

export interface SignInRequest {
  email: string;
  password: string;
}

export type UserRole = 'ADMIN' | 'MEMBER';

/**
 * Also the shape returned by GET /api/auth/session. Never includes
 * `password_hash`, `failed_attempts`, `locked_until`, or any other user's
 * data — and no response anywhere in this API (or any other API in the app)
 * includes a record's `owner_id` (FR-010).
 */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** Domain ids this user is entitled to, independent of `role` (020, FR-004/FR-007). */
  domainScopes: string[];
}

export interface AuthErrorResponse {
  error: 'invalid_credentials' | 'account_locked' | 'unauthenticated' | 'forbidden';
  message: string;
}
