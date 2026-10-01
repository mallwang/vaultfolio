import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { REQUEST_LIMITS } from '@vaultfolio/requests';
import { RequestsRepository } from './requests.repository';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes the sample PDF and the stored rule draft of every request that has been Done or
 * Rejected for 30 days (033, FR-039); open requests are never touched and reopening a request
 * cancels the countdown (`closed_at` is cleared). Rows and status history stay. Mirrors the
 * account `RetentionSweepService`: an hourly timer, one transaction per sweep. `now` and
 * `retentionDays` are plain fields so tests can inject a clock and a period.
 */
@Injectable()
export class RequestsRetentionService implements OnModuleInit {
  private readonly logger = new Logger(RequestsRetentionService.name);

  now: () => Date = () => new Date();
  retentionDays: number = REQUEST_LIMITS.retentionDays;

  constructor(private readonly repository: RequestsRepository) {}

  onModuleInit(): void {
    setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  /** Returns the number of purged samples; logs a content-free line only when something was purged. */
  sweep(): number {
    const now = this.now();
    const cutoff = new Date(now.getTime() - this.retentionDays * DAY_MS).toISOString();
    const purged = this.repository.purgeClosedBefore(cutoff, now.toISOString());
    if (purged.length > 0) {
      this.logger.log({ event: 'RequestSamplesPurged', count: purged.length });
    }
    return purged.length;
  }
}
