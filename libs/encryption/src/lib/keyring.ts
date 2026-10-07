import {
  EnvelopeDecryptionError,
  ciphertextVersion,
  decryptValue,
  encryptValue,
} from './envelope.js';

export const DOMAIN_STATES = [
  'READY',
  'KEY_MISSING',
  'KEY_MISMATCH',
  'MIGRATING',
  'REENCRYPTING',
] as const;
export type DomainState = (typeof DOMAIN_STATES)[number];

/** Version 1 is the legacy format: encrypted directly with the master key. */
export const LEGACY_VERSION = 1;

/** In-memory data keys of one domain: which version writes, and every readable version. */
export class Keyring {
  private readonly keys = new Map<number, Buffer>();
  private current: number | null = null;
  private legacyKey: Buffer | null = null;

  /** Registers a data key; the highest registered `current` one is used for writes. */
  addDataKey(version: number, key: Buffer, current: boolean): void {
    this.keys.set(version, key);
    if (current) {
      this.current = version;
    }
  }

  removeDataKey(version: number): void {
    this.keys.delete(version);
    if (this.current === version) {
      this.current = null;
    }
  }

  /** Master key that still opens `v1` rows (only until the legacy migration finishes). */
  setLegacyKey(key: Buffer | null): void {
    this.legacyKey = key;
  }

  get currentVersion(): number | null {
    return this.current;
  }

  get hasLegacyKey(): boolean {
    return this.legacyKey !== null;
  }

  encrypt(aad: string, payload: unknown): string {
    const key = this.current === null ? undefined : this.keys.get(this.current);
    if (this.current === null || !key) {
      throw new EnvelopeDecryptionError();
    }
    return encryptValue(key, this.current, aad, payload);
  }

  decrypt<T>(aad: string, encoded: string): T {
    const version = ciphertextVersion(encoded);
    const key = version === LEGACY_VERSION ? this.legacyKey : this.keys.get(version ?? -1);
    if (!key) {
      throw new EnvelopeDecryptionError();
    }
    return decryptValue<T>(key, aad, encoded);
  }
}

export interface DomainStateInput {
  masterKeyConfigured: boolean;
  mismatch: boolean;
  migrating: boolean;
  reencrypting: boolean;
}

/** Single state of a domain; precedence follows how much of it is usable. */
export function deriveDomainState(input: DomainStateInput): DomainState {
  if (!input.masterKeyConfigured) return 'KEY_MISSING';
  if (input.mismatch) return 'KEY_MISMATCH';
  if (input.migrating) return 'MIGRATING';
  if (input.reencrypting) return 'REENCRYPTING';
  return 'READY';
}

export interface RotationFlags {
  rotationPending: boolean;
  previousKeyRemovable: boolean;
}

/**
 * `rotationPending`: some data key is still wrapped under the previous master key.
 * `previousKeyRemovable`: a previous key is configured but no data key depends on it.
 */
export function deriveRotationFlags(
  wrappingFingerprints: readonly string[],
  currentFingerprint: string | null,
  previousFingerprints: readonly string[],
): RotationFlags {
  const previous = previousFingerprints.filter((fp) => fp !== currentFingerprint);
  const usesPrevious = previous.some((fp) => wrappingFingerprints.includes(fp));
  return {
    rotationPending: usesPrevious,
    previousKeyRemovable: previousFingerprints.length > 0 && !usesPrevious,
  };
}
