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

  it('findAll lists every account, including archived ones', async () => {
    const before = await repository.findAll();
    const user = await repository.create({
      email: 'findall@example.com',
      displayName: 'Find All',
      passwordHash: 'hash-4',
      role: 'MEMBER',
    });
    await repository.archive(user.id, new Date(Date.now() + 1000).toISOString());

    const all = await repository.findAll();
    expect(all.length).toBe(before.length + 1);
    const found = all.find((u) => u.id === user.id);
    expect(found?.status).toBe('ARCHIVED');
  });

  it('countActiveAdmins counts only ACTIVE ADMIN rows, and can exclude one id', async () => {
    const admin1 = await repository.create({
      email: 'admin1@example.com',
      displayName: 'Admin One',
      passwordHash: 'hash-5',
      role: 'ADMIN',
    });
    const admin2 = await repository.create({
      email: 'admin2@example.com',
      displayName: 'Admin Two',
      passwordHash: 'hash-6',
      role: 'ADMIN',
    });

    const countBefore = await repository.countActiveAdmins();
    expect(countBefore).toBeGreaterThanOrEqual(2);

    const excluding = await repository.countActiveAdmins(admin1.id);
    expect(excluding).toBe(countBefore - 1);

    await repository.archive(admin2.id, new Date(Date.now() + 1000).toISOString());
    const afterArchive = await repository.countActiveAdmins();
    expect(afterArchive).toBe(countBefore - 1);
  });

  it('updateRole changes role and returns the updated row', async () => {
    const user = await repository.create({
      email: 'role-change@example.com',
      displayName: 'Role Change',
      passwordHash: 'hash-7',
      role: 'MEMBER',
    });

    const updated = await repository.updateRole(user.id, 'ADMIN');
    expect(updated?.role).toBe('ADMIN');
    expect((await repository.findById(user.id))?.role).toBe('ADMIN');
  });

  it('archive is a no-op (zero rows affected) when already archived (race guard)', async () => {
    const user = await repository.create({
      email: 'race-archive@example.com',
      displayName: 'Race Archive',
      passwordHash: 'hash-8',
      role: 'MEMBER',
    });
    const retentionExpiresAt = new Date(Date.now() + 1000).toISOString();

    const first = await repository.archive(user.id, retentionExpiresAt);
    expect(first?.status).toBe('ARCHIVED');
    expect(first?.archivedAt).not.toBeNull();
    expect(first?.retentionExpiresAt).toBe(retentionExpiresAt);

    const second = await repository.archive(user.id, retentionExpiresAt);
    expect(second).toBeNull();
  });

  it('reactivate clears archival columns and is a no-op when already active (race guard)', async () => {
    const user = await repository.create({
      email: 'race-reactivate@example.com',
      displayName: 'Race Reactivate',
      passwordHash: 'hash-9',
      role: 'MEMBER',
    });
    await repository.archive(user.id, new Date(Date.now() + 1000).toISOString());

    const reactivated = await repository.reactivate(user.id);
    expect(reactivated?.status).toBe('ACTIVE');
    expect(reactivated?.archivedAt).toBeNull();
    expect(reactivated?.retentionExpiresAt).toBeNull();

    const second = await repository.reactivate(user.id);
    expect(second).toBeNull();
  });

  it('deleteById removes the user and cascades owned sessions and holdings', async () => {
    const user = await repository.create({
      email: 'delete-me@example.com',
      displayName: 'Delete Me',
      passwordHash: 'hash-10',
      role: 'MEMBER',
    });
    await database.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [
      'sess-delete-cascade',
      user.id,
      new Date(Date.now() + 60_000).toISOString(),
    ]);
    await database.query(
      `INSERT INTO holdings (id, asset_type, management, weight_grams, owner_id)
       VALUES ($1, 'GOLD', 'Self-managed', '10', $2)`,
      ['holding-delete-cascade', user.id],
    );

    await repository.deleteById(user.id);

    expect(await repository.findById(user.id)).toBeNull();
    const sessions = await database.query('SELECT * FROM sessions WHERE user_id = $1', [user.id]);
    expect(sessions.length).toBe(0);
    const holdings = await database.query('SELECT * FROM holdings WHERE owner_id = $1', [user.id]);
    expect(holdings.length).toBe(0);
  });

  it('008: updateDisplayName updates the display name only', async () => {
    const user = await repository.create({
      email: 'display-name-update@example.com',
      displayName: 'Before',
      passwordHash: 'hash-11',
      role: 'MEMBER',
    });

    const updated = await repository.updateDisplayName(user.id, 'After');
    expect(updated?.displayName).toBe('After');
    expect(updated?.email).toBe(user.email);
  });

  it('008: setPendingEmail/clearPendingEmail manage the outstanding email-change target', async () => {
    const user = await repository.create({
      email: 'pending-email@example.com',
      displayName: 'Pending Email',
      passwordHash: 'hash-12',
      role: 'MEMBER',
    });

    const withPending = await repository.setPendingEmail(user.id, 'new-pending@example.com');
    expect(withPending?.pendingEmail).toBe('new-pending@example.com');

    const cleared = await repository.clearPendingEmail(user.id);
    expect(cleared?.pendingEmail).toBeNull();
  });

  it('008: updateEmail sets the new email and clears any pending_email', async () => {
    const user = await repository.create({
      email: 'confirm-email@example.com',
      displayName: 'Confirm Email',
      passwordHash: 'hash-13',
      role: 'MEMBER',
    });
    await repository.setPendingEmail(user.id, 'confirmed@example.com');

    const updated = await repository.updateEmail(user.id, 'confirmed@example.com');
    expect(updated?.email).toBe('confirmed@example.com');
    expect(updated?.pendingEmail).toBeNull();
  });

  it('008: updatePasswordHash updates only the password hash', async () => {
    const user = await repository.create({
      email: 'password-update@example.com',
      displayName: 'Password Update',
      passwordHash: 'hash-14',
      role: 'MEMBER',
    });

    const updated = await repository.updatePasswordHash(user.id, 'new-hash');
    expect(updated?.passwordHash).toBe('new-hash');
    expect(updated?.email).toBe(user.email);
  });
});
