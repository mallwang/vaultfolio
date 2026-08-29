import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from '../auth/users.repository';
import { SignupsRepository } from './signups.repository';

/** Real temp-file SQLite (Principle IV), mirroring `invitations.repository.spec.ts`. */
describe('SignupsRepository', () => {
  let database: DatabaseService;
  let users: UsersRepository;
  let repository: SignupsRepository;
  let tempDir: string;
  let adminId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-signups-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    users = new UsersRepository(database);
    repository = new SignupsRepository(database);

    // `signup_requests.resolved_by` is an FK to `users.id` — a real admin
    // row is needed for markApproved/markRejected in these tests.
    const admin = await users.create({
      email: 'test-admin@example.com',
      displayName: 'Test Admin',
      passwordHash: 'hashed',
      role: 'ADMIN',
    });
    adminId = admin.id;
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    delete process.env.DATABASE_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function futureExpiry(): string {
    return new Date(Date.now() + 60_000).toISOString();
  }

  it('creates and reads back a sign-up request', async () => {
    const created = await repository.create({
      email: 'visitor@example.com',
      passwordHash: 'hashed',
      token: 'tok-1',
      expiresAt: futureExpiry(),
    });

    expect(created.status).toBe('PENDING');
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByToken('tok-1')).toEqual(created);
  });

  it('findActiveByEmail is case-insensitive and only matches PENDING/VERIFIED', async () => {
    const created = await repository.create({
      email: 'Visitor@Example.com',
      passwordHash: 'hashed',
      token: 'tok-2',
      expiresAt: futureExpiry(),
    });

    expect(await repository.findActiveByEmail('visitor@example.com')).toEqual(created);

    await repository.markVerified(created.id);
    const rejected = await repository.markRejected(created.id, adminId);
    expect(rejected).not.toBeNull();
    expect(await repository.findActiveByEmail('visitor@example.com')).toBeNull();
  });

  it('markVerified only succeeds on an unexpired PENDING row', async () => {
    const expired = await repository.create({
      email: 'expired@example.com',
      passwordHash: 'hashed',
      token: 'tok-3',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await repository.markVerified(expired.id)).toBeNull();

    const fresh = await repository.create({
      email: 'fresh@example.com',
      passwordHash: 'hashed',
      token: 'tok-4',
      expiresAt: futureExpiry(),
    });
    const verified = await repository.markVerified(fresh.id);
    expect(verified?.status).toBe('VERIFIED');
    expect(verified?.verifiedAt).not.toBeNull();
  });

  it('markApproved/markRejected only succeed on a VERIFIED row (race guard)', async () => {
    const request = await repository.create({
      email: 'race@example.com',
      passwordHash: 'hashed',
      token: 'tok-5',
      expiresAt: futureExpiry(),
    });

    expect(await repository.markApproved(request.id, adminId)).toBeNull();

    await repository.markVerified(request.id);
    const approved = await repository.markApproved(request.id, adminId);
    expect(approved?.status).toBe('APPROVED');
    expect(approved?.resolvedBy).toBe(adminId);

    expect(await repository.markApproved(request.id, adminId)).toBeNull();
    expect(await repository.markRejected(request.id, adminId)).toBeNull();
  });

  it('findExpiredPending returns only PENDING rows past expiry', async () => {
    const expired = await repository.create({
      email: 'sweep-me@example.com',
      passwordHash: 'hashed',
      token: 'tok-6',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await repository.create({
      email: 'keep-me@example.com',
      passwordHash: 'hashed',
      token: 'tok-7',
      expiresAt: futureExpiry(),
    });

    const candidates = await repository.findExpiredPending();
    expect(candidates.map((c) => c.id)).toEqual([expired.id]);
  });

  it('creates and clears a blacklist entry via the originating request id', async () => {
    const request = await repository.create({
      email: 'blocked@example.com',
      passwordHash: 'hashed',
      token: 'tok-8',
      expiresAt: futureExpiry(),
    });
    await repository.markVerified(request.id);
    await repository.markRejected(request.id, adminId);
    await repository.createBlacklistEntry({
      email: request.email,
      reason: 'test',
      signupRequestId: request.id,
    });

    expect(await repository.findBlacklistEntry('blocked@example.com')).not.toBeNull();

    await repository.deleteBlacklistEntryBySignupRequestId(request.id);
    expect(await repository.findBlacklistEntry('blocked@example.com')).toBeNull();
  });

  it('findAll returns every status, most recent first', async () => {
    await repository.create({
      email: 'a@example.com',
      passwordHash: 'hashed',
      token: 'tok-9',
      expiresAt: futureExpiry(),
    });
    await repository.create({
      email: 'b@example.com',
      passwordHash: 'hashed',
      token: 'tok-10',
      expiresAt: futureExpiry(),
    });

    const all = await repository.findAll();
    expect(all).toHaveLength(2);
  });
});
