import { randomBytes } from 'node:crypto';
import { keyFingerprint } from './key-fingerprint.js';

describe('keyFingerprint', () => {
  it('is 16 hex chars and deterministic', () => {
    const key = randomBytes(32);
    expect(keyFingerprint(key)).toMatch(/^[0-9a-f]{16}$/);
    expect(keyFingerprint(key)).toBe(keyFingerprint(Buffer.from(key)));
  });

  it('differs per key and does not contain the key', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(keyFingerprint(a)).not.toBe(keyFingerprint(b));
    expect(a.toString('hex')).not.toContain(keyFingerprint(a));
  });
});
