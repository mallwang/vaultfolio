import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM primitives for the master key / data key hierarchy (data-model.md). */
const IV_BYTES = 12;
export const KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const WRAPPED_KEY_PREFIX = 'k1';

/** Raised for every decryption problem (format, key, tamper); never carries ciphertext or payload. */
export class EnvelopeDecryptionError extends Error {
  constructor() {
    super('Field decryption failed');
  }
}

/** Decodes an operator key; `null` unless it is base64 of exactly 32 bytes. */
export function decodeMasterKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim() ?? '';
  if (!value || value.length % 4 !== 0 || !BASE64.test(value)) {
    return null;
  }
  const key = Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

export function generateDataKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

function seal(key: Buffer, aad: string, plain: Buffer): [Buffer, Buffer, Buffer] {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext];
}

function open(key: Buffer, aad: string, iv: string, tag: string, ciphertext: string): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
}

function join(prefix: string, parts: [Buffer, Buffer, Buffer]): string {
  return [prefix, ...parts.map((p) => p.toString('base64'))].join(':');
}

function dekAad(domain: string, version: number): string {
  return `dek|${domain}|${version}`;
}

/** Wraps a data key under the master key: `k1:<iv>:<tag>:<ct>`, AAD `dek|<domain>|<version>`. */
export function wrapDataKey(
  masterKey: Buffer,
  domain: string,
  version: number,
  dek: Buffer,
): string {
  return join(WRAPPED_KEY_PREFIX, seal(masterKey, dekAad(domain, version), dek));
}

/** Unwraps a data key; throws {@link EnvelopeDecryptionError} for a wrong master key or tampering. */
export function unwrapDataKey(
  masterKey: Buffer,
  domain: string,
  version: number,
  wrapped: string,
): Buffer {
  try {
    const [prefix, iv, tag, ciphertext, ...rest] = wrapped.split(':');
    if (prefix !== WRAPPED_KEY_PREFIX || rest.length > 0 || !iv || !tag || !ciphertext) {
      throw new Error('format');
    }
    const dek = open(masterKey, dekAad(domain, version), iv, tag, ciphertext);
    if (dek.length !== KEY_BYTES) {
      throw new Error('length');
    }
    return dek;
  } catch {
    throw new EnvelopeDecryptionError();
  }
}

/**
 * Encrypts `payload` as JSON with a fresh 12-byte IV under `key` (the master key for version 1, a
 * data key otherwise). `aad` binds the ciphertext to its row and owner.
 * Format: `v<version>:<iv b64>:<tag b64>:<ciphertext b64>`.
 */
export function encryptValue(key: Buffer, version: number, aad: string, payload: unknown): string {
  return join(`v${version}`, seal(key, aad, Buffer.from(JSON.stringify(payload), 'utf8')));
}

/** Key version named by the ciphertext prefix, or `null` when the format is not recognised. */
export function ciphertextVersion(encoded: string): number | null {
  const match = /^v(\d+):/.exec(encoded);
  return match ? Number(match[1]) : null;
}

/** Decrypts a value written by {@link encryptValue}; throws {@link EnvelopeDecryptionError} on any failure. */
export function decryptValue<T>(key: Buffer, aad: string, encoded: string): T {
  try {
    const [version, iv, tag, ciphertext, ...rest] = encoded.split(':');
    if (!/^v\d+$/.test(version) || rest.length > 0 || !iv || !tag || ciphertext === undefined) {
      throw new Error('format');
    }
    return JSON.parse(open(key, aad, iv, tag, ciphertext).toString('utf8')) as T;
  } catch {
    throw new EnvelopeDecryptionError();
  }
}
