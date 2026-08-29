import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { expiryWindowHours, isTokenUsable, validatePassword } from '@vaultfolio/domain-auth';
import type { ProfileSummary, SessionUser } from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import { SessionsRepository } from '../auth/sessions.repository';
import type { Session } from '../auth/sessions.repository';
import { toSessionUser } from '../auth/auth.service';
import { EmailAvailabilityService } from '../shared/email-availability.service';
import { AccountsService } from '../accounts/accounts.service';
import { AccountActionTokensRepository } from './account-action-tokens.repository';
import { EmailService } from './email.service';

const DEFAULT_ABSOLUTE_LIFETIME_HOURS = 12;

function absoluteLifetimeMs(): number {
  const hours = Number(process.env.SESSION_ABSOLUTE_LIFETIME_HOURS);
  return (
    (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ABSOLUTE_LIFETIME_HOURS) * 3_600_000
  );
}

function generateActionToken(): string {
  return randomBytes(32).toString('base64url');
}

export type UpdateDisplayNameResult =
  { kind: 'success'; profile: ProfileSummary } | { kind: 'invalid_display_name' };

export type RequestEmailChangeResult =
  | { kind: 'success'; pendingEmail: string }
  | { kind: 'email_unavailable' }
  | { kind: 'email_delivery_failed' };

export type LookupEmailChangeTokenResult =
  { kind: 'success'; newEmail: string } | { kind: 'invalid_token' };

export type ConfirmEmailChangeResult =
  { kind: 'success'; email: string } | { kind: 'invalid_token' };

export type ChangePasswordResult =
  { kind: 'success' } | { kind: 'invalid_current_password' } | { kind: 'invalid_password' };

export type LookupPasswordResetTokenResult = { kind: 'success' } | { kind: 'invalid_token' };

export type ConfirmPasswordResetResult =
  | { kind: 'success'; user: SessionUser; session: Session }
  | { kind: 'invalid_password' }
  | { kind: 'invalid_token' };

export type DeleteAccountResult =
  { kind: 'success' } | { kind: 'last_admin' } | { kind: 'deletion_failed' };

/**
 * Orchestrates every self-service profile action (008 — User Stories 1–3):
 * display-name update, email-change request/cancel/verify, password
 * change/forgot/reset, and self-delete (delegated to
 * `AccountsService.deleteSelf`, research.md #1 — no duplicated last-admin
 * logic). No `@Roles()` gate applies to any of this — every signed-in user
 * may act on their own account (contracts/profile-api.md).
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly tokens: AccountActionTokensRepository,
    private readonly emailService: EmailService,
    private readonly emailAvailability: EmailAvailabilityService,
    private readonly accounts: AccountsService,
  ) {}

  async getProfile(userId: string): Promise<ProfileSummary | null> {
    const user = await this.users.findById(userId);
    if (!user) {
      return null;
    }
    const pendingEmail = await this.currentPendingEmail(userId);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      pendingEmail,
    };
  }

  /** `NULL` if there's no outstanding request, or the one that exists has since expired (lazy). */
  private async currentPendingEmail(userId: string): Promise<string | null> {
    const pending = await this.tokens.findPendingByUserAndPurpose(userId, 'EMAIL_CHANGE');
    if (!pending || !isTokenUsable(pending.status, new Date(pending.expiresAt), new Date())) {
      return null;
    }
    return pending.newEmail;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<UpdateDisplayNameResult> {
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      return { kind: 'invalid_display_name' };
    }

    const updated = await this.users.updateDisplayName(userId, trimmed);
    if (!updated) {
      return { kind: 'invalid_display_name' };
    }

    this.logger.log({ actor: userId, event: 'display_name_updated' });
    const pendingEmail = await this.currentPendingEmail(userId);
    return {
      kind: 'success',
      profile: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        pendingEmail,
      },
    };
  }

  async requestEmailChange(userId: string, newEmail: string): Promise<RequestEmailChangeResult> {
    const availability = await this.emailAvailability.check(newEmail);
    if (availability.kind !== 'available') {
      return { kind: 'email_unavailable' };
    }

    const token = generateActionToken();
    const expiresAt = new Date(
      Date.now() + expiryWindowHours('EMAIL_CHANGE') * 3_600_000,
    ).toISOString();
    await this.tokens.create({ userId, purpose: 'EMAIL_CHANGE', newEmail, token, expiresAt });
    await this.users.setPendingEmail(userId, newEmail);

    try {
      await this.emailService.sendEmailChangeVerification(newEmail, newEmail, token);
    } catch (error) {
      this.logger.error({
        event: 'email_change_email_failed',
        actor: userId,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed' };
    }

    this.logger.log({ actor: userId, event: 'email_change_requested' });
    return { kind: 'success', pendingEmail: newEmail };
  }

  /** Idempotent no-op if nothing is pending (design.md "Cancel request"). */
  async cancelEmailChange(userId: string): Promise<void> {
    const pending = await this.tokens.findPendingByUserAndPurpose(userId, 'EMAIL_CHANGE');
    if (pending) {
      await this.tokens.markSuperseded(pending.id);
    }
    await this.users.clearPendingEmail(userId);
    this.logger.log({ actor: userId, event: 'email_change_cancelled' });
  }

  /** Collapses not-found/wrong-status/expired into one `invalid_token` result (SC-002). */
  async lookupEmailChangeToken(token: string): Promise<LookupEmailChangeTokenResult> {
    const row = await this.tokens.findByTokenAndPurpose(token, 'EMAIL_CHANGE');
    if (!row || !isTokenUsable(row.status, new Date(row.expiresAt), new Date()) || !row.newEmail) {
      return { kind: 'invalid_token' };
    }
    return { kind: 'success', newEmail: row.newEmail };
  }

  async confirmEmailChange(token: string): Promise<ConfirmEmailChangeResult> {
    const row = await this.tokens.findByTokenAndPurpose(token, 'EMAIL_CHANGE');
    if (!row || !row.newEmail) {
      return { kind: 'invalid_token' };
    }

    const used = await this.tokens.markUsed(row.id);
    if (!used) {
      return { kind: 'invalid_token' };
    }

    await this.users.updateEmail(row.userId, row.newEmail);
    this.logger.log({ actor: row.userId, event: 'email_change_confirmed' });
    return { kind: 'success', email: row.newEmail };
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    const user = await this.users.findById(userId);
    const passwordValid = user ? await argon2.verify(user.passwordHash, currentPassword) : false;
    if (!user || !passwordValid) {
      this.logger.log({ actor: userId, event: 'password_change', outcome: 'invalid_current' });
      return { kind: 'invalid_current_password' };
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return { kind: 'invalid_password' };
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.users.updatePasswordHash(userId, passwordHash);
    await this.sessions.deleteAllForUserExcept(userId, currentSessionId);

    this.logger.log({ actor: userId, event: 'password_change', outcome: 'success' });
    return { kind: 'success' };
  }

  /**
   * Always performs the same sequence of operations whether or not `email`
   * matches a user (research.md #6, FR-006/SC-003) — no exception either
   * branch can throw produces a distinguishable response, and the caller
   * (controller) always returns `200 { accepted: true }` regardless.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    if (user) {
      const token = generateActionToken();
      const expiresAt = new Date(
        Date.now() + expiryWindowHours('PASSWORD_RESET') * 3_600_000,
      ).toISOString();
      await this.tokens.create({ userId: user.id, purpose: 'PASSWORD_RESET', token, expiresAt });
      try {
        await this.emailService.sendPasswordReset(user.email, token);
      } catch (error) {
        // Never surfaced — a delivery failure on this branch would itself
        // leak account existence if it changed the response (research.md #6).
        this.logger.error({
          event: 'password_reset_email_failed',
          actor: user.id,
          error: (error as Error).message,
        });
      }
    } else {
      // Equivalent-shaped no-op (research.md #6): one DB read (matching the
      // real branch's one `create()` call) followed by one resolved-promise
      // await (matching the real branch's email-send await) — same number of
      // awaited steps, without touching real data or sending mail.
      await this.tokens.findPendingByUserAndPurpose(randomUUID(), 'PASSWORD_RESET');
      await Promise.resolve();
    }

    this.logger.log({ event: 'password_reset_requested' });
  }

  async lookupPasswordResetToken(token: string): Promise<LookupPasswordResetTokenResult> {
    const row = await this.tokens.findByTokenAndPurpose(token, 'PASSWORD_RESET');
    if (!row || !isTokenUsable(row.status, new Date(row.expiresAt), new Date())) {
      return { kind: 'invalid_token' };
    }
    return { kind: 'success' };
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<ConfirmPasswordResetResult> {
    const row = await this.tokens.findByTokenAndPurpose(token, 'PASSWORD_RESET');
    if (!row) {
      return { kind: 'invalid_token' };
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return { kind: 'invalid_password' };
    }

    const used = await this.tokens.markUsed(row.id);
    if (!used) {
      return { kind: 'invalid_token' };
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.users.updatePasswordHash(row.userId, passwordHash);
    await this.sessions.deleteAllForUser(row.userId);

    const user = await this.users.findById(row.userId);
    if (!user) {
      return { kind: 'invalid_token' };
    }
    const expiresAt = new Date(Date.now() + absoluteLifetimeMs()).toISOString();
    const session = await this.sessions.create(user.id, expiresAt);

    this.logger.log({ actor: user.id, event: 'password_reset_confirmed' });
    return { kind: 'success', user: toSessionUser(user), session };
  }

  async deleteAccount(userId: string): Promise<DeleteAccountResult> {
    try {
      const result = await this.accounts.deleteSelf(userId, userId);
      if (result.kind === 'last_admin') {
        return { kind: 'last_admin' };
      }
      return { kind: 'success' };
    } catch (error) {
      this.logger.error({
        event: 'delete_account_failed',
        actor: userId,
        error: (error as Error).message,
      });
      return { kind: 'deletion_failed' };
    }
  }
}
