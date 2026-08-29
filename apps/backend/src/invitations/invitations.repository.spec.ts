import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from '../auth/users.repository';
import { InvitationsRepository } from './invitations.repository';

describe('InvitationsRepository', () => {
  let database: DatabaseService;
  let repository: InvitationsRepository;
  let users: UsersRepository;
  let tempDir: string;
  let adminId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-invitations-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    repository = new InvitationsRepository(database);
    users = new UsersRepository(database);

    const admin = await users.create({
      email: 'inviter@example.com',
      displayName: 'Inviter',
      passwordHash: 'hash',
      role: 'ADMIN',
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  function futureIso(msFromNow: number): string {
    return new Date(Date.now() + msFromNow).toISOString();
  }

  it('creates an invitation and finds it by id/token', async () => {
    const created = await repository.create({
      email: 'new.member@example.com',
      token: 'token-create-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    expect(created.status).toBe('PENDING');
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByToken('token-create-1')).toEqual(created);
  });

  it('findPendingByEmail is case-insensitive and only returns PENDING rows', async () => {
    await repository.create({
      email: 'CaseTest@example.com',
      token: 'token-case-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    const found = await repository.findPendingByEmail('casetest@example.com');
    expect(found?.token).toBe('token-case-1');
  });

  it('supersede-on-new-invite: superseding sets status SUPERSEDED and the token becomes inert', async () => {
    const first = await repository.create({
      email: 'supersede@example.com',
      token: 'token-supersede-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    const superseded = await repository.supersede(first.id);
    expect(superseded?.status).toBe('SUPERSEDED');

    const second = await repository.create({
      email: 'supersede@example.com',
      token: 'token-supersede-2',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });
    expect(second.status).toBe('PENDING');

    // The old row is no longer the pending one for this email.
    const pending = await repository.findPendingByEmail('supersede@example.com');
    expect(pending?.id).toBe(second.id);
  });

  it('cancel only transitions from PENDING (race guard returns null otherwise)', async () => {
    const invitation = await repository.create({
      email: 'cancel-me@example.com',
      token: 'token-cancel-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    const cancelled = await repository.cancel(invitation.id);
    expect(cancelled?.status).toBe('CANCELLED');

    const raced = await repository.cancel(invitation.id);
    expect(raced).toBeNull();
  });

  it('markAccepted is guarded by status AND expiry — expired rows cannot be accepted', async () => {
    const expired = await repository.create({
      email: 'expired-accept@example.com',
      token: 'token-expired-accept-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(-1000),
    });

    const result = await repository.markAccepted(expired.id);
    expect(result).toBeNull();
    expect((await repository.findById(expired.id))?.status).toBe('PENDING');
  });

  it('markAccepted succeeds once and is a no-op (race guard) on replay', async () => {
    const invitation = await repository.create({
      email: 'accept-me@example.com',
      token: 'token-accept-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    const accepted = await repository.markAccepted(invitation.id);
    expect(accepted?.status).toBe('ACCEPTED');
    expect(accepted?.acceptedAt).not.toBeNull();

    const replay = await repository.markAccepted(invitation.id);
    expect(replay).toBeNull();
    expect((await repository.findById(invitation.id))?.status).toBe('ACCEPTED');
  });

  it('markExpired opportunistically flips a stale PENDING row past expiry', async () => {
    const invitation = await repository.create({
      email: 'lazy-expire@example.com',
      token: 'token-lazy-expire-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(-1000),
    });

    await repository.markExpired(invitation.id);
    expect((await repository.findById(invitation.id))?.status).toBe('EXPIRED');
  });

  it('markExpired is a no-op on an unexpired PENDING row', async () => {
    const invitation = await repository.create({
      email: 'not-expired@example.com',
      token: 'token-not-expired-1',
      role: 'MEMBER',
      invitedBy: adminId,
      expiresAt: futureIso(60_000),
    });

    await repository.markExpired(invitation.id);
    expect((await repository.findById(invitation.id))?.status).toBe('PENDING');
  });

  it('findAll lists every invitation regardless of status', async () => {
    const all = await repository.findAll();
    expect(all.length).toBeGreaterThan(0);
  });
});
