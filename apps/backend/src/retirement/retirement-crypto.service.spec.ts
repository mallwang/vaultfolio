import { randomBytes } from 'node:crypto';
import type { DatabaseService } from '../database/database.service';
import { RetirementCryptoService } from './retirement-crypto.service';
import { RetirementUnavailableException } from './retirement.exceptions';

const KEY = randomBytes(32).toString('base64');

function service(
  key: string | undefined,
  rows: Record<string, unknown>[] = [],
): RetirementCryptoService {
  const database = {
    querySync: jest.fn(() => rows),
  } as unknown as DatabaseService;
  const previous = process.env.RETIREMENT_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.RETIREMENT_ENCRYPTION_KEY;
  else process.env.RETIREMENT_ENCRYPTION_KEY = key;
  const s = new RetirementCryptoService(database);
  s.onModuleInit();
  if (previous === undefined) delete process.env.RETIREMENT_ENCRYPTION_KEY;
  else process.env.RETIREMENT_ENCRYPTION_KEY = previous;
  return s;
}

const payload = {
  identifier: 'AB-1234567',
  figures: { guaranteedMonthly: '123.45' },
  supplement: { contributionMonthly: '50.00' },
};

describe('RetirementCryptoService', () => {
  it('round-trips a JSON payload', () => {
    const s = service(KEY);
    expect(s.available).toBe(true);
    expect(s.decrypt('r1', 'u1', s.encrypt('r1', 'u1', payload))).toEqual(payload);
  });

  it('uses the v1:<iv>:<tag>:<ct> format without any plain figure or identifier', () => {
    const enc = service(KEY).encrypt('r1', 'u1', payload);
    const parts = enc.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
    expect(enc).not.toContain('123.45');
    expect(enc).not.toContain('AB-1234567');
  });

  it('uses a fresh IV per call', () => {
    const s = service(KEY);
    const a = s.encrypt('r1', 'u1', payload);
    const b = s.encrypt('r1', 'u1', payload);
    expect(a).not.toBe(b);
  });

  it.each([
    ['another row id', 'r2', 'u1'],
    ['another owner', 'r1', 'u2'],
  ] as const)(
    'binds the ciphertext to retirement_records|id|owner via AAD (%s)',
    (_label, id, owner) => {
      const s = service(KEY);
      const enc = s.encrypt('r1', 'u1', payload);
      expect(() => s.decrypt(id, owner, enc)).toThrow(RetirementUnavailableException);
    },
  );

  it('rejects a tampered tag and fails closed afterwards', () => {
    const s = service(KEY);
    const [v, iv, tag, ct] = s.encrypt('r1', 'u1', payload).split(':');
    const flipped = Buffer.from(tag, 'base64');
    flipped[0] ^= 0xff;
    expect(() => s.decrypt('r1', 'u1', [v, iv, flipped.toString('base64'), ct].join(':'))).toThrow(
      RetirementUnavailableException,
    );
    expect(s.available).toBe(false);
    expect(() => s.encrypt('r1', 'u1', payload)).toThrow(RetirementUnavailableException);
  });

  it('decrypting with another key fails', () => {
    const enc = service(KEY).encrypt('r1', 'u1', payload);
    expect(() => service(randomBytes(32).toString('base64')).decrypt('r1', 'u1', enc)).toThrow(
      RetirementUnavailableException,
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
    expect(() => s.encrypt('r1', 'u1', payload)).toThrow(RetirementUnavailableException);
    expect(() => s.decrypt('r1', 'u1', 'v1:a:b:c')).toThrow(RetirementUnavailableException);
  });

  it('does not use the earnings key', () => {
    const previous = process.env.EARNINGS_ENCRYPTION_KEY;
    process.env.EARNINGS_ENCRYPTION_KEY = KEY;
    try {
      expect(service(undefined).available).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.EARNINGS_ENCRYPTION_KEY;
      else process.env.EARNINGS_ENCRYPTION_KEY = previous;
    }
  });

  it('becomes unavailable at boot when the key does not match stored data', () => {
    const enc = service(KEY).encrypt('r1', 'u1', payload);
    const row = { id: 'r1', owner_id: 'u1', payload_enc: enc };
    expect(service(KEY, [row]).available).toBe(true);
    expect(service(randomBytes(32).toString('base64'), [row]).available).toBe(false);
  });

  it('stays available when the table is not readable yet', () => {
    const database = {
      querySync: jest.fn(() => {
        throw new Error('no such table');
      }),
    } as unknown as DatabaseService;
    process.env.RETIREMENT_ENCRYPTION_KEY = KEY;
    try {
      const s = new RetirementCryptoService(database);
      s.onModuleInit();
      expect(s.available).toBe(true);
    } finally {
      delete process.env.RETIREMENT_ENCRYPTION_KEY;
    }
  });
});
