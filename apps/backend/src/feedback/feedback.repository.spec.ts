import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { createTestKeyring } from '../encryption/encryption.testing';
import { FeedbackAvailableGuard } from './feedback-available.guard';
import { FeedbackCryptoService } from './feedback-crypto.service';
import { FeedbackUnavailableException } from './feedback.exceptions';
import { FeedbackRepository } from './feedback.repository';

describe('FeedbackRepository and crypto', () => {
  let database: DatabaseService;
  let crypto: FeedbackCryptoService;
  let repository: FeedbackRepository;
  let tempDir: string;
  const owner = 'owner-1';
  const other = 'owner-2';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-feedback-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-valid-8-char-password';
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    database = new DatabaseService();
    await database.onModuleInit();
    for (const id of [owner, other]) {
      await database.query(
        `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, $2, 'U', 'x', 'MEMBER')`,
        [id, `${id}@example.com`],
      );
    }
    crypto = new FeedbackCryptoService(createTestKeyring(database));
    repository = new FeedbackRepository(database, crypto);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const key of ['DATABASE_PATH', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD'])
      delete process.env[key];
    delete process.env.ENCRYPTION_KEY;
  });

  const add = (ownerId: string, createdAt?: string, id = randomUUID()) =>
    repository
      .insert({ id, category: 'problem', language: 'en', createdAt }, ownerId, {
        subject: 'Secret subject',
        message: 'Secret message',
      })
      .then(() => id);

  it('stores subject and message only inside the ciphertext and round-trips them', async () => {
    const id = await add(owner);
    const [row] = await database.query<Record<string, unknown>>(
      'SELECT * FROM feedback_submissions WHERE id = $1',
      [id],
    );
    expect(JSON.stringify(row)).not.toContain('Secret');
    expect(String(row.payload_enc)).toMatch(/^v2:/);
    expect(await repository.findById(id, owner)).toMatchObject({
      id,
      category: 'problem',
      subject: 'Secret subject',
      message: 'Secret message',
    });
  });

  it('lists only rows strictly after the cut-off, oldest first', async () => {
    const who = 'owner-window';
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, 'w@example.com', 'W', 'x', 'MEMBER')`,
      [who],
    );
    await add(who, '2026-01-02T00:00:00.000Z');
    await add(who, '2026-01-01T00:00:00.000Z');
    await add(who, '2025-12-31T00:00:00.000Z');
    const rows = await repository.listSince(who, '2025-12-31T00:00:00.000Z');
    expect(rows.map((r) => r.createdAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ]);
  });

  it('scopes reads by owner and binds the ciphertext to its row and owner (AAD)', async () => {
    const id = await add(owner);
    expect(await repository.findById(id, other)).toBeNull();
    const [row] = await database.query<{ payload_enc: string }>(
      'SELECT payload_enc FROM feedback_submissions WHERE id = $1',
      [id],
    );
    expect(() => crypto.decrypt(id, other, row.payload_enc)).toThrow(FeedbackUnavailableException);
  });

  // keep last: a failed decrypt may mark the domain key unavailable
  it('guard answers 503 while the key is unavailable', () => {
    expect(new FeedbackAvailableGuard({ available: true } as never).canActivate()).toBe(true);
    expect(() => new FeedbackAvailableGuard({ available: false } as never).canActivate()).toThrow(
      FeedbackUnavailableException,
    );
  });
});
