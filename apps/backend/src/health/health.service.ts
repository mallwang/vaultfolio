import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async check(): Promise<HealthStatus> {
    const connected = await this.database.ping();

    return {
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    };
  }
}
