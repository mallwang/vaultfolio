import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as argon2 from 'argon2';
import Database from 'better-sqlite3';
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

  it('holdings has the encrypted-payload shape', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const columns = await database.query<{ name: string }>(
      "SELECT name FROM pragma_table_info('holdings')",
    );
    expect(columns.map((c) => c.name)).toEqual([
      'id',
      'owner_id',
      'payload_enc',
      'key_version',
      'created_at',
      'updated_at',
    ]);

    await database.onModuleDestroy();
  });

  it('drops the pre-045 plaintext holdings table once, then keeps new rows on reboot', async () => {
    const legacy = new Database(process.env.DATABASE_PATH as string);
    legacy.exec(
      `CREATE TABLE holdings (id TEXT PRIMARY KEY, asset_type TEXT, management TEXT, weight_grams TEXT, owner_id TEXT)`,
    );
    legacy.exec(`INSERT INTO holdings VALUES ('old', 'PRECIOUS_METAL', 'Safe', '31.1', 'u1')`);
    legacy.close();

    const first = new DatabaseService();
    await first.onModuleInit();
    expect(await first.query('SELECT * FROM holdings')).toEqual([]);
    await first.query(
      `INSERT INTO holdings (id, owner_id, payload_enc, key_version, created_at, updated_at)
       VALUES ('new', 'u1', 'v1:a:b:c', 1, 't', 't')`,
    );
    await first.onModuleDestroy();

    const second = new DatabaseService();
    await second.onModuleInit();
    expect(await second.query('SELECT id FROM holdings')).toEqual([{ id: 'new' }]);
    await second.onModuleDestroy();
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
  describe('transaction()', () => {
    it('commits when the function returns', async () => {
      const database = new DatabaseService();
      await database.onModuleInit();

      const result = database.transaction(() => {
        database.querySync('INSERT INTO example_value (id, amount) VALUES ($1, $2)', ['a', '1.00']);
        database.querySync('INSERT INTO example_value (id, amount) VALUES ($1, $2)', ['b', '2.00']);
        return 'done';
      });

      expect(result).toBe('done');
      expect(await database.query('SELECT id FROM example_value ORDER BY id')).toEqual([
        { id: 'a' },
        { id: 'b' },
      ]);
      await database.onModuleDestroy();
    });

    it('rolls back every statement when the function throws', async () => {
      const database = new DatabaseService();
      await database.onModuleInit();

      expect(() =>
        database.transaction(() => {
          database.querySync('INSERT INTO example_value (id, amount) VALUES ($1, $2)', [
            'a',
            '1.00',
          ]);
          throw new Error('boom');
        }),
      ).toThrow('boom');

      expect(await database.query('SELECT id FROM example_value')).toEqual([]);
      await database.onModuleDestroy();
    });

    it('rejects an async function', async () => {
      const database = new DatabaseService();
      await database.onModuleInit();

      expect(() => database.transaction(async () => 1)).toThrow(/synchronous/);
      await database.onModuleDestroy();
    });
  });

  it('creates the earnings tables with their identities', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'earnings_%' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual([
      'earnings_certificates',
      'earnings_employers',
      'earnings_imports',
      'earnings_records',
    ]);

    const insert = (id: string, kind: string) =>
      database.query(
        `INSERT INTO earnings_records (id, owner_id, import_id, employer_id, period, issued, kind, seq, amounts_enc)
         VALUES ($1, 'u1', 'i1', 'e1', '2026-09', '2026-09', $2, 1, 'v1:x')`,
        [id, kind],
      );
    await insert('r1', 'REGULAR');
    await expect(insert('r2', 'REGULAR')).rejects.toThrow(/UNIQUE/);
    await expect(insert('r3', 'BOGUS')).rejects.toThrow(/CHECK/);

    await database.onModuleDestroy();
  });

  it('creates the request tables, indexes and constraints', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'request%' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual([
      'request_attachments',
      'request_download_audit',
      'requests',
    ]);

    const indexes = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'requests' AND name LIKE 'requests_%' ORDER BY name",
    );
    expect(indexes.map((i) => i.name)).toEqual([
      'requests_closed_at_idx',
      'requests_fingerprint_idx',
      'requests_requester_idx',
      'requests_status_created_idx',
    ]);

    const insert = (status?: string) =>
      database.query(
        `INSERT INTO requests (id, feature, type, requester_id, status, created_at)
         VALUES ($1, 'earnings', 'new-parser', 'u1', COALESCE($2, 'OPEN'), '2026-10-01T10:00:00.000Z')`,
        [`r-${status ?? 'default'}`, status ?? null],
      );
    await insert();
    await expect(insert('BOGUS')).rejects.toThrow(/CHECK/);
    const rows = await database.query<{ status: string; possible_duplicate: number }>(
      "SELECT status, possible_duplicate FROM requests WHERE id = 'r-default'",
    );
    expect(rows).toEqual([{ status: 'OPEN', possible_duplicate: 0 }]);

    await expect(
      database.query(
        `INSERT INTO request_attachments (request_id, content_type, size_bytes, sha256, page_count, content, created_at)
         VALUES ('r-default', 'application/pdf', 3, 'short', 1, x'010203', '2026-10-01T10:00:00.000Z')`,
      ),
    ).rejects.toThrow(/CHECK/);

    await database.onModuleDestroy();
  });

  it('creates the encryption tables with their constraints', async () => {
    const database = new DatabaseService();
    await database.onModuleInit();

    const key = (version: number, status: string, wrapped: string | null) =>
      database.query(
        `INSERT INTO encryption_data_keys (domain, version, wrapped_dek, kek_fingerprint, status, created_at)
         VALUES ('wealth', $1, $2, 'fp', $3, '2026-10-01T10:00:00.000Z')`,
        [version, wrapped, status],
      );
    await key(2, 'current', 'k1:a:b:c');
    await expect(key(3, 'current', 'k1:a:b:c')).rejects.toThrow(/UNIQUE/);
    await expect(key(1, 'retired', 'k1:a:b:c')).rejects.toThrow(/CHECK/);
    await expect(key(4, 'destroyed', 'k1:a:b:c')).rejects.toThrow(/CHECK/);
    await expect(key(5, 'retired', null)).rejects.toThrow(/CHECK/);
    await key(6, 'destroyed', null);

    const run = (id: string, status: string) =>
      database.query(
        `INSERT INTO encryption_rotation_runs (id, domain, kind, status, started_at)
         VALUES ($1, 'wealth', 'MASTER_KEY', $2, '2026-10-01T10:00:00.000Z')`,
        [id, status],
      );
    await run('r1', 'RUNNING');
    await expect(run('r2', 'RUNNING')).rejects.toThrow(/UNIQUE/);
    await expect(run('r3', 'BOGUS')).rejects.toThrow(/CHECK/);
    await run('r4', 'SUCCEEDED');

    await database.onModuleDestroy();
  });
});
