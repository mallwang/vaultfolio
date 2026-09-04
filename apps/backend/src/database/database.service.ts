import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as argon2 from 'argon2';
import { SUPPORTED_LANGUAGES } from '@vaultfolio/api-contract';

/**
 * Thin wrapper around a `better-sqlite3` database handle. Deliberately not an
 * ORM (Principle V, YAGNI) — this feature only needs to (a) ping the
 * database for the health check and (b) create/read the single placeholder
 * table that proves exact-decimal persistence (FR-008, data-model.md).
 *
 * The database is a single file at `DATABASE_PATH` (default
 * `./data/vaultfolio.db`), bind-mounted from the host — see
 * specs/004-sqlite-migration/data-model.md.
 *
 * There is no productive database in use yet, so `initializeSchema()` below
 * creates every table at its current, final shape directly (all `CREATE
 * TABLE IF NOT EXISTS` — safe to run on every boot) rather than accreting a
 * chain of incremental migrations. If a real deployment ever needs to change
 * this schema in place, reach for a proper migration at that point.
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

      this.initializeSchema();
      await this.ensureBootstrapAdmin();
      this.ready = true;
    } catch (error) {
      // A startup failure (unwritable ./data, schema init failure, ...)
      // should not crash the process — the health check (GET /health) is
      // what surfaces "database unreachable" to callers, per the Edge Case
      // in spec.md.
      this.logger.error('Database initialization failed at startup', error as Error);
      this.ready = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.db?.close();
  }

  /** Creates every table/index at its current shape (idempotent — safe on every boot). */
  private initializeSchema(): void {
    const db = this.requireDb();

    // Placeholder table used only to prove exact-decimal persistence (data-model.md).
    db.exec(`
      CREATE TABLE IF NOT EXISTS example_value (
        id TEXT PRIMARY KEY,
        amount TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);

    // Holdings — asset types cover ETF/SHARE/PRECIOUS_METAL/CRYPTO/DEPOSIT_MONEY
    // (data-model.md). Each type's required/forbidden columns are enforced by
    // `holdings_fields_match_asset_type`.
    db.exec(`
      CREATE TABLE IF NOT EXISTS holdings (
        id             TEXT PRIMARY KEY,
        asset_type     TEXT NOT NULL CHECK (asset_type IN ('ETF', 'SHARE', 'PRECIOUS_METAL', 'CRYPTO', 'DEPOSIT_MONEY')),
        management     TEXT NOT NULL CHECK (management <> ''),
        quantity       TEXT NULL CHECK (quantity IS NULL OR CAST(quantity AS REAL) > 0),
        purchase_price TEXT NULL CHECK (purchase_price IS NULL OR CAST(purchase_price AS REAL) > 0),
        purchase_date  TEXT NULL,
        isin           TEXT NULL,
        name           TEXT NULL,
        weight_grams   TEXT NULL CHECK (weight_grams IS NULL OR CAST(weight_grams AS REAL) > 0),
        current_value  TEXT NULL CHECK (current_value IS NULL OR CAST(current_value AS REAL) >= 0),
        created_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        owner_id       TEXT NULL,
        CONSTRAINT holdings_fields_match_asset_type CHECK (
          (asset_type = 'ETF' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
            AND purchase_price IS NOT NULL AND purchase_date IS NULL
            AND weight_grams IS NULL AND current_value IS NULL)
          OR
          (asset_type = 'SHARE' AND isin IS NOT NULL AND name IS NOT NULL AND quantity IS NOT NULL
            AND purchase_price IS NOT NULL AND weight_grams IS NULL AND current_value IS NULL)
          OR
          (asset_type = 'PRECIOUS_METAL' AND name IS NOT NULL AND weight_grams IS NOT NULL
            AND isin IS NULL AND quantity IS NULL AND purchase_price IS NULL
            AND purchase_date IS NULL)
          OR
          (asset_type = 'CRYPTO' AND name IS NOT NULL AND quantity IS NOT NULL
            AND purchase_price IS NOT NULL AND isin IS NULL AND weight_grams IS NULL
            AND current_value IS NULL)
          OR
          (asset_type = 'DEPOSIT_MONEY' AND name IS NOT NULL AND current_value IS NOT NULL
            AND isin IS NULL AND quantity IS NULL AND purchase_price IS NULL
            AND purchase_date IS NULL AND weight_grams IS NULL)
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
    db.exec('CREATE INDEX IF NOT EXISTS holdings_owner_id_idx ON holdings (owner_id)');

    // Auth/isolation — users, sessions, and per-account profile fields
    // (data-model.md across 005-auth-sessions-isolation, 006-admin-accounts-
    // invitations, 008-profile-password-account, 013-multilanguage-support).
    const allowedLanguageCodes = SUPPORTED_LANGUAGES.map((language) => `'${language.code}'`).join(
      ', ',
    );
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id                     TEXT PRIMARY KEY,
        email                  TEXT NOT NULL,
        display_name           TEXT NOT NULL,
        password_hash          TEXT NOT NULL,
        role                   TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
        status                 TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE',
        failed_attempts        INTEGER NOT NULL DEFAULT 0,
        locked_until           TEXT NULL,
        archived_at            TEXT NULL,
        retention_expires_at   TEXT NULL,
        pending_email          TEXT NULL,
        email_language         TEXT NULL CHECK (email_language IS NULL OR email_language IN (${allowedLanguageCodes})),
        created_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at             TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email COLLATE NOCASE)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL REFERENCES users(id),
        created_at      TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        last_active_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        expires_at      TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`);

    // 006-admin-accounts-invitations
    db.exec(`
      CREATE TABLE IF NOT EXISTS invitations (
        id           TEXT PRIMARY KEY,
        email        TEXT NOT NULL,
        token        TEXT NOT NULL,
        role         TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
        status       TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','CANCELLED','SUPERSEDED')) DEFAULT 'PENDING',
        invited_by   TEXT NOT NULL REFERENCES users(id),
        created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        expires_at   TEXT NOT NULL,
        accepted_at  TEXT NULL
      )
    `);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations (email COLLATE NOCASE)',
    );

    // 007-self-service-signup / 008-profile-password-account
    db.exec(`
      CREATE TABLE IF NOT EXISTS signup_requests (
        id                  TEXT PRIMARY KEY,
        email               TEXT NOT NULL,
        password_hash       TEXT NOT NULL,
        token               TEXT NOT NULL,
        status              TEXT NOT NULL CHECK (status IN ('PENDING','VERIFIED','APPROVED','REJECTED')) DEFAULT 'PENDING',
        created_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        expires_at          TEXT NOT NULL,
        verified_at         TEXT NULL,
        resolved_at         TEXT NULL,
        resolved_by         TEXT NULL REFERENCES users(id),
        account_deleted_at  TEXT NULL
      )
    `);
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_token_idx ON signup_requests (token)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS signup_requests_email_idx ON signup_requests (email COLLATE NOCASE)',
    );

    db.exec(`
      CREATE TABLE IF NOT EXISTS email_blacklist (
        email             TEXT PRIMARY KEY COLLATE NOCASE,
        reason            TEXT NULL,
        created_at        TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        signup_request_id TEXT NULL REFERENCES signup_requests(id)
      )
    `);

    // 008-profile-password-account
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_action_tokens (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        purpose     TEXT NOT NULL CHECK (purpose IN ('EMAIL_CHANGE','PASSWORD_RESET')),
        new_email   TEXT NULL,
        token       TEXT NOT NULL UNIQUE,
        status      TEXT NOT NULL CHECK (status IN ('PENDING','USED','EXPIRED','SUPERSEDED')) DEFAULT 'PENDING',
        created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        expires_at  TEXT NOT NULL,
        used_at     TEXT NULL
      )
    `);
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS account_action_tokens_token_idx ON account_action_tokens (token)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS account_action_tokens_user_purpose_idx ON account_action_tokens (user_id, purpose)',
    );
  }

  /**
   * Creates a single Administrator account from `BOOTSTRAP_ADMIN_EMAIL`/
   * `BOOTSTRAP_ADMIN_PASSWORD` if — and only if — the `users` table is
   * currently empty (research.md #6). Returns the (possibly pre-existing)
   * admin's id. Logs a clear startup error and skips seeding if the env vars
   * are unset with no existing users, rather than crashing the process.
   */
  private async ensureBootstrapAdmin(): Promise<string | null> {
    const db = this.requireDb();
    const existing = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
    if (existing) {
      return existing.id;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password) {
      this.logger.error(
        'BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD are unset and no users exist — ' +
          'auth routes will reject every sign-in until an admin account is created.',
      );
      return null;
    }

    const id = randomUUID();
    const passwordHash = await argon2.hash(password);
    db.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, role)
       VALUES (?, ?, 'Administrator', ?, 'ADMIN')`,
    ).run(id, email, passwordHash);

    this.logger.log(`Bootstrap admin account created (${email}).`);
    return id;
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
  async query<T = Record<string, unknown>>(
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
