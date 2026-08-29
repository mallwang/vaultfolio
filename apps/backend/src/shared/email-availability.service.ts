import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../auth/users.repository';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { SignupsRepository } from '../signups/signups.repository';

export type CheckEmailAvailableResult =
  | { kind: 'available' }
  | { kind: 'has_account' }
  | { kind: 'has_pending_invitation' }
  | { kind: 'has_pending_signup' }
  | { kind: 'blacklisted' };

/**
 * Single source of truth for "can this email be used to create a new
 * account/invitation/sign-up right now" (research.md #1, data-model.md's
 * "Combined availability lookup"). Extracted from
 * `InvitationsService.checkEmailAvailable()` and extended with the
 * `signup_requests`/`email_blacklist` checks 007 adds. Queries, in order,
 * and returns the first match:
 * `users` -> pending `invitations` -> active `signup_requests` ->
 * `email_blacklist` -> `available`.
 */
@Injectable()
export class EmailAvailabilityService {
  constructor(
    private readonly users: UsersRepository,
    private readonly invitations: InvitationsRepository,
    private readonly signups: SignupsRepository,
  ) {}

  async check(email: string): Promise<CheckEmailAvailableResult> {
    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      return { kind: 'has_account' };
    }
    const pendingInvitation = await this.invitations.findPendingByEmail(email);
    if (pendingInvitation) {
      return { kind: 'has_pending_invitation' };
    }
    const activeSignup = await this.signups.findActiveByEmail(email);
    if (activeSignup) {
      return { kind: 'has_pending_signup' };
    }
    const blacklisted = await this.signups.findBlacklistEntry(email);
    if (blacklisted) {
      return { kind: 'blacklisted' };
    }
    return { kind: 'available' };
  }
}
