import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM field encryption shared by the domains that keep sensitive data at rest. */
export const FIELD_CRYPTO_FORMAT_VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Raised for every decryption problem (format, key, tamper); never carries ciphertext or payload. */
export class FieldDecryptionError extends Error {
  constructor() {
    super('Field decryption failed');
  }
}

/** Decodes an operator key; `null` unless it is base64 of exactly 32 bytes. */
export function decodeFieldKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim() ?? '';
  if (!value || value.length % 4 !== 0 || !BASE64.test(value)) {
    return null;
  }
  const key = Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

/**
 * Encrypts `payload` as JSON with a fresh 12-byte IV. `aad` binds the ciphertext to its row and
 * owner. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */
export function encryptField(key: Buffer, aad: string, payload: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    FIELD_CRYPTO_FORMAT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypts a value written by {@link encryptField}; throws {@link FieldDecryptionError} on any failure. */
export function decryptField<T>(key: Buffer, aad: string, encoded: string): T {
  try {
    const [version, iv, tag, ciphertext, ...rest] = encoded.split(':');
    if (
      version !== FIELD_CRYPTO_FORMAT_VERSION ||
      rest.length > 0 ||
      !iv ||
      !tag ||
      ciphertext === undefined
    ) {
      throw new Error('format');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString('utf8')) as T;
  } catch {
    throw new FieldDecryptionError();
  }
}
