import { randomBytes } from 'node:crypto';
import { EnvelopeDecryptionError, encryptValue } from './envelope.js';
import { Keyring, deriveDomainState, deriveRotationFlags } from './keyring.js';

describe('Keyring', () => {
  it('writes with the current version and reads every registered version', () => {
    const k2 = randomBytes(32);
    const k3 = randomBytes(32);
    const ring = new Keyring();
    ring.addDataKey(2, k2, true);
    const old = ring.encrypt('a', { n: 1 });
    ring.addDataKey(3, k3, true);
    expect(ring.currentVersion).toBe(3);
    expect(ring.encrypt('a', { n: 2 }).startsWith('v3:')).toBe(true);
    expect(ring.decrypt('a', old)).toEqual({ n: 1 });
  });

  it('cannot read a dropped version or encrypt without a current key', () => {
    const ring = new Keyring();
    ring.addDataKey(2, randomBytes(32), true);
    const enc = ring.encrypt('a', 1);
    ring.removeDataKey(2);
    expect(ring.currentVersion).toBeNull();
    expect(() => ring.decrypt('a', enc)).toThrow(EnvelopeDecryptionError);
    expect(() => ring.encrypt('a', 1)).toThrow(EnvelopeDecryptionError);
  });

  it('reads v1 only while a legacy key is set', () => {
    const master = randomBytes(32);
    const legacy = encryptValue(master, 1, 'a', { n: 1 });
    const ring = new Keyring();
    expect(() => ring.decrypt('a', legacy)).toThrow(EnvelopeDecryptionError);
    ring.setLegacyKey(master);
    expect(ring.hasLegacyKey).toBe(true);
    expect(ring.decrypt('a', legacy)).toEqual({ n: 1 });
  });
});

describe('deriveDomainState', () => {
  const base = {
    masterKeyConfigured: true,
    mismatch: false,
    migrating: false,
    reencrypting: false,
  };

  it.each([
    [{}, 'READY'],
    [{ masterKeyConfigured: false, mismatch: true }, 'KEY_MISSING'],
    [{ mismatch: true, migrating: true }, 'KEY_MISMATCH'],
    [{ migrating: true, reencrypting: true }, 'MIGRATING'],
    [{ reencrypting: true }, 'REENCRYPTING'],
  ] as const)('%j -> %s', (patch, expected) => {
    expect(deriveDomainState({ ...base, ...patch })).toBe(expected);
  });
});

describe('deriveRotationFlags', () => {
  it('is pending while a data key is wrapped under the previous key', () => {
    expect(deriveRotationFlags(['old', 'new'], 'new', ['old'])).toEqual({
      rotationPending: true,
      previousKeyRemovable: false,
    });
  });

  it('marks a configured but unused previous key removable', () => {
    expect(deriveRotationFlags(['new'], 'new', ['old'])).toEqual({
      rotationPending: false,
      previousKeyRemovable: true,
    });
  });

  it('has nothing to report without a previous key', () => {
    expect(deriveRotationFlags(['new'], 'new', [])).toEqual({
      rotationPending: false,
      previousKeyRemovable: false,
    });
  });

  it('ignores a previous key equal to the current key', () => {
    expect(deriveRotationFlags(['same'], 'same', ['same'])).toEqual({
      rotationPending: false,
      previousKeyRemovable: true,
    });
  });
});
