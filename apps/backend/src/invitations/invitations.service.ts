import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { validatePassword } from '@vaultfolio/domain-auth';
import { computeExpiry, generateInvitationToken } from '@vaultfolio/domain-invitations';
import type { InvitationSummary, SessionUser } from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import { SessionsRepository } from '../auth/sessions.repository';
import { toSessionUser } from '../auth/auth.service';
import type { Session } from '../auth/sessions.repository';
import { InvitationsRepository } from './invitations.repository';
import type { Invitation, InvitationRole } from './invitations.repository';
import { EmailService } from './email.service';

const DEFAULT_EXPIRY_DAYS = 7;

function expiryDays(): number {
  const days = Number(process.env.INVITATION_EXPIRY_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPIRY_DAYS;
}

function toSummary(invitation: Invitation): InvitationSummary {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
}

export type CheckEmailAvailableResult =
  | { kind: 'available' }
  | { kind: 'has_account' }
  | { kind: 'has_pending_invitation'; invitation: Invitation };

export type CreateInvitationResult =
  | { kind: 'success'; invitation: Invitation }
  | { kind: 'account_exists' }
  | { kind: 'email_delivery_failed'; invitation: Invitation };

export type ResolveInvitationResult =
  | { kind: 'success'; invitation: Invitation }
  | { kind: 'not_found' }
  | { kind: 'already_resolved' };

export type ResendInvitationResult =
  | { kind: 'success'; invitation: Invitation }
  | { kind: 'not_found' }
  | { kind: 'already_resolved' }
  | { kind: 'email_delivery_failed'; invitation: Invitation };

export type LookupTokenResult =
  { kind: 'success'; email: string; role: InvitationRole } | { kind: 'invalid' };

export type AcceptInvitationResult =
  | { kind: 'success'; user: SessionUser; session: Session }
  | { kind: 'invalid_password' }
  | { kind: 'invalid' };

/**
 * Orchestrates the invitation lifecycle (User Story 2, data-model.md /
 * contracts/invitations-api.md): create-and-email, list, cancel, resend
 * (supersede-then-insert), public token lookup (lazy-expire), and accept
 * (atomic status+expiry-guarded transition, user creation, auto-sign-in).
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Three-way check used before creating/resending an invitation (T056):
   * an existing active/archived account always wins over a pending
   * invitation for the same email.
   */
  async checkEmailAvailable(email: string): Promise<CheckEmailAvailableResult> {
    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      return { kind: 'has_account' };
    }
    const pending = await this.invitations.findPendingByEmail(email);
    if (pending) {
      return { kind: 'has_pending_invitation', invitation: pending };
    }
    return { kind: 'available' };
  }

  async create(
    email: string,
    role: InvitationRole,
    invitedBy: string,
  ): Promise<CreateInvitationResult> {
    const availability = await this.checkEmailAvailable(email);
    if (availability.kind === 'has_account') {
      return { kind: 'account_exists' };
    }
    if (availability.kind === 'has_pending_invitation') {
      await this.invitations.supersede(availability.invitation.id);
    }

    const token = generateInvitationToken();
    const expiresAt = computeExpiry(new Date(), expiryDays());
    const invitation = await this.invitations.create({ email, token, role, invitedBy, expiresAt });

    try {
      await this.emailService.sendInvitation(email, token);
    } catch (error) {
      this.logger.error({
        event: 'invitation_email_failed',
        invitationId: invitation.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', invitation };
    }

    this.logger.log({ event: 'invitation_created', actor: invitedBy, target: email });
    return { kind: 'success', invitation };
  }

  async list(): Promise<InvitationSummary[]> {
    const all = await this.invitations.findAll();
    return all.map(toSummary);
  }

  async cancel(id: string, actor: string): Promise<ResolveInvitationResult> {
    const existing = await this.invitations.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }
    const cancelled = await this.invitations.cancel(id);
    if (!cancelled) {
      return { kind: 'already_resolved' };
    }
    this.logger.log({ event: 'invitation_cancelled', actor, target: cancelled.email });
    return { kind: 'success', invitation: cancelled };
  }

  async resend(id: string, actor: string): Promise<ResendInvitationResult> {
    const existing = await this.invitations.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }
    const superseded = await this.invitations.supersede(id);
    if (!superseded) {
      return { kind: 'already_resolved' };
    }

    const token = generateInvitationToken();
    const expiresAt = computeExpiry(new Date(), expiryDays());
    const invitation = await this.invitations.create({
      email: superseded.email,
      token,
      role: superseded.role,
      invitedBy: superseded.invitedBy,
      expiresAt,
    });

    try {
      await this.emailService.sendInvitation(invitation.email, token);
    } catch (error) {
      this.logger.error({
        event: 'invitation_email_failed',
        invitationId: invitation.id,
        error: (error as Error).message,
      });
      return { kind: 'email_delivery_failed', invitation };
    }

    this.logger.log({ event: 'invitation_resent', actor, target: invitation.email });
    return { kind: 'success', invitation };
  }

  /** Public token lookup (FR-012): collapses not-found/expired/used into `invalid`, never distinguishing. */
  async lookupByToken(token: string): Promise<LookupTokenResult> {
    const invitation = await this.invitations.findByToken(token);
    if (!invitation) {
      return { kind: 'invalid' };
    }
    if (invitation.status !== 'PENDING') {
      return { kind: 'invalid' };
    }
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      await this.invitations.markExpired(invitation.id);
      return { kind: 'invalid' };
    }
    return { kind: 'success', email: invitation.email, role: invitation.role };
  }

  /**
   * Accepts an invitation: never trusts a prior `lookupByToken` call — the
   * status+expiry guard runs again atomically in `markAccepted`'s single
   * UPDATE (closing the check-then-act race, data-model.md).
   */
  async accept(
    token: string,
    password: string,
    displayName: string,
  ): Promise<AcceptInvitationResult> {
    const invitation = await this.invitations.findByToken(token);
    if (!invitation) {
      return { kind: 'invalid' };
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return { kind: 'invalid_password' };
    }

    const accepted = await this.invitations.markAccepted(invitation.id);
    if (!accepted) {
      return { kind: 'invalid' };
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.users.create({
      email: accepted.email,
      displayName,
      passwordHash,
      role: accepted.role,
    });

    const expiresAt = new Date(Date.now() + absoluteLifetimeMs()).toISOString();
    const session = await this.sessions.create(user.id, expiresAt);

    this.logger.log({ event: 'invitation_accepted', actor: user.id, target: user.email });
    return { kind: 'success', user: toSessionUser(user), session };
  }
}

const DEFAULT_ABSOLUTE_LIFETIME_HOURS = 12;

function absoluteLifetimeMs(): number {
  const hours = Number(process.env.SESSION_ABSOLUTE_LIFETIME_HOURS);
  return (
    (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ABSOLUTE_LIFETIME_HOURS) * 3_600_000
  );
}
