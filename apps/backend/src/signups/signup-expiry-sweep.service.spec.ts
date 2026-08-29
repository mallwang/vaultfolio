import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { SignupsRepository } from './signups.repository';
import { SignupExpirySweepService } from './signup-expiry-sweep.service';

/** Real temp-file SQLite (Principle IV), mirroring `retention-sweep.service.spec.ts`. */
describe('SignupExpirySweepService', () => {
  let database: DatabaseService;
  let signups: SignupsRepository;
  let sweep: SignupExpirySweepService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-signup-sweep-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    database = new DatabaseService();
    await database.onModuleInit();
    signups = new SignupsRepository(database);
    sweep = new SignupExpirySweepService(signups);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    delete process.env.DATABASE_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('deletes PENDING sign-up requests past their expiry window', async () => {
    const expired = await signups.create({
      email: 'expired@example.com',
      passwordHash: 'hashed',
      token: 'tok-expired',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    await sweep.sweep();

    expect(await signups.findById(expired.id)).toBeNull();
  });

  it('leaves unexpired PENDING requests untouched', async () => {
    const fresh = await signups.create({
      email: 'fresh@example.com',
      passwordHash: 'hashed',
      token: 'tok-fresh',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await sweep.sweep();

    expect(await signups.findById(fresh.id)).not.toBeNull();
  });

  it('leaves VERIFIED requests untouched — the sweep only targets PENDING status', async () => {
    const request = await signups.create({
      email: 'verified@example.com',
      passwordHash: 'hashed',
      token: 'tok-verified',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const verified = await signups.markVerified(request.id);
    expect(verified?.status).toBe('VERIFIED');

    await sweep.sweep();

    expect(await signups.findById(request.id)).not.toBeNull();
  });
});
