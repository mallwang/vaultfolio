import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { validatePassword } from '@vaultfolio/domain-auth';
import { generateInvitationToken } from '@vaultfolio/domain-invitations';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import { EmailAvailabilityService } from '../shared/email-availability.service';
import { SignupsRepository } from './signups.repository';
import type { SignupRequest } from './signups.repository';
import { EmailService } from './email.service';

const DEFAULT_EXPIRY_HOURS = 24;

function expiryHours(): number {
  const hours = Number(process.env.SIGNUP_EXPIRY_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_EXPIRY_HOURS;
}

/** `createdAt` + `hours` hours, as an ISO-8601 string (Principle I: pure, no implicit `Date.now()`). */
function computeExpiry(createdAt: Date, hours: number): string {
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function toSummary(request: SignupRequest): SignupSummary {
  return {
    id: request.id,
    email: request.email,
    status: request.status,
    createdAt: request.createdAt,
    verifiedAt: request.verifiedAt,
    resolvedAt: request.resolvedAt,
  };
}

export type SubmitSignupResult =
  | { kind: 'success'; request: SignupRequest }
  | { kind: 'invalid_password' }
  | { kind: 'email_unavailable' }
  | { kind: 'email_delivery_failed'; request: SignupRequest };

export type LookupTokenResult = { kind: 'success'; email: string } | { kind: 'invalid_token' };

export type VerifySignupResult =
  | { kind: 'success'; request: SignupRequest }
  | { kind: 'invalid_token' }
  | { kind: 'email_delivery_failed'; request: SignupRequest };

export type ResolveSignupResult =
  | { kind: 'success'; request: SignupRequest }
  | { kind: 'not_found' }
  | { kind: 'not_verified' }
  | { kind: 'already_resolved' }
  | { kind: 'email_delivery_failed'; request: SignupRequest };

export type DeleteSignupResult = { kind: 'success' } | { kind: 'not_found' };

/**
 * Orchestrates the public sign-up lifecycle (User Stories 1 & 2,
 * data-model.md / contracts/signups-api.md): submit-and-email, public token
 * lookup (lazy-expire), verify-and-notify-admins, admin list/approve/reject
 * (creates the active account / blacklists the email), and delete
 * (clears the blacklist entry when deleting a REJECTED row, FR-011).
 */
@Injectable()
export class SignupsService {
  private readonly logger = new Logger(SignupsService.name);

  constructor(
    private readonly signups: SignupsRepository,
    private readonly users: UsersRepository,
    private readonly emailAvailability: EmailAvailabilityService,
    private readonly emailService: EmailService,
  ) {}

  async submit(email: string, password: string): Promise<SubmitSignupResult> {
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return { kind: 'invalid_password' };
    }

    const availability = await this.emailAvailability.check(email);
    if (availability.kind !== 'available') {
      return { kind: 'email_unavailable' };
    }

    const token = generateInvitationToken();
    const expiresAt = computeExpiry(new Date(), expiryHours());
    const passwordHash = await argon2.hash(password);
    const request = await this.signups.create({ email, passwordHash, token, expiresAt });

    try {
      await this.emailService.sendVerification(email, token);
    } catch (error) {
      this.logger.error({
        event: 'signup_verification_email_failed',
        signupRequestId: request.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', request };
    }

    this.logger.log({ event: 'signup_submitted', target: email });
    return { kind: 'success', request };
  }

  /** Public token lookup: collapses not-found/resolved/expired into `invalid_token`, never distinguishing (FR-010). */
  async lookupByToken(token: string): Promise<LookupTokenResult> {
    const request = await this.signups.findByToken(token);
    if (!request || request.status !== 'PENDING') {
      return { kind: 'invalid_token' };
    }
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      await this.signups.markExpired(request.id);
      return { kind: 'invalid_token' };
    }
    return { kind: 'success', email: request.email };
  }

  /**
   * Verifies a sign-up: never trusts a prior `lookupByToken` call — the
   * status+expiry guard runs again atomically in `markVerified`'s single
   * UPDATE (closing the check-then-act race, data-model.md), then notifies
   * every admin (FR-004).
   */
  async verify(token: string): Promise<VerifySignupResult> {
    const request = await this.signups.findByToken(token);
    if (!request) {
      return { kind: 'invalid_token' };
    }

    const verified = await this.signups.markVerified(request.id);
    if (!verified) {
      return { kind: 'invalid_token' };
    }

    try {
      const admins = await this.users.findAllByRole('ADMIN');
      await this.emailService.sendAdminNotification(
        admins.map((admin) => admin.email),
        verified.email,
      );
    } catch (error) {
      this.logger.error({
        event: 'signup_admin_notification_failed',
        signupRequestId: verified.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', request: verified };
    }

    this.logger.log({ event: 'signup_verified', target: verified.email });
    return { kind: 'success', request: verified };
  }

  async list(): Promise<SignupSummary[]> {
    const all = await this.signups.findAll();
    return all.map(toSummary);
  }

  /** Approves a VERIFIED request (FR-006): creates an active account, sends a welcome email. */
  async approve(id: string, adminId: string): Promise<ResolveSignupResult> {
    const existing = await this.signups.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }
    if (existing.status === 'PENDING') {
      return { kind: 'not_verified' };
    }

    const approved = await this.signups.markApproved(id, adminId);
    if (!approved) {
      return { kind: 'already_resolved' };
    }

    await this.users.create({
      email: approved.email,
      displayName: approved.email,
      passwordHash: approved.passwordHash,
      role: 'MEMBER',
    });

    try {
      await this.emailService.sendWelcome(approved.email);
    } catch (error) {
      this.logger.error({
        event: 'signup_welcome_email_failed',
        signupRequestId: approved.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', request: approved };
    }

    this.logger.log({ event: 'signup_approved', actor: adminId, target: approved.email });
    return { kind: 'success', request: approved };
  }

  /** Rejects a VERIFIED request (FR-007): blacklists the email, sends a rejection email (no reason exposed, FR-009). */
  async reject(id: string, adminId: string, reason?: string): Promise<ResolveSignupResult> {
    const existing = await this.signups.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }
    if (existing.status === 'PENDING') {
      return { kind: 'not_verified' };
    }

    const rejected = await this.signups.markRejected(id, adminId);
    if (!rejected) {
      return { kind: 'already_resolved' };
    }

    await this.signups.createBlacklistEntry({
      email: rejected.email,
      reason: reason ?? null,
      signupRequestId: rejected.id,
    });

    try {
      await this.emailService.sendRejection(rejected.email);
    } catch (error) {
      this.logger.error({
        event: 'signup_rejection_email_failed',
        signupRequestId: rejected.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', request: rejected };
    }

    this.logger.log({ event: 'signup_rejected', actor: adminId, target: rejected.email });
    return { kind: 'success', request: rejected };
  }

  /** Deletes a sign-up entry (FR-011); clears its blacklist row too if it was REJECTED. */
  async delete(id: string): Promise<DeleteSignupResult> {
    const existing = await this.signups.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }

    if (existing.status === 'REJECTED') {
      await this.signups.deleteBlacklistEntryBySignupRequestId(id);
    }
    await this.signups.deleteById(id);

    return { kind: 'success' };
  }
}
