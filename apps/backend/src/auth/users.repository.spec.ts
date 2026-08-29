import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let database: DatabaseService;
  let repository: UsersRepository;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-users-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    repository = new UsersRepository(database);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  it('creates a user and finds it by id', async () => {
    const created = await repository.create({
      email: 'Member@Example.com',
      displayName: 'Member One',
      passwordHash: 'hash-1',
      role: 'MEMBER',
    });

    expect(created.id).toBeTruthy();
    const found = await repository.findById(created.id);
    expect(found?.email).toBe('Member@Example.com');
    expect(found?.role).toBe('MEMBER');
  });

  it('finds a user by email case-insensitively', async () => {
    const found = await repository.findByEmail('member@example.com');
    expect(found).not.toBeNull();
    expect(found?.displayName).toBe('Member One');

    const foundUpper = await repository.findByEmail('MEMBER@EXAMPLE.COM');
    expect(foundUpper?.id).toBe(found?.id);
  });

  it('returns null for an unknown email or id', async () => {
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
    expect(await repository.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('increments and resets failed attempts', async () => {
    const user = await repository.create({
      email: 'lockout@example.com',
      displayName: 'Lockout Test',
      passwordHash: 'hash-2',
      role: 'MEMBER',
    });

    await repository.incrementFailedAttempts(user.id);
    await repository.incrementFailedAttempts(user.id);
    let found = await repository.findById(user.id);
    expect(found?.failedAttempts).toBe(2);

    await repository.resetFailedAttempts(user.id);
    found = await repository.findById(user.id);
    expect(found?.failedAttempts).toBe(0);
    expect(found?.lockedUntil).toBeNull();
  });

  it('sets and reads lockedUntil', async () => {
    const user = await repository.create({
      email: 'locked@example.com',
      displayName: 'Locked Test',
      passwordHash: 'hash-3',
      role: 'MEMBER',
    });

    const lockedUntil = new Date(Date.now() + 30_000).toISOString();
    await repository.setLockedUntil(user.id, lockedUntil);

    const found = await repository.findById(user.id);
    expect(found?.lockedUntil).toBe(lockedUntil);
  });
});
