import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from '../auth/users.repository';
import { RetentionSweepService } from './retention-sweep.service';

/**
 * Real temp-file SQLite (Principle IV) — the sweep must delete only
 * `ARCHIVED` accounts whose `retention_expires_at` is in the past, leaving
 * within-window archived and active accounts untouched (data-model.md,
 * 006 FR-005).
 */
describe('RetentionSweepService', () => {
  let database: DatabaseService;
  let users: UsersRepository;
  let sweep: RetentionSweepService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-retention-sweep-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    users = new UsersRepository(database);
    sweep = new RetentionSweepService(users);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    delete process.env.DATABASE_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function createUser(email: string) {
    const passwordHash = await argon2.hash('a-valid-8-char-password');
    return users.create({ email, displayName: email, passwordHash, role: 'MEMBER' });
  }

  it('permanently deletes archived accounts past their retention window', async () => {
    const user = await createUser('past-window@example.com');
    await users.archive(user.id, new Date(Date.now() - 1000).toISOString());

    await sweep.sweep();

    expect(await users.findById(user.id)).toBeNull();
  });

  it('leaves archived accounts still within their retention window untouched', async () => {
    const user = await createUser('within-window@example.com');
    await users.archive(user.id, new Date(Date.now() + 60_000).toISOString());

    await sweep.sweep();

    expect(await users.findById(user.id)).not.toBeNull();
  });

  it('leaves active accounts untouched', async () => {
    const user = await createUser('still-active@example.com');

    await sweep.sweep();

    expect(await users.findById(user.id)).not.toBeNull();
  });
});
