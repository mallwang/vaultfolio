import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Thin wrapper around a `pg` connection pool. Deliberately not an ORM
 * (Principle V, YAGNI) — this feature only needs to (a) ping the database for
 * the health check and (b) create/read the single placeholder table that
 * proves exact-decimal `NUMERIC` persistence (FR-008, data-model.md).
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      user: process.env.DATABASE_USER ?? 'vaultfolio',
      password: process.env.DATABASE_PASSWORD ?? 'vaultfolio',
      database: process.env.DATABASE_NAME ?? 'vaultfolio',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.migrate();
    } catch (error) {
      // A migration failure at startup should not crash the process — the
      // health check (GET /health) is what surfaces "database unreachable"
      // to callers, per the Edge Case in spec.md.
      this.logger.error('Database migration failed at startup', error as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /** Creates the placeholder table used only to prove NUMERIC persistence (data-model.md). */
  private async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS example_value (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        amount NUMERIC(20, 8) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  /** Lightweight liveness check used by GET /health (contracts/health-api.md). */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.warn('Database ping failed', error as Error);
      return false;
    }
  }
}
