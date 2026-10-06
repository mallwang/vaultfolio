import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as argon2 from 'argon2';
import { SUPPORTED_LANGUAGES, UserRole } from '@vaultfolio/api-contract';

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
 * `initializeSchema()` below creates every table via `CREATE TABLE IF NOT
 * EXISTS` — safe to run on every boot, and enough on its own for a brand-new
 * database. It is NOT enough on its own once a database already exists
 * (local dev data, or any real deployment): `IF NOT EXISTS` is a no-op
 * against an existing table, so a column added to one of these `CREATE
 * TABLE` statements never reaches a database created before that change —
 * every write against it then fails with "no such column" until someone
 * migrates the file by hand. Any change to an *existing* table's columns
 * therefore needs its own idempotent migration step below (guarded by a
 * `pragma_table_info` check, then `ALTER TABLE ... ADD COLUMN`), run from
 * `onModuleInit` after `initializeSchema()` — see `migrateDomainScopes` for
 * the current example. Only a brand-new table can skip this and rely on
 * `CREATE TABLE IF NOT EXISTS` alone.
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
      this.migrateDomainScopes();
      this.dropLegacyAccountsTable();
      this.migrateHoldingsAssetTypes();
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

  onModuleDestroy(): void {
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

    // Account Overview (025-account-overview): a static reference directory of the user's accounts
    // (banks, neobrokers, depots, credit cards) with no monetary values. Every field — name,
    // category, status, provider, website, purpose, card data, notes — lives only inside the
    // AES-256-GCM `payload_enc`.
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_overview_entries (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        payload_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS account_overview_entries_owner_idx ON account_overview_entries (owner_id)',
    );

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

    this.initializeEarningsSchema(db);
  }

  /**
   * 032-earnings-domain (data-model.md). Every monetary value lives only in the AES-256-GCM
   * encrypted `amounts_enc` payload; plain columns exist for lookup only (FR-041). Every table
   * carries `owner_id` and every repository query filters by it (FR-003).
   */
  private initializeEarningsSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS earnings_imports (
        id             TEXT PRIMARY KEY,
        owner_id       TEXT NOT NULL,
        file_name      TEXT NOT NULL,
        source_type    TEXT NOT NULL CHECK (source_type IN ('PAYSLIP_PDF', 'CERTIFICATE_PDF', 'EXPORT_JSON')),
        file_sha256    TEXT NOT NULL CHECK (length(file_sha256) = 64),
        parser_id      TEXT NOT NULL,
        parser_version TEXT NOT NULL,
        imported_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        corrected_count INTEGER NOT NULL DEFAULT 0 CHECK (corrected_count >= 0),
        UNIQUE (owner_id, file_sha256)
      )
    `);
    // FR-012a: databases created before figure correction lack the column (guarded, idempotent)
    const hasCorrectedCount = db
      .prepare("SELECT 1 FROM pragma_table_info('earnings_imports') WHERE name = 'corrected_count'")
      .get();
    if (!hasCorrectedCount) {
      db.exec(
        'ALTER TABLE earnings_imports ADD COLUMN corrected_count INTEGER NOT NULL DEFAULT 0 CHECK (corrected_count >= 0)',
      );
    }
    // 034: marks files read via on-device text recognition (guarded, idempotent; not encrypted data)
    const hasOcrRead = db
      .prepare("SELECT 1 FROM pragma_table_info('earnings_imports') WHERE name = 'ocr_read'")
      .get();
    if (!hasOcrRead) {
      db.exec('ALTER TABLE earnings_imports ADD COLUMN ocr_read INTEGER NOT NULL DEFAULT 0');
    }
    db.exec('CREATE INDEX IF NOT EXISTS earnings_imports_owner_idx ON earnings_imports (owner_id)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS earnings_employers (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        detected_name TEXT NOT NULL CHECK (detected_name <> ''),
        display_name  TEXT NULL,
        created_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (owner_id, detected_name)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS earnings_records (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        import_id   TEXT NOT NULL,
        employer_id TEXT NOT NULL,
        period      TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
        issued      TEXT NOT NULL CHECK (issued GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
        kind        TEXT NOT NULL CHECK (kind IN ('REGULAR', 'CORRECTION', 'PAYOUT_ONLY')),
        seq         INTEGER NOT NULL CHECK (seq >= 1),
        amounts_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (owner_id, employer_id, period, kind, seq)
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS earnings_records_owner_period_idx ON earnings_records (owner_id, period)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS earnings_records_import_idx ON earnings_records (import_id)',
    );

    db.exec(`
      CREATE TABLE IF NOT EXISTS earnings_certificates (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        import_id   TEXT NOT NULL,
        employer_id TEXT NOT NULL,
        year        INTEGER NOT NULL,
        amounts_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (owner_id, employer_id, year)
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS earnings_certificates_import_idx ON earnings_certificates (import_id)',
    );

    // 037-altersvorsorge: one row per pension entry. Monetary figures and the contract number live
    // only inside the AES-256-GCM `payload_enc`; the plain columns are non-monetary lookup fields.
    // Brand-new table, so `IF NOT EXISTS` is enough.
    db.exec(`
      CREATE TABLE IF NOT EXISTS retirement_records (
        id             TEXT PRIMARY KEY,
        owner_id       TEXT NOT NULL,
        pillar         TEXT NOT NULL CHECK (pillar IN ('STATUTORY', 'OCCUPATIONAL', 'PRIVATE')),
        contract_type  TEXT NOT NULL,
        origin         TEXT NOT NULL CHECK (origin IN ('IMPORTED', 'MANUAL')),
        status         TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAID_UP', 'IN_PAYOUT')),
        provider_label TEXT,
        statement_date TEXT NOT NULL CHECK (statement_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
        payout_start   TEXT CHECK (payout_start IS NULL OR payout_start GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
        parser_id      TEXT,
        parser_version TEXT,
        ocr_read       INTEGER NOT NULL DEFAULT 0 CHECK (ocr_read IN (0, 1)),
        payload_enc    TEXT NOT NULL,
        key_version    INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        CHECK (
          (pillar = 'STATUTORY' AND contract_type = 'STATUTORY_PENSION')
          OR (pillar = 'OCCUPATIONAL' AND contract_type IN ('DIRECT_INSURANCE', 'PENSIONSKASSE', 'DIREKTZUSAGE', 'UNTERSTUETZUNGSKASSE', 'PENSIONSFONDS', 'CAPITAL_ACCOUNT'))
          OR (pillar = 'PRIVATE' AND contract_type IN ('RIESTER', 'PRIVATE_PENSION_INSURANCE', 'ALTERSVORSORGEDEPOT'))
        ),
        CHECK (origin = 'MANUAL' OR (parser_id IS NOT NULL AND parser_version IS NOT NULL))
      )
    `);
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS retirement_records_statutory_uidx ON retirement_records (owner_id) WHERE pillar = 'STATUTORY'",
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS retirement_records_owner_pillar_idx ON retirement_records (owner_id, pillar)',
    );

    // 038-networth-tracking: one row per wealth snapshot and one settings row per owner. Entry
    // names, classes, amounts, notes and group assignments live only inside the AES-256-GCM
    // `payload_enc`; the snapshot date is the only plain business column (ordering and the
    // one-snapshot-per-date rule). Brand-new tables, so `IF NOT EXISTS` is enough.
    db.exec(`
      CREATE TABLE IF NOT EXISTS wealth_snapshots (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        snapshot_date TEXT NOT NULL CHECK (snapshot_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
        payload_enc   TEXT NOT NULL,
        key_version   INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      )
    `);
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS wealth_snapshots_owner_date_uidx ON wealth_snapshots (owner_id, snapshot_date)',
    );
    db.exec(`
      CREATE TABLE IF NOT EXISTS wealth_settings (
        owner_id    TEXT PRIMARY KEY,
        payload_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        updated_at  TEXT NOT NULL
      )
    `);

    // 039-insurances-management: one row per contract, one settings row per owner and a plain
    // reminder log. Names, insurers, contract numbers, amounts, dates, notes, profile and
    // dismissals live only inside the AES-256-GCM `payload_enc`; the log holds ids and a date.
    db.exec(`
      CREATE TABLE IF NOT EXISTS insurance_contracts (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        payload_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS insurance_contracts_owner_idx ON insurance_contracts (owner_id)',
    );
    db.exec(`
      CREATE TABLE IF NOT EXISTS insurance_settings (
        owner_id    TEXT PRIMARY KEY,
        payload_enc TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        updated_at  TEXT NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS insurance_reminder_log (
        owner_id      TEXT NOT NULL,
        contract_id   TEXT NOT NULL,
        deadline_date TEXT NOT NULL,
        sent_at       TEXT NOT NULL,
        PRIMARY KEY (contract_id, deadline_date)
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS insurance_reminder_log_owner_idx ON insurance_reminder_log (owner_id)',
    );

    // 033-parser-requests: generic requests (feature + type, status workflow) with an optional
    // generated attachment and an admin download audit. Brand-new tables, so `IF NOT EXISTS` is
    // enough. No monetary values and no personal identifiers of any document are stored here.
    db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id                 TEXT PRIMARY KEY,
        feature            TEXT NOT NULL,
        type               TEXT NOT NULL,
        requester_id       TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED')),
        payload            TEXT,
        layout_fingerprint TEXT,
        possible_duplicate INTEGER NOT NULL DEFAULT 0 CHECK (possible_duplicate IN (0, 1)),
        note               TEXT,
        created_at         TEXT NOT NULL,
        handled_by         TEXT,
        handled_at         TEXT,
        closed_at          TEXT,
        payload_purged_at  TEXT
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS requests_status_created_idx ON requests (status, created_at DESC)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS requests_requester_idx ON requests (requester_id)');
    db.exec('CREATE INDEX IF NOT EXISTS requests_fingerprint_idx ON requests (layout_fingerprint)');
    db.exec('CREATE INDEX IF NOT EXISTS requests_closed_at_idx ON requests (closed_at)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS request_attachments (
        request_id   TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        size_bytes   INTEGER NOT NULL,
        sha256       TEXT NOT NULL CHECK (length(sha256) = 64),
        page_count   INTEGER NOT NULL CHECK (page_count BETWEEN 1 AND 3),
        content      BLOB NOT NULL,
        created_at   TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS request_download_audit (
        id            TEXT PRIMARY KEY,
        request_id    TEXT NOT NULL,
        admin_id      TEXT,
        downloaded_at TEXT NOT NULL
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS request_download_audit_request_idx ON request_download_audit (request_id)',
    );
  }

  /**
   * 020-domain-library-architecture: adds `users.domain_scopes` to a `users`
   * table that pre-dates it (`initializeSchema()`'s `CREATE TABLE IF NOT
   * EXISTS` only applies the column to a brand-new table — see this file's
   * top-of-file doc comment). Idempotent via the `pragma_table_info` guard,
   * same convention as the pre-collapse migrations this restores.
   */
  private migrateDomainScopes(): void {
    const db = this.requireDb();
    const hasDomainScopes = db
      .prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'domain_scopes'")
      .get();
    if (!hasDomainScopes) {
      db.exec(`ALTER TABLE users ADD COLUMN domain_scopes TEXT NULL DEFAULT '["holdings"]'`);
    }
  }

  /**
   * Account entries moved to the encrypted `account_overview_entries` table. The old plaintext
   * `accounts` table is dropped when empty; one that still holds rows is kept and reported, so no
   * data is destroyed silently.
   */
  private dropLegacyAccountsTable(): void {
    const db = this.requireDb();
    const legacy = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'accounts'")
      .get();
    if (!legacy) {
      return;
    }
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM accounts').get() as {
      total: number;
    };
    if (total > 0) {
      this.logger.error(
        `Legacy plaintext accounts table still holds ${total} rows and was not dropped`,
      );
      return;
    }
    db.exec('DROP TABLE accounts');
  }

  /**
   * 017-restructure-asset-types: renames GOLD → PRECIOUS_METAL and
   * BITCOIN → CRYPTO in a DB created before that spec shipped. The old schema
   * had no `name` column for GOLD/BITCOIN rows; the new schema requires
   * `name IS NOT NULL` for both replacement types, so 'Gold' / 'Bitcoin' are
   * used as default names. Idempotent: guarded by checking the stored CREATE
   * TABLE SQL for the old 'GOLD' literal.
   */
  private migrateHoldingsAssetTypes(): void {
    const db = this.requireDb();
    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'holdings'")
      .get() as { sql: string } | undefined;
    if (!table?.sql.includes("'GOLD'")) {
      return;
    }
    db.exec('BEGIN');
    try {
      db.exec('ALTER TABLE holdings RENAME TO holdings_pre_asset_type_rename');
      db.exec(`
        CREATE TABLE holdings (
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
      db.exec(`
        INSERT INTO holdings
          (id, asset_type, management, quantity, purchase_price, purchase_date,
           isin, name, weight_grams, current_value, created_at, updated_at, owner_id)
        SELECT
          id,
          CASE asset_type WHEN 'GOLD' THEN 'PRECIOUS_METAL' WHEN 'BITCOIN' THEN 'CRYPTO' ELSE asset_type END,
          management,
          quantity,
          purchase_price,
          purchase_date,
          isin,
          COALESCE(name, CASE asset_type WHEN 'GOLD' THEN 'Gold' WHEN 'BITCOIN' THEN 'Bitcoin' END),
          weight_grams,
          current_value,
          created_at,
          updated_at,
          owner_id
        FROM holdings_pre_asset_type_rename
      `);
      db.exec('DROP TABLE holdings_pre_asset_type_rename');
      db.exec(`
        CREATE INDEX IF NOT EXISTS holdings_upsert_lookup_idx
          ON holdings (asset_type, management, isin)
      `);
      db.exec('CREATE INDEX IF NOT EXISTS holdings_owner_id_idx ON holdings (owner_id)');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
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
       VALUES (?, ?, 'Administrator', ?, ?)`,
    ).run(id, email, passwordHash, UserRole.ADMIN);

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
    return this.querySync<T>(text, params);
  }

  /**
   * Synchronous form of {@link query} (same `$N` placeholder translation), for work that must run
   * inside {@link transaction} — `better-sqlite3` transactions cannot span an `await`.
   */
  querySync<T = Record<string, unknown>>(text: string, params: readonly unknown[] = []): T[] {
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

  /**
   * Runs `fn` atomically (research R13): commits when it returns, rolls back when it throws. `fn`
   * must be synchronous — use {@link querySync} inside it. Foreign keys stay disabled app-wide, so
   * cascades are explicit deletes inside the transaction.
   */
  transaction<T>(fn: () => T): T {
    const db = this.requireDb();
    return db.transaction(() => {
      const result = fn();
      if (result instanceof Promise) {
        throw new TypeError('DatabaseService.transaction() needs a synchronous function');
      }
      return result;
    })();
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    return this.db;
  }
}
