import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';

/**
 * Thin wrapper around a `better-sqlite3` database handle. Deliberately not an
 * ORM (Principle V, YAGNI) — this feature only needs to (a) ping the
 * database for the health check and (b) create/read the single placeholder
 * table that proves exact-decimal persistence (FR-008, data-model.md).
 *
 * The database is a single file at `DATABASE_PATH` (default
 * `./data/vaultfolio.db`), bind-mounted from the host — see
 * specs/004-sqlite-migration/data-model.md.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database | null = null;
  private ready = false;

  async onModuleInit(): Promise<void> {
    try {
      const databasePath = process.env.DATABASE_PATH ?? './data/vaultfolio.db';
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });

      this.db = new Database(databasePath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 5000');

      this.migrate();
      this.ready = true;
    } catch (error) {
      // A startup failure (unwritable ./data, migration failure, ...) should
      // not crash the process — the health check (GET /health) is what
      // surfaces "database unreachable" to callers, per the Edge Case in
      // spec.md.
      this.logger.error('Database initialization failed at startup', error as Error);
      this.ready = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.db?.close();
  }

  /** Creates the placeholder table used only to prove exact-decimal persistence (data-model.md). */
  private migrate(): void {
    const db = this.requireDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS example_value (
        id TEXT PRIMARY KEY,
        amount TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);

    // Manual Holdings Entry (003-manual-holdings-entry) — see data-model.md's
    // "Persistence" section for the full rationale behind this shape.
    db.exec(`
      CREATE TABLE IF NOT EXISTS holdings (
        id             TEXT PRIMARY KEY,
        asset_type     TEXT NOT NULL CHECK (asset_type IN ('ETF', 'SHARE', 'GOLD', 'BITCOIN')),
        management     TEXT NOT NULL CHECK (management <> ''),
        quantity       TEXT NULL CHECK (quantity IS NULL OR CAST(quantity AS REAL) > 0),
        purchase_price TEXT NULL CHECK (purchase_price IS NULL OR CAST(purchase_price AS REAL) > 0),
        purchase_date  TEXT NULL,
        isin           TEXT NULL,
        name           TEXT NULL,
        weight_grams   TEXT NULL CHECK (weight_grams IS NULL OR CAST(weight_grams AS REAL) > 0),
        current_value  TEXT NULL CHECK (current_value IS NULL OR CAST(current_value AS REAL) > 0),
        created_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
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
    db.exec(`
      CREATE INDEX IF NOT EXISTS holdings_upsert_lookup_idx
        ON holdings (asset_type, management, isin)
    `);
  }

  /** Lightweight liveness check used by GET /health (contracts/health-api.md). */
  async ping(): Promise<boolean> {
    if (!this.ready || !this.db) {
      return false;
    }
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      this.logger.warn('Database ping failed', error as Error);
      return false;
    }
  }

  /**
   * Generic parameterized query, exposed for feature repositories (e.g.
   * `HoldingsRepository`) that need raw `better-sqlite3` access without each
   * owning its own `Database` handle (no ORM, Principle V/YAGNI).
   *
   * Callers use `pg`-style `$1, $2, ...` positional placeholders (unchanged
   * from the previous `pg`-backed implementation), which — unlike
   * `better-sqlite3`'s anonymous `?` placeholders — may repeat or appear out
   * of numeric order in the SQL text (e.g. `holdings.repository.ts`'s
   * `UPDATE ... WHERE id = $1` puts `$1` textually last). This is the single
   * translation point: it rewrites every `$N` to `?` (anonymous placeholders
   * bind positionally in `better-sqlite3`, since its numbered `?N` form is
   * mishandled by the installed driver version) and reorders `params` to
   * match each `$N`'s position in the rewritten text, so callers' query
   * strings never need per-callsite edits.
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const db = this.requireDb();
    const reorderedParams: unknown[] = [];
    const sqliteSql = text.replace(/\$(\d+)/g, (_match, index: string) => {
      reorderedParams.push(params[Number(index) - 1]);
      return '?';
    });
    const statement = db.prepare(sqliteSql);

    if (/^\s*SELECT/i.test(sqliteSql) || /RETURNING/i.test(sqliteSql)) {
      return statement.all(...reorderedParams) as T[];
    }

    statement.run(...reorderedParams);
    return [];
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    return this.db;
  }
}
