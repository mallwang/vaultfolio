import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as argon2 from 'argon2';
import Database from 'better-sqlite3';
import { DatabaseService } from './database.service';

/**
 * Migration tests for 005-auth-sessions-isolation (data-model.md, research.md
 * #6/#7): `users`/`sessions` tables, bootstrap-admin creation from env vars,
 * and the `holdings.owner_id` backfill. Each test boots its own
 * `DatabaseService` against a fresh temp-file SQLite DB so bootstrap runs
 * from empty, per T014.
 */
describe('DatabaseService — auth/isolation migration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-db-migration-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-valid-8-char-password';
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  it('creates the users and sessions tables', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','sessions')",
    );
    expect(tables.map((t) => t.name).sort()).toEqual(['sessions', 'users']);

    await database.onModuleDestroy();
  });

  it('creates the bootstrap admin from env vars on an empty users table', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const users = await database.query<{
      email: string;
      role: string;
      password_hash: string;
    }>('SELECT email, role, password_hash FROM users');

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('admin@example.com');
    expect(users[0].role).toBe('ADMIN');
    expect(await argon2.verify(users[0].password_hash, 'a-valid-8-char-password')).toBe(true);

    await database.onModuleDestroy();
  });

  it('backfills pre-existing holdings rows to the bootstrap admin', async () => {
    // Simulate a pre-005 database: a `holdings` table with a row already in
    // it, and no `owner_id` column yet — created directly (bypassing
    // `DatabaseService`) so the auth migration truly sees it for the first
    // time on the next `onModuleInit()`.
    const raw = new Database(process.env.DATABASE_PATH as string);
    raw.exec(`
      CREATE TABLE holdings (
        id             TEXT PRIMARY KEY,
        asset_type     TEXT NOT NULL,
        management     TEXT NOT NULL,
        quantity       TEXT NULL,
        purchase_price TEXT NULL,
        purchase_date  TEXT NULL,
        isin           TEXT NULL,
        name           TEXT NULL,
        weight_grams   TEXT NULL,
        current_value  TEXT NULL,
        created_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at     TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    raw
      .prepare(
        `INSERT INTO holdings (id, asset_type, management, weight_grams) VALUES (?, ?, ?, ?)`,
      )
      .run('h1', 'GOLD', 'Home safe', '10');
    raw.close();

    const database = new DatabaseService();
    await database.onModuleInit();

    const admin = await database.query<{ id: string }>('SELECT id FROM users');
    const holding = await database.query<{ owner_id: string }>(
      'SELECT owner_id FROM holdings WHERE id = $1',
      ['h1'],
    );

    expect(holding[0].owner_id).toBe(admin[0].id);

    await database.onModuleDestroy();
  });

  it('is idempotent on a second run', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();

    const users = await second.query('SELECT * FROM users');
    expect(users).toHaveLength(1);

    await second.onModuleDestroy();
  });

  it('006: adds users.archived_at/retention_expires_at and the invitations table, idempotently', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    // Second run against the same on-disk DB must not error re-adding the
    // already-present columns/table (data-model.md's pragma-guarded ALTER,
    // matching spec 005's pattern for holdings.owner_id).
    const second = new DatabaseService();
    await second.onModuleInit();

    const userColumns = await second.query<{ name: string }>(
      "SELECT name FROM pragma_table_info('users')",
    );
    const columnNames = userColumns.map((c) => c.name);
    expect(columnNames).toContain('archived_at');
    expect(columnNames).toContain('retention_expires_at');

    const tables = await second.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = 'invitations'",
    );
    expect(tables).toHaveLength(1);

    await second.onModuleDestroy();
  });

  it('007: adds the signup_requests and email_blacklist tables, idempotently', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();

    const tables = await second.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('signup_requests','email_blacklist')",
    );
    expect(tables.map((t) => t.name).sort()).toEqual(['email_blacklist', 'signup_requests']);

    await second.onModuleDestroy();
  });

  it('008: adds users.pending_email and the account_action_tokens table, idempotently', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();

    const userColumns = await second.query<{ name: string }>(
      "SELECT name FROM pragma_table_info('users')",
    );
    expect(userColumns.map((c) => c.name)).toContain('pending_email');

    const tables = await second.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = 'account_action_tokens'",
    );
    expect(tables).toHaveLength(1);

    const indexes = await second.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = 'account_action_tokens'",
    );
    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'account_action_tokens_token_idx',
        'account_action_tokens_user_purpose_idx',
      ]),
    );

    await second.onModuleDestroy();
  });

  it('013: adds users.email_language, idempotently', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();

    const userColumns = await second.query<{ name: string }>(
      "SELECT name FROM pragma_table_info('users')",
    );
    expect(userColumns.map((c) => c.name)).toContain('email_language');

    await second.onModuleDestroy();
  });

  it('013: users.email_language enforces a CHECK against SUPPORTED_LANGUAGES codes', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const [user] = await database.query<{ id: string }>('SELECT id FROM users');

    await expect(
      database.query('UPDATE users SET email_language = $1 WHERE id = $2', ['fr', user.id]),
    ).rejects.toThrow();

    await expect(
      database.query('UPDATE users SET email_language = $1 WHERE id = $2', ['de', user.id]),
    ).resolves.not.toThrow();

    await database.onModuleDestroy();
  });

  it('008: account_action_tokens enforces purpose/status CHECK constraints and the user_id FK', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const [user] = await database.query<{ id: string }>('SELECT id FROM users');

    await expect(
      database.query(
        `INSERT INTO account_action_tokens (id, user_id, purpose, token, expires_at)
         VALUES ($1, $2, 'BOGUS', $3, $4)`,
        ['t1', user.id, 'tok1', new Date().toISOString()],
      ),
    ).rejects.toThrow();

    await expect(
      database.query(
        `INSERT INTO account_action_tokens (id, user_id, purpose, token, status, expires_at)
         VALUES ($1, $2, 'EMAIL_CHANGE', $3, 'BOGUS', $4)`,
        ['t2', user.id, 'tok2', new Date().toISOString()],
      ),
    ).rejects.toThrow();

    await database.query(
      `INSERT INTO account_action_tokens (id, user_id, purpose, token, expires_at)
       VALUES ($1, $2, 'PASSWORD_RESET', $3, $4)`,
      ['t3', user.id, 'tok3', new Date().toISOString()],
    );
    const rows = await database.query<{ id: string }>(
      'SELECT id FROM account_action_tokens WHERE id = $1',
      ['t3'],
    );
    expect(rows).toHaveLength(1);

    await database.onModuleDestroy();
  });
});
