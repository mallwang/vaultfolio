import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { computeLockout } from '@vaultfolio/domain-auth';
import type { SessionUser } from '@vaultfolio/api-contract';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';
import type { User } from './users.repository';
import type { Session } from './sessions.repository';

const DEFAULT_ABSOLUTE_LIFETIME_HOURS = 12;

function absoluteLifetimeMs(): number {
  const hours = Number(process.env.SESSION_ABSOLUTE_LIFETIME_HOURS);
  return (
    (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ABSOLUTE_LIFETIME_HOURS) * 3_600_000
  );
}

export type SignInResult =
  | { kind: 'success'; user: SessionUser; session: Session }
  | { kind: 'invalid_credentials' }
  | { kind: 'account_locked' };

/** Maps a persisted `User` row to the `SessionUser` DTO (FR-010: never leaks password_hash/counters). */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    domainScopes: user.domainScopes,
  };
}

/**
 * Sign-in/sign-out orchestration (FR-006/FR-007/FR-008): lockout check →
 * argon2 verify → on success reset failed_attempts + create session; on
 * failure increment failed_attempts + maybe set locked_until, per
 * research.md #3. Lockout is checked and enforced before the password
 * comparison runs (research.md #3), and never distinguishes a nonexistent
 * email from a wrong password in its result (FR-008/SC-005) — both come back
 * as `invalid_credentials`.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
  ) {}

  async signIn(email: string, password: string): Promise<SignInResult> {
    const user = await this.users.findByEmail(email);

    if (!user || user.status !== 'ACTIVE') {
      // Deliberately identical to a wrong-password failure below — no
      // account-existence signal (FR-008/SC-005). Nothing to lock/increment
      // for a nonexistent account.
      if (user) {
        this.logger.log({ userId: user.id, event: 'sign_in', outcome: 'invalid_credentials' });
      } else {
        this.logger.log({ email, event: 'sign_in', outcome: 'invalid_credentials' });
      }
      return { kind: 'invalid_credentials' };
    }

    const lockout = computeLockout(user.failedAttempts);
    if (lockout.locked && user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      this.logger.log({ userId: user.id, event: 'sign_in', outcome: 'account_locked' });
      return { kind: 'account_locked' };
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      const failedAttempts = user.failedAttempts + 1;
      await this.users.incrementFailedAttempts(user.id);
      const newLockout = computeLockout(failedAttempts);
      if (newLockout.locked) {
        const lockedUntil = new Date(Date.now() + newLockout.delaySeconds * 1000).toISOString();
        await this.users.setLockedUntil(user.id, lockedUntil);
        this.logger.log({ userId: user.id, event: 'sign_in', outcome: 'locked_out' });
        return { kind: 'account_locked' };
      }
      this.logger.log({ userId: user.id, event: 'sign_in', outcome: 'invalid_credentials' });
      return { kind: 'invalid_credentials' };
    }

    await this.users.resetFailedAttempts(user.id);
    const expiresAt = new Date(Date.now() + absoluteLifetimeMs()).toISOString();
    const session = await this.sessions.create(user.id, expiresAt);
    this.logger.log({ userId: user.id, event: 'sign_in', outcome: 'success' });
    return { kind: 'success', user: toSessionUser(user), session };
  }

  async signOut(sessionId: string): Promise<void> {
    await this.sessions.deleteById(sessionId);
  }
}
