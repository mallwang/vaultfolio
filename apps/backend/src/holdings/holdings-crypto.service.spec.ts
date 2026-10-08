import { randomBytes } from 'node:crypto';
import { createMemoryKeyring } from '../encryption/encryption.testing';
import { HoldingsAvailableGuard } from './holdings-available.guard';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsUnavailableException } from './holdings.exceptions';

const KEY = randomBytes(32).toString('base64');

function service(key: string | undefined): HoldingsCryptoService {
  const previous = process.env.ENCRYPTION_KEY;
  if (key === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = key;
  const s = new HoldingsCryptoService(createMemoryKeyring());
  if (previous === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = previous;
  return s;
}

const payload = { isin: 'IE00B4L5Y983', management: 'Trade Republic', quantity: '12.5' };

describe('HoldingsCryptoService', () => {
  it('round-trips a JSON payload and records the key version', () => {
    const s = service(KEY);
    const enc = s.encrypt('h1', 'u1', payload);
    expect(s.decrypt('h1', 'u1', enc)).toEqual(payload);
    expect(s.keyVersion).toBe(2);
    expect(enc.split(':')[0]).toBe('v2');
  });

  it('leaks no readable content', () => {
    const enc = service(KEY).encrypt('h1', 'u1', payload);
    expect(enc).not.toContain('IE00B4L5Y983');
    expect(enc).not.toContain('Trade Republic');
    expect(enc.split(':')).toHaveLength(4);
  });

  it.each([
    ['another id', 'h2', 'u1'],
    ['another owner', 'h1', 'u2'],
  ])('binds the ciphertext to holdings|<id>|<owner_id> (%s)', (_l, id, owner) => {
    const s = service(KEY);
    const enc = s.encrypt('h1', 'u1', payload);
    expect(() => s.decrypt(id, owner, enc)).toThrow(HoldingsUnavailableException);
  });

  it('tryDecrypt returns null for a bad row without locking the domain', () => {
    const s = service(KEY);
    const enc = s.encrypt('h1', 'u1', payload);
    expect(s.tryDecrypt('h2', 'u1', enc)).toBeNull();
    expect(s.available).toBe(true);
    expect(s.tryDecrypt('h1', 'u1', enc)).toEqual(payload);
  });

  it('plain decrypt locks the domain after a bad row', () => {
    const s = service(KEY);
    const enc = s.encrypt('h1', 'u1', payload);
    expect(() => s.decrypt('h2', 'u1', enc)).toThrow(HoldingsUnavailableException);
    expect(s.available).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['short', randomBytes(16).toString('base64')],
  ])('is unavailable with a %s key', (_l, key) => {
    const s = service(key);
    expect(s.available).toBe(false);
    expect(() => s.encrypt('h1', 'u1', payload)).toThrow(HoldingsUnavailableException);
    expect(() => s.decrypt('h1', 'u1', 'v1:a:b:c')).toThrow(HoldingsUnavailableException);
    expect(() => s.tryDecrypt('h1', 'u1', 'v1:a:b:c')).toThrow(HoldingsUnavailableException);
    expect(() => new HoldingsAvailableGuard(s).canActivate()).toThrow(HoldingsUnavailableException);
  });

  it('the guard passes while available and the 503 body is fixed', () => {
    expect(new HoldingsAvailableGuard(service(KEY)).canActivate()).toBe(true);
    const exception = new HoldingsUnavailableException();
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toMatchObject({ error: 'HOLDINGS_UNAVAILABLE' });
  });
});
