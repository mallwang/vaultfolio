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
});
