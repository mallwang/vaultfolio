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

    // Manual Holdings Entry (003-manual-holdings-entry) — see data-model.md's
    // "Persistence" section for the full rationale behind this shape.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS holdings (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_type     TEXT NOT NULL CHECK (asset_type IN ('ETF', 'SHARE', 'GOLD', 'BITCOIN')),
        management     TEXT NOT NULL CHECK (management <> ''),
        quantity       NUMERIC(20, 8) NULL CHECK (quantity IS NULL OR quantity > 0),
        purchase_price NUMERIC(20, 8) NULL CHECK (purchase_price IS NULL OR purchase_price > 0),
        purchase_date  DATE NULL,
        isin           TEXT NULL,
        name           TEXT NULL,
        weight_grams   NUMERIC(20, 8) NULL CHECK (weight_grams IS NULL OR weight_grams > 0),
        current_value  NUMERIC(20, 8) NULL CHECK (current_value IS NULL OR current_value > 0),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT holdings_fields_match_asset_type CHECK (
          (asset_type = 'ETF' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
            AND purchase_price IS NOT NULL AND purchase_date IS NULL
            AND weight_grams IS NULL AND current_value IS NULL)
          OR
          (asset_type = 'SHARE' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
            AND purchase_price IS NOT NULL AND weight_grams IS NULL AND current_value IS NULL)
          OR
          (asset_type = 'GOLD' AND weight_grams IS NOT NULL
            AND isin IS NULL AND name IS NULL AND quantity IS NULL AND purchase_price IS NULL
            AND purchase_date IS NULL)
          OR
          (asset_type = 'BITCOIN' AND quantity IS NOT NULL AND purchase_price IS NOT NULL
            AND isin IS NULL AND name IS NULL AND weight_grams IS NULL AND current_value IS NULL)
        )
      )
    `);

    // Backs the ETF/Gold upsert lookup (research.md #4) — not a uniqueness
    // constraint enforced at the DB layer; the match-then-write decision
    // stays in the repository/domain layer (holding-merge.ts).
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS holdings_upsert_lookup_idx
        ON holdings (asset_type, management, isin)
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

  /**
   * Generic parameterized query, exposed for feature repositories (e.g.
   * `HoldingsRepository`) that need raw `pg` access without each owning its
   * own `Pool` (no ORM, Principle V/YAGNI).
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query(text, params as unknown[]);
    return result.rows as T[];
  }
}
