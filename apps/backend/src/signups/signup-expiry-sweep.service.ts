import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SignupsRepository } from './signups.repository';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Deletes `PENDING` sign-up requests past their `expires_at` window
 * (research.md #4), freeing the email with no residual state. Directly
 * mirrors `accounts/retention-sweep.service.ts` — schedules an hourly sweep
 * on module init via `setInterval`.
 */
@Injectable()
export class SignupExpirySweepService implements OnModuleInit {
  private readonly logger = new Logger(SignupExpirySweepService.name);

  constructor(private readonly signups: SignupsRepository) {}

  onModuleInit(): void {
    setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  async sweep(): Promise<void> {
    const candidates = await this.signups.findExpiredPending();
    for (const request of candidates) {
      await this.signups.deleteById(request.id);
      this.logger.log({ event: 'signup_expiry_swept', target: request.email });
    }
  }
}
