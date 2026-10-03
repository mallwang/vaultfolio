import { randomBytes } from 'node:crypto';
import { FieldDecryptionError, decodeFieldKey, decryptField, encryptField } from './field-crypto';

describe('field-crypto', () => {
  const key = randomBytes(32);

  it('round-trips a payload and uses a fresh IV per write', () => {
    const a = encryptField(key, 'table|1|owner', { amount: '12.34' });
    const b = encryptField(key, 'table|1|owner', { amount: '12.34' });
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(a).not.toContain('12.34');
    expect(decryptField(key, 'table|1|owner', a)).toEqual({ amount: '12.34' });
  });

  it.each([
    ['another row or owner', (c: string) => [key, 'table|2|owner', c] as const],
    ['another key', (c: string) => [randomBytes(32), 'table|1|owner', c] as const],
    [
      'a tampered tag',
      (c: string) =>
        [key, 'table|1|owner', c.replace(/:[^:]*:/, ':AAAAAAAAAAAAAAAAAAAAAA==:')] as const,
    ],
    ['a wrong version', (c: string) => [key, 'table|1|owner', c.replace('v1:', 'v2:')] as const],
    [
      'a truncated value',
      (c: string) => [key, 'table|1|owner', c.split(':').slice(0, 3).join(':')] as const,
    ],
    ['extra parts', (c: string) => [key, 'table|1|owner', `${c}:x`] as const],
  ])('fails closed for %s', (_name, build) => {
    const encoded = encryptField(key, 'table|1|owner', { a: 1 });
    const [k, aad, value] = build(encoded);
    expect(() => decryptField(k, aad, value)).toThrow(FieldDecryptionError);
  });

  describe('decodeFieldKey', () => {
    it('accepts base64 of exactly 32 bytes', () => {
      expect(decodeFieldKey(key.toString('base64'))?.equals(key)).toBe(true);
      expect(decodeFieldKey(`  ${key.toString('base64')}\n`)?.equals(key)).toBe(true);
    });

    it.each([
      undefined,
      '',
      'short',
      randomBytes(16).toString('base64'),
      randomBytes(33).toString('base64'),
      '!!!!',
    ])('rejects %s', (raw) => {
      expect(decodeFieldKey(raw)).toBeNull();
    });
  });
});
