import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';

describe('SessionsRepository', () => {
  let database: DatabaseService;
  let repository: SessionsRepository;
  let users: UsersRepository;
  let userId: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-sessions-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    repository = new SessionsRepository(database);
    users = new UsersRepository(database);

    const user = await users.create({
      email: 'session-user@example.com',
      displayName: 'Session User',
      passwordHash: 'hash',
      role: 'MEMBER',
    });
    userId = user.id;
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  function futureIso(ms: number): string {
    return new Date(Date.now() + ms).toISOString();
  }

  it('creates a session and finds it by id', async () => {
    const session = await repository.create(userId, futureIso(60_000));
    expect(session.id).toBeTruthy();

    const found = await repository.findById(session.id);
    expect(found?.userId).toBe(userId);
  });

  it('treats an expired session as a miss and deletes it', async () => {
    const session = await repository.create(userId, futureIso(-1000));
    const found = await repository.findById(session.id);
    expect(found).toBeNull();

    // Deleted lazily on read — a second lookup still misses, not errors.
    expect(await repository.findById(session.id)).toBeNull();
  });

  it('bumps last_active_at on touch', async () => {
    const session = await repository.create(userId, futureIso(60_000));
    const before = (await repository.findById(session.id))?.lastActiveAt;

    await new Promise((resolve) => setTimeout(resolve, 10));
    await repository.touch(session.id);

    const after = (await repository.findById(session.id))?.lastActiveAt;
    expect(after).not.toBe(before);
  });

  it('deletes a session by id', async () => {
    const session = await repository.create(userId, futureIso(60_000));
    await repository.deleteById(session.id);
    expect(await repository.findById(session.id)).toBeNull();
  });

  it('deletes all sessions for a user', async () => {
    await repository.create(userId, futureIso(60_000));
    await repository.create(userId, futureIso(60_000));

    await repository.deleteAllForUser(userId);

    const rows = await database.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
    expect(rows).toHaveLength(0);
  });
});
