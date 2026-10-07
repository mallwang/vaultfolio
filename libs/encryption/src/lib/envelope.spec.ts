import { randomBytes } from 'node:crypto';
import {
  EnvelopeDecryptionError,
  ciphertextVersion,
  decodeMasterKey,
  decryptValue,
  encryptValue,
  generateDataKey,
  unwrapDataKey,
  wrapDataKey,
} from './envelope.js';

const master = randomBytes(32);
const payload = { amount: '123.45', note: 'secret' };

describe('decodeMasterKey', () => {
  it('accepts base64 of 32 bytes', () => {
    expect(decodeMasterKey(master.toString('base64'))).toEqual(master);
  });

  it.each([undefined, '', '!'.repeat(44), randomBytes(16).toString('base64')])(
    'rejects %p',
    (raw) => {
      expect(decodeMasterKey(raw)).toBeNull();
    },
  );
});

describe('data key wrapping', () => {
  it('round-trips with the same master key, domain and version', () => {
    const dek = generateDataKey();
    const wrapped = wrapDataKey(master, 'wealth', 2, dek);
    expect(wrapped.startsWith('k1:')).toBe(true);
    expect(unwrapDataKey(master, 'wealth', 2, wrapped)).toEqual(dek);
  });

  it.each([
    ['another master key', randomBytes(32), 'wealth', 2],
    ['another domain', master, 'earnings', 2],
    ['another version', master, 'wealth', 3],
  ] as const)('refuses to unwrap with %s', (_label, key, domain, version) => {
    const wrapped = wrapDataKey(master, 'wealth', 2, generateDataKey());
    expect(() => unwrapDataKey(key, domain, version, wrapped)).toThrow(EnvelopeDecryptionError);
  });

  it('refuses malformed input', () => {
    expect(() => unwrapDataKey(master, 'wealth', 2, 'k1:a:b')).toThrow(EnvelopeDecryptionError);
  });
});

describe('value encryption', () => {
  it('round-trips and names the version in the prefix', () => {
    const enc = encryptValue(master, 2, 't|1|u', payload);
    const parts = enc.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v2');
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
    expect(enc).not.toContain('123.45');
    expect(ciphertextVersion(enc)).toBe(2);
    expect(decryptValue(master, 't|1|u', enc)).toEqual(payload);
  });

  it('reads the legacy v1 layout', () => {
    expect(decryptValue(master, 'a', encryptValue(master, 1, 'a', payload))).toEqual(payload);
  });

  it('uses a fresh IV per call', () => {
    expect(encryptValue(master, 2, 'a', payload)).not.toBe(encryptValue(master, 2, 'a', payload));
  });

  it('rejects another AAD (moved row or owner)', () => {
    const enc = encryptValue(master, 2, 't|1|u1', payload);
    expect(() => decryptValue(master, 't|2|u1', enc)).toThrow(EnvelopeDecryptionError);
    expect(() => decryptValue(master, 't|1|u2', enc)).toThrow(EnvelopeDecryptionError);
  });

  it('rejects another key and a tampered tag', () => {
    const enc = encryptValue(master, 2, 'a', payload);
    expect(() => decryptValue(randomBytes(32), 'a', enc)).toThrow(EnvelopeDecryptionError);
    const [v, iv, tag, ct] = enc.split(':');
    const flipped = Buffer.from(tag, 'base64');
    flipped[0] ^= 0xff;
    expect(() =>
      decryptValue(master, 'a', [v, iv, flipped.toString('base64'), ct].join(':')),
    ).toThrow(EnvelopeDecryptionError);
  });

  it.each(['', 'v2', 'x2:a:b:c', 'v2:a:b:c:d'])('rejects malformed %p', (enc) => {
    expect(() => decryptValue(master, 'a', enc)).toThrow(EnvelopeDecryptionError);
    expect(ciphertextVersion(enc)).toBe(/^v\d+:/.test(enc) ? 2 : null);
  });
});
