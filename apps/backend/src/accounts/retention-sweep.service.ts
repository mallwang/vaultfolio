import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersRepository } from '../auth/users.repository';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Permanently deletes `ARCHIVED` accounts past their `retention_expires_at`
 * window (006, FR-005) — cascading owned data via `UsersRepository.deleteById`.
 * Schedules an hourly sweep on module init via `setInterval`.
 */
@Injectable()
export class RetentionSweepService implements OnModuleInit {
  private readonly logger = new Logger(RetentionSweepService.name);

  constructor(private readonly users: UsersRepository) {}

  onModuleInit(): void {
    setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  async sweep(): Promise<void> {
    const candidates = await this.users.findArchivedPastRetention();
    for (const user of candidates) {
      await this.users.deleteById(user.id);
      this.logger.log({ event: 'account_retention_deleted', target: user.email });
    }
  }
}
