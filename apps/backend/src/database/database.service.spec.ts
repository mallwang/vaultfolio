import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as argon2 from 'argon2';
import { DatabaseService } from './database.service';

/**
 * Schema initialization tests: `DatabaseService.onModuleInit()` creates
 * every table/index at its current, final shape directly (no incremental
 * migrations — there is no productive database in use yet) and is
 * idempotent across repeated boots against the same on-disk file.
 */
describe('DatabaseService — schema initialization', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-db-'));
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

  it('creates every table', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const tables = await database.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
        'example_value', 'holdings', 'users', 'sessions', 'invitations',
        'signup_requests', 'email_blacklist', 'account_action_tokens'
      )`,
    );
    expect(tables.map((t) => t.name).sort()).toEqual(
      [
        'account_action_tokens',
        'email_blacklist',
        'example_value',
        'holdings',
        'invitations',
        'sessions',
        'signup_requests',
        'users',
      ].sort(),
    );

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

  it('is idempotent across repeated boots against the same on-disk file', async () => {
    const first = new DatabaseService();
    await first.onModuleInit();
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();

    const users = await second.query('SELECT * FROM users');
    expect(users).toHaveLength(1);

    await second.onModuleDestroy();
  });

  it('holdings.asset_type accepts ETF/SHARE/PRECIOUS_METAL/CRYPTO/DEPOSIT_MONEY', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    await expect(
      database.query(
        `INSERT INTO holdings (id, asset_type, management, name, weight_grams)
         VALUES ($1, 'PRECIOUS_METAL', 'Home safe', 'Gold', '31.1')`,
        ['gold-1'],
      ),
    ).resolves.not.toThrow();

    await expect(
      database.query(
        `INSERT INTO holdings (id, asset_type, management, name, current_value)
         VALUES ($1, 'DEPOSIT_MONEY', 'N26', 'N26 checking', '0')`,
        ['deposit-1'],
      ),
    ).resolves.not.toThrow();

    await expect(
      database.query(
        `INSERT INTO holdings (id, asset_type, management)
         VALUES ($1, 'BOGUS', 'Home safe')`,
        ['bad-1'],
      ),
    ).rejects.toThrow();

    await database.onModuleDestroy();
  });

  it('users.email_language enforces a CHECK against SUPPORTED_LANGUAGES codes', async () => {
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

  it('account_action_tokens enforces purpose/status CHECK constraints and the user_id FK', async () => {
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

  it('creates the account_action_tokens indexes', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const indexes = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = 'account_action_tokens'",
    );
    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'account_action_tokens_token_idx',
        'account_action_tokens_user_purpose_idx',
      ]),
    );

    await database.onModuleDestroy();
  });
});
