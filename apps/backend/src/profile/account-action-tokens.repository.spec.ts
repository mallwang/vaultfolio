import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { UsersRepository } from '../auth/users.repository';
import { AccountActionTokensRepository } from './account-action-tokens.repository';

describe('AccountActionTokensRepository', () => {
  let database: DatabaseService;
  let repository: AccountActionTokensRepository;
  let users: UsersRepository;
  let tempDir: string;
  let userId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-account-action-tokens-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    repository = new AccountActionTokensRepository(database);
    users = new UsersRepository(database);

    const user = await users.create({
      email: 'token-user@example.com',
      displayName: 'Token User',
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

  function futureIso(msFromNow: number): string {
    return new Date(Date.now() + msFromNow).toISOString();
  }

  it('creates a PENDING token and finds it by token+purpose', async () => {
    const created = await repository.create({
      userId,
      purpose: 'EMAIL_CHANGE',
      newEmail: 'new@example.com',
      token: 'token-create-1',
      expiresAt: futureIso(60_000),
    });

    expect(created.status).toBe('PENDING');
    expect(await repository.findByTokenAndPurpose('token-create-1', 'EMAIL_CHANGE')).toEqual(
      created,
    );
  });

  it('create supersedes only the prior PENDING row of the same (user, purpose)', async () => {
    await repository.create({
      userId,
      purpose: 'EMAIL_CHANGE',
      newEmail: 'first@example.com',
      token: 'token-supersede-1',
      expiresAt: futureIso(60_000),
    });
    const otherPurpose = await repository.create({
      userId,
      purpose: 'PASSWORD_RESET',
      token: 'token-other-purpose-1',
      expiresAt: futureIso(60_000),
    });

    const second = await repository.create({
      userId,
      purpose: 'EMAIL_CHANGE',
      newEmail: 'second@example.com',
      token: 'token-supersede-2',
      expiresAt: futureIso(60_000),
    });

    expect(
      (await repository.findByTokenAndPurpose('token-supersede-1', 'EMAIL_CHANGE'))?.status,
    ).toBe('SUPERSEDED');
    expect(
      (await repository.findByTokenAndPurpose('token-other-purpose-1', 'PASSWORD_RESET'))?.status,
    ).toBe('PENDING');
    expect((await repository.findPendingByUserAndPurpose(userId, 'EMAIL_CHANGE'))?.id).toBe(
      second.id,
    );
    expect(otherPurpose.status).toBe('PENDING');
  });

  it('token+purpose lookup never cross-matches a token of a different purpose', async () => {
    const created = await repository.create({
      userId,
      purpose: 'PASSWORD_RESET',
      token: 'token-cross-1',
      expiresAt: futureIso(60_000),
    });

    expect(await repository.findByTokenAndPurpose('token-cross-1', 'EMAIL_CHANGE')).toBeNull();
    expect(await repository.findByTokenAndPurpose('token-cross-1', 'PASSWORD_RESET')).toEqual(
      created,
    );
  });

  it('markUsed is guarded by status AND expiry — expired rows cannot be used', async () => {
    const expired = await repository.create({
      userId,
      purpose: 'PASSWORD_RESET',
      token: 'token-expired-1',
      expiresAt: futureIso(-1000),
    });

    const result = await repository.markUsed(expired.id);
    expect(result).toBeNull();
    expect(
      (await repository.findByTokenAndPurpose('token-expired-1', 'PASSWORD_RESET'))?.status,
    ).toBe('PENDING');
  });

  it('markUsed succeeds once and racing to a second call affects 0 rows', async () => {
    const created = await repository.create({
      userId,
      purpose: 'PASSWORD_RESET',
      token: 'token-markused-1',
      expiresAt: futureIso(60_000),
    });

    const used = await repository.markUsed(created.id);
    expect(used?.status).toBe('USED');
    expect(used?.usedAt).not.toBeNull();

    const raced = await repository.markUsed(created.id);
    expect(raced).toBeNull();
  });

  it('markSuperseded transitions PENDING only; racing to a second call affects 0 rows', async () => {
    const created = await repository.create({
      userId,
      purpose: 'EMAIL_CHANGE',
      newEmail: 'cancel-target@example.com',
      token: 'token-cancel-1',
      expiresAt: futureIso(60_000),
    });

    const superseded = await repository.markSuperseded(created.id);
    expect(superseded?.status).toBe('SUPERSEDED');

    const raced = await repository.markSuperseded(created.id);
    expect(raced).toBeNull();
  });

  it('expiry window is persisted correctly for each purpose', async () => {
    const emailChange = await repository.create({
      userId,
      purpose: 'EMAIL_CHANGE',
      newEmail: 'expiry@example.com',
      token: 'token-expiry-email-1',
      expiresAt: futureIso(24 * 60 * 60 * 1000),
    });
    const passwordReset = await repository.create({
      userId,
      purpose: 'PASSWORD_RESET',
      token: 'token-expiry-password-1',
      expiresAt: futureIso(60 * 60 * 1000),
    });

    expect(new Date(emailChange.expiresAt).getTime()).toBeGreaterThan(
      new Date(passwordReset.expiresAt).getTime(),
    );
  });
});
