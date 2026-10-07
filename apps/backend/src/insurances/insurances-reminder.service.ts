import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { type InsuranceContract, UserRole, UserStatus } from '@vaultfolio/api-contract';
import { daysBetween, nextCancellationDate } from '@vaultfolio/insurances';
import { renderNotification, resolveLanguage } from '@vaultfolio/notifications';
import { type User, UsersRepository } from '../auth/users.repository';
import { requireAbsoluteUrl } from '../mail/absolute-url';
import { MailerService } from '../mail/mailer.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { InsurancesCryptoService } from './insurances-crypto.service';
import { insuranceTypeLabel } from './insurance-type-labels';
import { InsurancesRepository } from './insurances.repository';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Cancellation-deadline reminder e-mails (R7). An hourly sweep sends at most one mail per contract
 * and deadline; the plain log's primary key `(contract_id, deadline_date)` makes a duplicate
 * impossible even if sweeps overlap. The mail carries only type label, contract name and date —
 * never amounts, insurer or contract number. Logs carry counts and ids only.
 */
@Injectable()
export class InsurancesReminderService implements OnModuleInit {
  private readonly logger = new Logger(InsurancesReminderService.name);

  constructor(
    private readonly repository: InsurancesRepository,
    private readonly crypto: InsurancesCryptoService,
    private readonly users: UsersRepository,
    private readonly mailer: MailerService,
    private readonly maintenance: MaintenanceService,
  ) {}

  onModuleInit(): void {
    setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  /** Returns the number of reminders sent. */
  async sweep(today: string = new Date().toISOString().slice(0, 10)): Promise<number> {
    if (!this.crypto.available) return 0;
    // Nothing is claimed while skipped, so the first sweep after maintenance catches up (041).
    if (this.maintenance.isInMaintenance('insurances')) return 0;
    let sent = 0;
    for (const ownerId of this.repository.ownersWithSettings()) {
      try {
        sent += await this.sweepOwner(ownerId, today); // NOSONAR sequential on purpose: no mail bursts
      } catch (error) {
        this.logger.error({
          event: 'InsuranceReminderOwnerFailed',
          ownerId,
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    }
    if (sent > 0) this.logger.log({ event: 'InsuranceRemindersSent', count: sent });
    return sent;
  }

  private async sweepOwner(ownerId: string, today: string): Promise<number> {
    const { reminders } = this.repository.getSettings(ownerId);
    if (!reminders.enabled) return 0;
    const user = await this.users.findById(ownerId);
    if (!user || !isEntitled(user)) return 0;

    let sent = 0;
    for (const contract of this.repository.list(ownerId)) {
      const deadline = dueDeadline(contract, today, reminders.leadDays);
      if (deadline && (await this.remind(user, contract, deadline))) sent += 1; // NOSONAR sequential on purpose
    }
    return sent;
  }

  /** Claims the reminder row first (dedup), then sends; a failed send releases the claim for a retry. */
  private async remind(
    user: User,
    contract: InsuranceContract,
    deadline: string,
  ): Promise<boolean> {
    if (!this.repository.claimReminder(user.id, contract.id, deadline)) return false;
    const language = resolveLanguage(user.emailLanguage) === 'de' ? 'de' : 'en';
    try {
      await this.mailer.send({
        to: user.email,
        ...renderNotification({
          type: 'insurance-deadline-reminder',
          preferredLanguage: user.emailLanguage,
          viewModel: {
            typeLabel: insuranceTypeLabel(contract.type, language),
            contractName: contract.name,
            deadlineDate: deadline,
            areaUrl: requireAbsoluteUrl('/app/insurances'),
          },
        }),
      });
      return true;
    } catch {
      this.repository.releaseReminder(contract.id, deadline);
      this.logger.warn({ event: 'InsuranceReminderSendFailed', contractId: contract.id });
      return false;
    }
  }
}

function isEntitled(user: User): boolean {
  return (
    user.status === UserStatus.ACTIVE &&
    (user.role === UserRole.ADMIN || user.domainScopes.includes('insurances'))
  );
}

/** The deadline date when the contract is due for a reminder today, else `null`. */
function dueDeadline(contract: InsuranceContract, today: string, leadDays: number): string | null {
  if (contract.status !== 'ACTIVE' || !contract.reminderEnabled) return null;
  const info = nextCancellationDate(contract, today);
  if (info.kind !== 'DEADLINE') return null;
  const daysLeft = daysBetween(today, info.date);
  return daysLeft >= 0 && daysLeft <= leadDays ? info.date : null;
}
