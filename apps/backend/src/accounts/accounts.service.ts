import { Injectable, Logger } from '@nestjs/common';
import { canRemoveLastAdmin } from '@vaultfolio/domain-auth';
import type { AccountSummary } from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import { SessionsRepository } from '../auth/sessions.repository';
import type { User, UserRole } from '../auth/users.repository';

const DEFAULT_RETENTION_DAYS = 30;

function retentionDays(): number {
  const days = Number(process.env.ACCOUNT_RETENTION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
}

function computeRetentionExpiry(): string {
  return new Date(Date.now() + retentionDays() * 24 * 60 * 60 * 1000).toISOString();
}

function toSummary(user: User, activeAdminCount: number): AccountSummary {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    archivedAt: user.archivedAt,
    retentionExpiresAt: user.retentionExpiresAt,
    isLastActiveAdmin: user.status === 'ACTIVE' && user.role === 'ADMIN' && activeAdminCount === 1,
  };
}

export type ChangeRoleResult =
  { kind: 'success'; account: AccountSummary } | { kind: 'not_found' } | { kind: 'last_admin' };

export type ArchiveResult =
  | { kind: 'success'; account: AccountSummary }
  | { kind: 'not_found' }
  | { kind: 'last_admin' }
  | { kind: 'already_archived' };

export type ReactivateResult =
  | { kind: 'success'; account: AccountSummary }
  | { kind: 'not_found' }
  | { kind: 'retention_expired' };

export type DeleteSelfResult = { kind: 'success' } | { kind: 'forbidden' } | { kind: 'last_admin' };

/**
 * Account lifecycle orchestration (006, FR-001..FR-005). `canRemoveLastAdmin`
 * (`@vaultfolio/domain-auth`) is the single enforcement point for the
 * last-admin invariant — every path that could take the sole active admin
 * out of that role (demote, archive, self-delete) routes through it.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
  ) {}

  async listAll(): Promise<AccountSummary[]> {
    const [all, activeAdminCount] = await Promise.all([
      this.users.findAll(),
      this.users.countActiveAdmins(),
    ]);
    return all.map((user) => toSummary(user, activeAdminCount));
  }

  async changeRole(actorId: string, id: string, role: UserRole): Promise<ChangeRoleResult> {
    const user = await this.users.findById(id);
    if (!user) {
      return { kind: 'not_found' };
    }

    const wouldLoseActiveAdmin =
      user.status === 'ACTIVE' && user.role === 'ADMIN' && role !== 'ADMIN';
    if (wouldLoseActiveAdmin) {
      const activeAdminCount = await this.users.countActiveAdmins();
      if (!canRemoveLastAdmin(activeAdminCount, true)) {
        this.logger.log({
          actor: actorId,
          target: id,
          event: 'change_role',
          outcome: 'last_admin',
        });
        return { kind: 'last_admin' };
      }
    }

    const updated = await this.users.updateRole(id, role);
    if (!updated) {
      return { kind: 'not_found' };
    }

    const activeAdminCount = await this.users.countActiveAdmins();
    this.logger.log({ actor: actorId, target: id, event: 'change_role', outcome: 'success' });
    return { kind: 'success', account: toSummary(updated, activeAdminCount) };
  }

  async archive(actorId: string, id: string): Promise<ArchiveResult> {
    const user = await this.users.findById(id);
    if (!user) {
      return { kind: 'not_found' };
    }
    if (user.status === 'ARCHIVED') {
      return { kind: 'already_archived' };
    }

    const isTargetActiveAdmin = user.role === 'ADMIN';
    if (isTargetActiveAdmin) {
      const activeAdminCount = await this.users.countActiveAdmins();
      if (!canRemoveLastAdmin(activeAdminCount, true)) {
        this.logger.log({ actor: actorId, target: id, event: 'archive', outcome: 'last_admin' });
        return { kind: 'last_admin' };
      }
    }

    const archived = await this.users.archive(id, computeRetentionExpiry());
    if (!archived) {
      // Race: the row moved to ARCHIVED between our check above and the
      // status-guarded UPDATE (research.md #4).
      return { kind: 'already_archived' };
    }

    await this.sessions.deleteAllForUser(id);
    const activeAdminCount = await this.users.countActiveAdmins();
    this.logger.log({ actor: actorId, target: id, event: 'archive', outcome: 'success' });
    return { kind: 'success', account: toSummary(archived, activeAdminCount) };
  }

  async reactivate(actorId: string, id: string): Promise<ReactivateResult> {
    const user = await this.users.findById(id);
    if (!user || user.status !== 'ARCHIVED') {
      return { kind: 'not_found' };
    }

    if (user.retentionExpiresAt && new Date(user.retentionExpiresAt).getTime() <= Date.now()) {
      this.logger.log({
        actor: actorId,
        target: id,
        event: 'reactivate',
        outcome: 'retention_expired',
      });
      return { kind: 'retention_expired' };
    }

    const reactivated = await this.users.reactivate(id);
    if (!reactivated) {
      return { kind: 'not_found' };
    }

    const activeAdminCount = await this.users.countActiveAdmins();
    this.logger.log({ actor: actorId, target: id, event: 'reactivate', outcome: 'success' });
    return { kind: 'success', account: toSummary(reactivated, activeAdminCount) };
  }

  async deleteSelf(actorId: string, targetId: string): Promise<DeleteSelfResult> {
    if (actorId !== targetId) {
      return { kind: 'forbidden' };
    }

    const user = await this.users.findById(actorId);
    const isActiveAdmin = user?.status === 'ACTIVE' && user.role === 'ADMIN';
    if (isActiveAdmin) {
      const activeAdminCount = await this.users.countActiveAdmins();
      if (!canRemoveLastAdmin(activeAdminCount, true)) {
        this.logger.log({
          actor: actorId,
          target: targetId,
          event: 'delete_self',
          outcome: 'last_admin',
        });
        return { kind: 'last_admin' };
      }
    }

    await this.sessions.deleteAllForUser(actorId);
    await this.users.deleteById(actorId);
    this.logger.log({ actor: actorId, target: targetId, event: 'delete_self', outcome: 'success' });
    return { kind: 'success' };
  }
}
