import { randomBytes } from 'node:crypto';
import { createTestDatabase, createTestKeyring, type TestDatabase } from './encryption.testing';
import { DomainKeyUnavailableError, DomainKeyringService } from './domain-keyring.service';
import { KeyStoreRepository } from './key-store.repository';

const key = () => randomBytes(32).toString('base64');
const ENV = ['WEALTH_ENCRYPTION_KEY', 'WEALTH_ENCRYPTION_KEY_PREVIOUS', 'EARNINGS_ENCRYPTION_KEY'];

describe('DomainKeyringService', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    ENV.forEach((name) => delete process.env[name]);
    await db.dispose();
  });

  function boot(env: Record<string, string | undefined>): DomainKeyringService {
    ENV.forEach((name) => delete process.env[name]);
    for (const [name, value] of Object.entries(env)) {
      if (value !== undefined) process.env[name] = value;
    }
    return createTestKeyring(db.database);
  }

  const dataKeys = () => new KeyStoreRepository(db.database).listDataKeys('wealth');

  it('bootstraps data key v2 for a fresh domain and round-trips', () => {
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key() });
    expect(ring.state('wealth')).toBe('READY');
    expect(ring.currentVersion('wealth')).toBe(2);
    const enc = ring.encrypt('wealth', 'a', { n: 1 });
    expect(enc.startsWith('v2:')).toBe(true);
    expect(ring.decrypt('wealth', 'a', enc)).toEqual({ n: 1 });
    expect(dataKeys()).toHaveLength(1);
  });

  it('reads data written before a restart with the same key', () => {
    const master = key();
    const enc = boot({ WEALTH_ENCRYPTION_KEY: master }).encrypt('wealth', 'a', { n: 1 });
    const again = boot({ WEALTH_ENCRYPTION_KEY: master });
    expect(again.decrypt('wealth', 'a', enc)).toEqual({ n: 1 });
    expect(dataKeys()).toHaveLength(1);
  });

  it('locks only the domain whose key is missing', () => {
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key() });
    expect(ring.state('earnings')).toBe('KEY_MISSING');
    expect(ring.isAvailable('earnings')).toBe(false);
    expect(() => ring.encrypt('earnings', 'a', 1)).toThrow(DomainKeyUnavailableError);
    expect(() => ring.decrypt('earnings', 'a', 'v2:a:b:c')).toThrow(DomainKeyUnavailableError);
    expect(ring.isAvailable('wealth')).toBe(true);
  });

  it('treats an invalid key like a missing one', () => {
    expect(boot({ WEALTH_ENCRYPTION_KEY: 'short' }).state('wealth')).toBe('KEY_MISSING');
  });

  it('reports KEY_MISMATCH and writes nothing when a new key comes without the previous one', () => {
    const enc = boot({ WEALTH_ENCRYPTION_KEY: key() }).encrypt('wealth', 'a', { n: 1 });
    const before = JSON.stringify(dataKeys());
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key() });
    expect(ring.state('wealth')).toBe('KEY_MISMATCH');
    expect(() => ring.decrypt('wealth', 'a', enc)).toThrow(DomainKeyUnavailableError);
    expect(() => ring.encrypt('wealth', 'a', 1)).toThrow(DomainKeyUnavailableError);
    expect(JSON.stringify(dataKeys())).toBe(before);
  });

  it('also mismatches when previous and current both do not open the stored keys', () => {
    boot({ WEALTH_ENCRYPTION_KEY: key() });
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key(), WEALTH_ENCRYPTION_KEY_PREVIOUS: key() });
    expect(ring.state('wealth')).toBe('KEY_MISMATCH');
  });

  it('opens with a new key plus the previous one and then reports a rotation pending', () => {
    const oldKey = key();
    const enc = boot({ WEALTH_ENCRYPTION_KEY: oldKey }).encrypt('wealth', 'a', { n: 1 });
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key(), WEALTH_ENCRYPTION_KEY_PREVIOUS: oldKey });
    expect(ring.state('wealth')).toBe('READY');
    expect(ring.decrypt('wealth', 'a', enc)).toEqual({ n: 1 });
  });

  it('ignores a previous key equal to the current key', () => {
    const same = key();
    expect(
      boot({ WEALTH_ENCRYPTION_KEY: same, WEALTH_ENCRYPTION_KEY_PREVIOUS: same }).runtime('wealth')
        .previous,
    ).toBeNull();
  });

  it('flips to KEY_MISMATCH when a stored value no longer authenticates at runtime', () => {
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key() });
    const enc = ring.encrypt('wealth', 'a', { n: 1 });
    expect(() => ring.decrypt('wealth', 'other-aad', enc)).toThrow(DomainKeyUnavailableError);
    expect(ring.state('wealth')).toBe('KEY_MISMATCH');
    expect(() => ring.encrypt('wealth', 'a', 1)).toThrow(DomainKeyUnavailableError);
  });

  it('is unavailable while re-encrypting', () => {
    const ring = boot({ WEALTH_ENCRYPTION_KEY: key() });
    ring.setReencrypting('wealth', true);
    expect(ring.state('wealth')).toBe('REENCRYPTING');
    expect(() => ring.encrypt('wealth', 'a', 1)).toThrow(DomainKeyUnavailableError);
    ring.setReencrypting('wealth', false);
    expect(ring.isAvailable('wealth')).toBe(true);
  });

  it('locks every domain when the key store cannot be read', () => {
    const broken = {
      querySync: () => {
        throw new Error('no such table');
      },
    };
    ENV.forEach((name) => delete process.env[name]);
    process.env.WEALTH_ENCRYPTION_KEY = key();
    const store = new KeyStoreRepository(broken as never);
    const ring = new DomainKeyringService(store, {} as never);
    ring.onModuleInit();
    expect(ring.state('wealth')).toBe('KEY_MISMATCH');
  });
});
