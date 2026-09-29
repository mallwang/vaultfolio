import { randomBytes } from 'node:crypto';
import type { DatabaseService } from '../database/database.service';
import { decodeEarningsKey, EarningsCryptoService } from './earnings-crypto.service';
import { EarningsUnavailableException } from './earnings.exceptions';

const KEY = randomBytes(32).toString('base64');

function service(
  key: string | undefined,
  rows: Record<string, unknown>[] = [],
): EarningsCryptoService {
  const database = {
    querySync: jest.fn((sql: string) => (sql.includes('earnings_records') ? rows : [])),
  } as unknown as DatabaseService;
  const previous = process.env.EARNINGS_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.EARNINGS_ENCRYPTION_KEY;
  else process.env.EARNINGS_ENCRYPTION_KEY = key;
  const s = new EarningsCryptoService(database);
  s.onModuleInit();
  if (previous === undefined) delete process.env.EARNINGS_ENCRYPTION_KEY;
  else process.env.EARNINGS_ENCRYPTION_KEY = previous;
  return s;
}

const payload = { gross: '5000.00', net: '3180.00', oneOff: { gross: '1000.00' } };

describe('EarningsCryptoService', () => {
  it('round-trips a JSON payload', () => {
    const s = service(KEY);
    const enc = s.encrypt('earnings_records', 'r1', 'u1', payload);
    expect(s.decrypt('earnings_records', 'r1', 'u1', enc)).toEqual(payload);
  });

  it('uses the v1:<iv>:<tag>:<ct> format without any plain amount', () => {
    const enc = service(KEY).encrypt('earnings_records', 'r1', 'u1', payload);
    const parts = enc.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
    expect(enc).not.toContain('5000');
    expect(enc).not.toContain('3180');
  });

  it('uses a fresh IV per call', () => {
    const s = service(KEY);
    const a = s.encrypt('earnings_records', 'r1', 'u1', payload);
    const b = s.encrypt('earnings_records', 'r1', 'u1', payload);
    expect(a).not.toBe(b);
    expect(a.split(':')[1]).not.toBe(b.split(':')[1]);
  });

  it.each([
    ['another row id', 'earnings_records', 'r2', 'u1'],
    ['another owner', 'earnings_records', 'r1', 'u2'],
    ['another table', 'earnings_certificates', 'r1', 'u1'],
  ] as const)('binds the ciphertext to its row via AAD (%s)', (_label, table, id, owner) => {
    const s = service(KEY);
    const enc = s.encrypt('earnings_records', 'r1', 'u1', payload);
    expect(() => s.decrypt(table, id, owner, enc)).toThrow(EarningsUnavailableException);
  });

  it('rejects a tampered tag and fails closed afterwards', () => {
    const s = service(KEY);
    const enc = s.encrypt('earnings_records', 'r1', 'u1', payload);
    const [v, iv, tag, ct] = enc.split(':');
    const flipped = Buffer.from(tag, 'base64');
    flipped[0] ^= 0xff;
    expect(() =>
      s.decrypt('earnings_records', 'r1', 'u1', [v, iv, flipped.toString('base64'), ct].join(':')),
    ).toThrow(EarningsUnavailableException);
    expect(s.available).toBe(false);
    expect(() => s.encrypt('earnings_records', 'r1', 'u1', payload)).toThrow(
      EarningsUnavailableException,
    );
  });

  it('decrypting with another key fails', () => {
    const enc = service(KEY).encrypt('earnings_records', 'r1', 'u1', payload);
    const other = service(randomBytes(32).toString('base64'));
    expect(() => other.decrypt('earnings_records', 'r1', 'u1', enc)).toThrow(
      EarningsUnavailableException,
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['short', randomBytes(16).toString('base64')],
    ['long', randomBytes(48).toString('base64')],
    ['not base64', '!'.repeat(44)],
  ])('is unavailable with a %s key', (_label, key) => {
    const s = service(key);
    expect(s.available).toBe(false);
    expect(() => s.encrypt('earnings_records', 'r1', 'u1', payload)).toThrow(
      EarningsUnavailableException,
    );
    expect(() => s.decrypt('earnings_records', 'r1', 'u1', 'v1:a:b:c')).toThrow(
      EarningsUnavailableException,
    );
  });

  it('becomes unavailable at boot when the key does not match stored data', () => {
    const enc = service(KEY).encrypt('earnings_records', 'r1', 'u1', payload);
    expect(service(KEY, [{ id: 'r1', owner_id: 'u1', amounts_enc: enc }]).available).toBe(true);
    const other = service(randomBytes(32).toString('base64'), [
      { id: 'r1', owner_id: 'u1', amounts_enc: enc },
    ]);
    expect(other.available).toBe(false);
  });

  it('decodes only base64 of exactly 32 bytes', () => {
    expect(decodeEarningsKey(KEY)).toHaveLength(32);
    expect(decodeEarningsKey(` ${KEY} `)).toHaveLength(32);
    expect(decodeEarningsKey(undefined)).toBeNull();
  });
});
